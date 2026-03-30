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

    const { data: asset, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, journal_entry_completed_json, problem_context, survive_problem_text")
      .eq("id", teaching_asset_id)
      .single();
    if (aErr || !asset) throw new Error("Asset not found: " + (aErr?.message ?? ""));

    const jeJson = asset.journal_entry_completed_json;
    if (!jeJson || !jeJson.scenario_sections) {
      return new Response(JSON.stringify({ error: "No canonical JE data found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a description of the entries for the AI
    const entrySummaries: string[] = [];
    for (const section of jeJson.scenario_sections) {
      for (const entry of section.entries_by_date) {
        const accounts = (entry.rows || []).map((r: any) => {
          const side = r.side || (r.credit != null && r.credit !== 0 ? "credit" : "debit");
          return `${r.account_name} (${side})`;
        }).join(", ");
        entrySummaries.push(`Date: ${entry.entry_date}, Section: ${section.label}, Accounts: ${accounts}`);
      }
    }

    const systemPrompt = `You are an accounting expert. For each journal entry below, provide a concise "To record [transaction]" memo that describes what the entry accomplishes.

Return JSON with this exact schema:
{
  "memos": [
    "To record [description]"
  ]
}

Rules:
1. Each memo starts with "To record " followed by a concise description.
2. Keep memos short (5-12 words after "To record").
3. Be specific to the transaction (e.g., "To record acquisition of equity investment" not just "To record investment").
4. Return memos in the SAME ORDER as the entries provided.
5. Return ONLY valid JSON, no markdown.`;

    const userPrompt = `Problem context:\n${asset.problem_context || asset.survive_problem_text || "N/A"}

Journal entries to describe:\n${entrySummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

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

    if (!parsed.memos || !Array.isArray(parsed.memos)) {
      throw new Error("Invalid response: missing memos array");
    }

    // Apply memos to the JE data
    let memoIdx = 0;
    const enriched = JSON.parse(JSON.stringify(jeJson));
    for (const section of enriched.scenario_sections) {
      for (const entry of section.entries_by_date) {
        if (memoIdx < parsed.memos.length) {
          entry.memo = parsed.memos[memoIdx];
        }
        memoIdx++;
      }
    }

    // Save back
    const { error: updateErr } = await sb
      .from("teaching_assets")
      .update({ journal_entry_completed_json: enriched })
      .eq("id", teaching_asset_id);
    if (updateErr) throw new Error("Failed to save: " + updateErr.message);

    return new Response(
      JSON.stringify({ success: true, memos_added: parsed.memos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-je-memos error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
