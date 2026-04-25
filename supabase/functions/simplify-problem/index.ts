import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a textbook problem clarifier. You receive a textbook accounting problem (the problem text plus its instructions) and rewrite it into a cleaner, easier-to-scan version that balances clarity and completeness.

MUST PRESERVE — never drop or alter:
- ALL numbers, dates, names, and values (exactly as written).
- ALL lists (e.g. numbered concepts, terms to match, accounts provided) — keep every item.
- ALL required tasks (a), (b), (c), etc. — in the same order.
- ALL constraints (e.g. "use each once", "do not repeat", "round to nearest dollar", assumption notes).
- ALL distinct situations/scenarios (often lettered a, b, c…) — keep each one; simplify wording only.

CAN SIMPLIFY:
- Long introductory paragraphs (compress to 1–2 lines of context).
- Repeated wording and filler phrases.
- Long, dense sentences (break into bullets).
- Phrasing — for clarity and scanability.

DO NOT:
- Remove or summarize key lists or structured data.
- Collapse multiple situations into one.
- Solve the problem, add calculations, hints, or commentary.
- Change the meaning of anything.

OUTPUT FORMAT (Markdown, in this order — omit a section only if it does not apply):
1. **Short context** — 1–2 lines max framing the setup.
2. **Key data** — bulleted or numbered list of all critical facts, amounts, dates, terms, and any provided lists (preserve numbering if the original is numbered).
3. **Task** — section titled **Now do:** with each required task as a bullet labeled (a), (b), (c)… in original order. Include any constraints right under the task they apply to.
4. **Situations** — if the problem contains multiple independent scenarios/cases, list them as (a), (b), (c)… with simplified wording, keeping each one separate and complete.

Use plain Markdown. Keep it tight and scannable. No preamble, no "Here is...", no closing remarks. Output the simplified problem only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const { asset_id, force } = await req.json();
    if (!asset_id) throw new Error("asset_id required");

    // Cache check
    if (!force) {
      const { data: cached } = await sb
        .from("simplified_problem_cache")
        .select("simplified_text, model_used, updated_at")
        .eq("asset_id", asset_id)
        .maybeSingle();
      if (cached?.simplified_text) {
        return new Response(
          JSON.stringify({ success: true, cached: true, simplified_text: cached.simplified_text }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Load asset
    const { data: asset, error: aErr } = await sb
      .from("teaching_assets")
      .select(
        "id, survive_problem_text, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, instruction_list",
      )
      .eq("id", asset_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!asset) throw new Error("Asset not found");

    const insList = [
      asset.instruction_1,
      asset.instruction_2,
      asset.instruction_3,
      asset.instruction_4,
      asset.instruction_5,
    ].filter((x: string | null) => !!x && x.trim().length > 0) as string[];
    const fallbackList = !insList.length && asset.instruction_list
      ? String(asset.instruction_list).split(/\n+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const finalIns = insList.length ? insList : fallbackList;

    const labeledInstructions = finalIns
      .map((ins, i) => `(${String.fromCharCode(97 + i)}) ${ins}`)
      .join("\n");

    const userContent = [
      "PROBLEM TEXT:",
      asset.survive_problem_text || "(no problem text)",
      "",
      "INSTRUCTIONS:",
      labeledInstructions || "(no instructions)",
    ].join("\n");

    // Call Anthropic
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${t}`);
    }

    const aiData = await aiResp.json();
    const simplified: string = aiData.content?.[0]?.text?.trim() || "";
    if (!simplified) throw new Error("Empty AI response");

    // Upsert cache
    await sb.from("simplified_problem_cache").upsert(
      {
        asset_id,
        simplified_text: simplified,
        model_used: MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "asset_id" },
    );

    return new Response(
      JSON.stringify({ success: true, cached: false, simplified_text: simplified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("simplify-problem error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
