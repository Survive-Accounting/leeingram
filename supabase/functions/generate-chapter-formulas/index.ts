import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapter_id } = await req.json();
    if (!chapter_id) throw new Error("chapter_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch chapter + course info
    const { data: chapter, error: chErr } = await sb
      .from("chapters")
      .select("id, chapter_name, chapter_number, course_id, courses!chapters_course_id_fkey(course_name, code)")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) throw new Error(`Chapter not found: ${chErr?.message}`);

    const course = (chapter as any).courses;

    // Fetch approved teaching assets for this chapter
    const { data: assets, error: aErr } = await sb
      .from("teaching_assets")
      .select("asset_name, source_ref, problem_title, problem_context, survive_solution_text, important_formulas, concept_notes, problem_type")
      .eq("chapter_id", chapter_id)
      .not("asset_approved_at", "is", null);
    if (aErr) throw new Error(`Failed to fetch assets: ${aErr.message}`);

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: "No approved teaching assets found for this chapter. Approve assets first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for Claude
    const assetSummaries = assets.map((a: any, i: number) => {
      const parts = [`--- Asset ${i + 1}: ${a.source_ref || a.asset_name} (${a.problem_type || "unknown"}) ---`];
      if (a.problem_title) parts.push(`Title: ${a.problem_title}`);
      if (a.problem_context) parts.push(`Context: ${a.problem_context.slice(0, 500)}`);
      if (a.survive_solution_text) parts.push(`Solution: ${a.survive_solution_text.slice(0, 800)}`);
      if (a.important_formulas) parts.push(`Existing formulas: ${a.important_formulas.slice(0, 400)}`);
      if (a.concept_notes) parts.push(`Concepts: ${a.concept_notes.slice(0, 300)}`);
      return parts.join("\n");
    }).join("\n\n");

    const systemPrompt = `You are an expert accounting professor curating the most important formulas a student must memorize for an exam.

Given all teaching assets for a chapter, identify the canonical set of formulas that are:
- Actually used in calculations (not just definitions)
- Likely to appear on an exam
- Distinct from each other (no duplicates or near-duplicates)

Return between 3 and 12 formulas depending on chapter complexity. A bond amortization chapter needs more than a basic concepts chapter.

For each formula return:
- formula_name: short descriptive name (e.g. 'Bond Issue Price')
- formula_expression: the actual formula using standard notation (e.g. 'PV of Principal + PV of Interest Payments')
- formula_explanation: 1-2 sentences explaining when and why a student uses this formula
- sort_order: integer starting at 1, most important first

Also return:
- reasoning: brief explanation of why you chose this many formulas and what you prioritized`;

    const userPrompt = `Course: ${course.course_name} (${course.code})
Chapter ${chapter.chapter_number}: ${chapter.chapter_name}
Approved Assets: ${assets.length}

${assetSummaries}`;

    // Call Anthropic with tool calling
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "return_formulas",
          description: "Return the curated set of chapter formulas",
          input_schema: {
            type: "object",
            properties: {
              formulas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    formula_name: { type: "string" },
                    formula_expression: { type: "string" },
                    formula_explanation: { type: "string" },
                    sort_order: { type: "number" },
                  },
                  required: ["formula_name", "formula_expression", "formula_explanation", "sort_order"],
                },
              },
              reasoning: { type: "string" },
            },
            required: ["formulas", "reasoning"],
          },
        }],
        tool_choice: { type: "tool", name: "return_formulas" },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const toolBlock = anthropicData.content?.find((b: any) => b.type === "tool_use");
    if (!toolBlock?.input) throw new Error("No tool response from Claude");

    const { formulas, reasoning } = toolBlock.input;
    if (!formulas?.length) throw new Error("Claude returned no formulas");

    // Delete existing formulas for this chapter
    await sb.from("chapter_formulas").delete().eq("chapter_id", chapter_id);

    // Insert new formulas
    const now = new Date().toISOString();
    const rows = formulas.map((f: any) => ({
      chapter_id,
      formula_name: f.formula_name,
      formula_expression: f.formula_expression,
      formula_explanation: f.formula_explanation || null,
      sort_order: f.sort_order,
      is_approved: false,
      generated_at: now,
    }));

    const { error: insertErr } = await sb.from("chapter_formulas").insert(rows);
    if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

    return new Response(
      JSON.stringify({ formulas: rows, reasoning, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-chapter-formulas error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
