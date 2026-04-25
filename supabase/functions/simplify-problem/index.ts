import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a textbook problem clarifier. You receive a textbook accounting problem (the problem text plus its instructions) and rewrite it into a cleaner, easier-to-scan version.

STRICT RULES — never violate:
- DO NOT change any numbers, dates, names, or values.
- DO NOT change what is being asked.
- DO NOT remove any parts (a), (b), (c), etc. — keep them all.
- DO NOT solve the problem or add calculations.
- DO NOT add commentary, hints, tips, or "the why".
- ONLY simplify wording, improve structure, break into sections, use bullet points where helpful.

OUTPUT FORMAT (Markdown):
1. A short 1–2 sentence intro framing the situation (only if useful).
2. A bullet list under the heading **Key data** with the important facts (dates, amounts, terms) — one fact per bullet, short and scannable.
3. A section titled **Now calculate:** with each instruction as a bullet labeled (a), (b), (c)… in the same order as the original. Keep the substance of each instruction; only simplify the wording.

Use plain Markdown. Keep it tight. No preamble, no "Here is...", no closing remarks. Output the simplified problem only.`;

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
