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
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) throw new Error("Missing teaching_asset_id");

    // Fetch asset
    const { data: asset, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, problem_context, survive_problem_text, survive_solution_text, instruction_list, chapter_id")
      .eq("id", teaching_asset_id)
      .single();
    if (aErr || !asset) throw new Error("Asset not found: " + (aErr?.message ?? ""));

    // Fetch instructions
    const { data: instrData } = await sb
      .from("problem_instructions")
      .select("instruction_number, instruction_text")
      .eq("teaching_asset_id", teaching_asset_id)
      .order("instruction_number");

    const instructions = (instrData || []).map((i: any) => `(${String.fromCharCode(96 + i.instruction_number)}) ${i.instruction_text}`).join("\n");

    // Fetch chapter accounts first; fall back to global chart_of_accounts
    const { data: chapterAccounts } = await sb
      .from("chapter_accounts")
      .select("account_name, account_type, normal_balance")
      .eq("chapter_id", asset.chapter_id)
      .eq("is_approved", true);

    let accounts = chapterAccounts || [];
    let accountSource = "chapter";
    if (accounts.length === 0) {
      const { data: globalAccounts } = await sb
        .from("chart_of_accounts")
        .select("canonical_name, account_type, normal_balance")
        .eq("is_global_default", true);
      accounts = (globalAccounts || []).map((a: any) => ({
        account_name: a.canonical_name,
        account_type: a.account_type,
        normal_balance: a.normal_balance,
      }));
      accountSource = "global";
    }

    const accountList = accounts.map((a: any) => `${a.account_name} (${a.account_type}, ${a.normal_balance})`).join(", ");

    // Fetch chapter context
    const { data: chapter } = await sb
      .from("chapters")
      .select("chapter_name, chapter_number")
      .eq("id", asset.chapter_id)
      .single();

    const chapterContext = chapter ? `Chapter ${chapter.chapter_number}: ${chapter.chapter_name}` : "";

    const systemPrompt = `You are an accounting journal entry expert. Given a problem and its solution, identify the DISTINCT types of journal entries a student should understand, even if the problem doesn't explicitly ask for them.

Return JSON with this exact schema:
{
  "entries": [
    {
      "label": "How to record [transaction type]",
      "rows": [
        {
          "account_name": "Clean account name",
          "side": "debit" | "credit"
        }
      ]
    }
  ]
}

Rules:
1. Do NOT include any dollar amounts — only account names and sides.
2. Show each UNIQUE entry type ONLY ONCE. Do NOT repeat the same entry for different years or periods. For example, "Record costs incurred" appears once, not once per year.
3. Labels must follow the format: "How to record [transaction]" — e.g. "How to record costs incurred", "How to record billings to customer", "How to record revenue recognition (Percentage-of-Completion)".
4. If the same entry type differs by method (e.g. Percentage-of-Completion vs Cost-Recovery), show each method variant once.
5. Group related debits and credits into a single entry.
6. Use ONLY account names from the provided whitelist. Do NOT invent or hallucinate account names. If the whitelist lacks a needed account, use the closest match.
7. Order entries by logical sequence (costs → billings → collections → revenue → closing).
8. Return ONLY valid JSON, no markdown.`;

    const userPrompt = `Problem:\n${asset.problem_context || asset.survive_problem_text || "No problem text"}

Solution:\n${asset.survive_solution_text || "No solution text"}

${instructions ? `Instructions:\n${instructions}` : ""}

${accountList ? `Available accounts:\n${accountList}` : ""}

Identify all implicit journal entries a student studying this problem should understand.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    if (!data.content || !data.content[0]?.text) {
      throw new Error("Empty response from Anthropic API");
    }
    const content = data.content[0].text;
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      throw new Error("Invalid response structure: missing entries array");
    }

    // Save to teaching_assets
    const { error: updateErr } = await sb
      .from("teaching_assets")
      .update({ supplementary_je_json: parsed })
      .eq("id", teaching_asset_id);
    if (updateErr) throw new Error("Failed to save: " + updateErr.message);

    return new Response(
      JSON.stringify({ success: true, entries_count: parsed.entries.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-supplementary-je error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
