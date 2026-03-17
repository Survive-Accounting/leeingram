import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { chapter_id } = await req.json();
    if (!chapter_id) throw new Error("Missing chapter_id");

    // 1. Fetch chapter + course info
    const { data: chapter, error: chErr } = await sb
      .from("chapters")
      .select("id, chapter_number, course_id, courses(code)")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) throw new Error("Chapter not found: " + (chErr?.message ?? ""));

    // 2. Fetch approved teaching assets with journal entry data
    const { data: assets, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, journal_entry_raw, problem_context, answer_summary")
      .eq("chapter_id", chapter_id)
      .eq("status", "approved");
    if (aErr) throw new Error("Failed to fetch assets: " + aErr.message);

    const assetsWithJE = (assets ?? []).filter(
      (a: any) => a.journal_entry_raw && a.journal_entry_raw.trim().length > 0
    );

    if (assetsWithJE.length === 0) {
      return new Response(JSON.stringify({ error: "No approved assets with journal entries found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch existing chart of accounts for reference
    const { data: existingAccounts } = await sb
      .from("chart_of_accounts")
      .select("canonical_name, account_type, normal_balance");

    const coaMap = new Map<string, { account_type: string; normal_balance: string }>();
    for (const a of existingAccounts ?? []) {
      coaMap.set(a.canonical_name.toLowerCase(), {
        account_type: a.account_type,
        normal_balance: a.normal_balance,
      });
    }

    // 4. Use AI to parse each asset's journal entries
    const allItems: any[] = [];
    const accountSet = new Map<string, { account_type: string; normal_balance: string }>();
    let sortOrder = 0;

    for (const asset of assetsWithJE) {
      try {
        const parsed = await parseAssetWithAI(sb, supabaseUrl, serviceKey, asset, coaMap);
        if (!parsed || !parsed.entries) continue;

        for (const entry of parsed.entries) {
          sortOrder++;
          allItems.push({
            transaction_description: entry.transaction_description || "Journal entry",
            date_label: entry.date_label || null,
            entries: entry.accounts || [],
            source_asset_id: asset.id,
            sort_order: sortOrder,
          });

          // Collect accounts
          for (const acc of entry.accounts || []) {
            const key = acc.account_name?.toLowerCase();
            if (key && !accountSet.has(key)) {
              const existing = coaMap.get(key);
              accountSet.set(key, {
                account_type: acc.account_type || existing?.account_type || "Asset",
                normal_balance: acc.normal_balance || existing?.normal_balance || "Debit",
              });
            }
          }
        }
      } catch (e) {
        console.error(`Failed to parse asset ${asset.id}:`, e.message);
      }
    }

    if (allItems.length === 0) {
      return new Response(JSON.stringify({ error: "AI could not extract any entries from assets" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Create set
    const { data: setData, error: setErr } = await sb
      .from("entry_builder_sets")
      .insert({
        course_id: chapter.course_id,
        chapter_id: chapter_id,
        status: "draft",
      })
      .select("id")
      .single();
    if (setErr) throw new Error("Failed to create set: " + setErr.message);

    // 6. Insert items
    const itemRows = allItems.map((item) => ({
      set_id: setData.id,
      transaction_description: item.transaction_description,
      date_label: item.date_label,
      entries: item.entries,
      source_asset_id: item.source_asset_id,
      sort_order: item.sort_order,
      deleted: false,
    }));

    const { error: itemErr } = await sb.from("entry_builder_items").insert(itemRows);
    if (itemErr) throw new Error("Failed to insert items: " + itemErr.message);

    // 7. Insert accounts (upsert-like: skip existing for this chapter)
    const { data: existingChapterAccounts } = await sb
      .from("entry_builder_accounts")
      .select("account_name")
      .eq("chapter_id", chapter_id);

    const existingNames = new Set(
      (existingChapterAccounts ?? []).map((a: any) => a.account_name.toLowerCase())
    );

    const newAccounts = Array.from(accountSet.entries())
      .filter(([name]) => !existingNames.has(name))
      .map(([name, meta]) => ({
        chapter_id: chapter_id,
        account_name: name.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        account_type: meta.account_type,
        normal_balance: meta.normal_balance,
      }));

    if (newAccounts.length > 0) {
      await sb.from("entry_builder_accounts").insert(newAccounts);
    }

    return new Response(
      JSON.stringify({
        success: true,
        set_id: setData.id,
        entries_found: allItems.length,
        accounts_found: accountSet.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-entry-builder-set error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function parseAssetWithAI(
  sb: any,
  supabaseUrl: string,
  serviceKey: string,
  asset: any,
  coaMap: Map<string, { account_type: string; normal_balance: string }>
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const coaList = Array.from(coaMap.keys()).slice(0, 50).join(", ");

  const systemPrompt = `You are an accounting journal entry parser. Extract structured data from journal entry text.

Return JSON with this exact schema:
{
  "entries": [
    {
      "transaction_description": "One sentence describing what this entry records",
      "date_label": "The date of the entry, e.g. January 1, 2025",
      "accounts": [
        {
          "side": "debit" or "credit",
          "account_name": "Clean account name",
          "account_type": "Asset" | "Liability" | "Equity" | "Revenue" | "Expense" | "Contra Asset" | "Contra Liability" | "Contra Equity",
          "normal_balance": "Debit" | "Credit"
        }
      ]
    }
  ]
}

Rules:
1. Do NOT include amounts — only account names and sides.
2. Each entry must have a clear one-sentence transaction_description.
3. Account names must be clean (no dollar signs, no numbers, no "Dr." or "Cr." prefixes).
4. Classify each account's type and normal balance.
5. Known accounts: ${coaList}
6. Return ONLY valid JSON.`;

  const userPrompt = `Parse these journal entries:

${asset.journal_entry_raw}

${asset.problem_context ? `Context: ${asset.problem_context}` : ""}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON from response
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
