import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const sb = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    // Support legacy { chapter_id } AND new { chapterId, all, extraPrompt }
    const all = body.all === true;
    const extraPrompt = body.extraPrompt || "";
    let chapterId = body.chapterId || body.chapter_id;

    // Build list of chapters to process
    type ChapterInfo = { id: string; chapter_name: string; chapter_number: number; courseCode: string; courseName: string };
    let chapters: ChapterInfo[] = [];

    if (all) {
      const { data: allCh } = await sb.from("chapters").select("id, chapter_name, chapter_number, course_id").order("chapter_number");
      const { data: courses } = await sb.from("courses").select("id, code, course_name");
      const courseMap = Object.fromEntries((courses || []).map((c: any) => [c.id, { code: c.code, name: c.course_name }]));
      chapters = (allCh || []).map((ch: any) => ({
        id: ch.id,
        chapter_name: ch.chapter_name,
        chapter_number: ch.chapter_number,
        courseCode: courseMap[ch.course_id]?.code || "Unknown",
        courseName: courseMap[ch.course_id]?.name || "Unknown",
      }));
    } else if (chapterId) {
      const chapterName = body.chapterName || "";
      const courseCode = body.courseCode || "";
      if (chapterName && courseCode) {
        chapters = [{ id: chapterId, chapter_name: chapterName, chapter_number: 0, courseCode, courseName: courseCode }];
      } else {
        // Fetch from DB
        const { data: ch } = await sb.from("chapters").select("id, chapter_name, chapter_number, course_id, courses!chapters_course_id_fkey(course_name, code)").eq("id", chapterId).single();
        if (!ch) throw new Error("Chapter not found");
        const course = (ch as any).courses;
        chapters = [{ id: ch.id, chapter_name: ch.chapter_name, chapter_number: ch.chapter_number, courseCode: course?.code || "", courseName: course?.course_name || "" }];
      }
    } else {
      return new Response(JSON.stringify({ error: "Provide chapterId or all:true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: string[] = [];
    let completed = 0;

    for (const ch of chapters) {
      try {
        await generateFormulasForChapter(sb, anthropicKey, ch, extraPrompt);
        completed++;
      } catch (err: any) {
        errors.push(`${ch.chapter_name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ completed, total: chapters.length, errors }),
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

async function generateFormulasForChapter(
  sb: any,
  anthropicKey: string,
  ch: { id: string; chapter_name: string; chapter_number: number; courseCode: string; courseName: string },
  extraPrompt: string
) {
  // Fetch approved assets for context
  const { data: assets } = await sb
    .from("teaching_assets")
    .select("asset_name, source_ref, problem_title, problem_context, survive_solution_text, important_formulas, concept_notes, problem_type")
    .eq("chapter_id", ch.id)
    .not("asset_approved_at", "is", null);

  const assetSummaries = (assets || []).map((a: any, i: number) => {
    const parts = [`--- Asset ${i + 1}: ${a.source_ref || a.asset_name} (${a.problem_type || "unknown"}) ---`];
    if (a.problem_title) parts.push(`Title: ${a.problem_title}`);
    if (a.problem_context) parts.push(`Context: ${a.problem_context?.slice(0, 500)}`);
    if (a.survive_solution_text) parts.push(`Solution: ${a.survive_solution_text?.slice(0, 800)}`);
    if (a.important_formulas) parts.push(`Existing formulas: ${a.important_formulas?.slice(0, 400)}`);
    if (a.concept_notes) parts.push(`Concepts: ${a.concept_notes?.slice(0, 300)}`);
    return parts.join("\n");
  }).join("\n\n");

  const systemPrompt = `You are an expert accounting professor curating the most important formulas a student must memorize for an exam.

Return ONLY valid JSON, no markdown, no backticks:
{
  "formulas": [
    {
      "formula_name": "Bond Carrying Value",
      "formula_expression": "Face Value − Unamortized Discount (or + Unamortized Premium)",
      "formula_explanation": "The net amount at which a bond is carried on the balance sheet.",
      "sort_order": 1
    }
  ]
}

Rules:
- Return between 3 and 12 formulas depending on chapter complexity
- formula_name: short descriptive name
- formula_expression: the actual formula using standard notation
- formula_explanation: 1-2 sentences explaining when/why a student uses this
- sort_order: integer starting at 1, most important first
- Only include formulas actually used in calculations, not just definitions
- Do NOT include formulas from other chapters`;

  let userPrompt = `Generate key formulas for: ${ch.chapter_name} (${ch.courseCode}).

Include formulas students need for exams:
- Balance sheet / income statement calculations
- Journal entry calculation formulas (e.g. interest = Face × rate × time)
- Any ratios or metrics introduced in this chapter

Do NOT include formulas from other chapters.

${assetSummaries ? `Context from ${(assets || []).length} approved assets:\n${assetSummaries}` : ""}`;

  if (extraPrompt) {
    userPrompt += `\n\nAdditionally, the admin noted: ${extraPrompt}\nAdd any formulas from this note that are not already in the list. Do not remove existing approved formulas — only suggest additions.`;
  }

  userPrompt += "\n\nReturn valid JSON only.";

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
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    throw new Error(`Anthropic ${anthropicRes.status}: ${errText}`);
  }

  const anthropicData = await anthropicRes.json();

  // Log cost
  if (anthropicData.usage) {
    logCost(sb, {
      operation_type: "chapter_formula_generation",
      chapter_id: ch.id,
      model: "claude-sonnet-4-20250514",
      input_tokens: anthropicData.usage.input_tokens,
      output_tokens: anthropicData.usage.output_tokens,
      metadata: { chapter_name: ch.chapter_name },
    });
  }

  const rawText = anthropicData.content?.[0]?.text || "";
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    else throw new Error("Could not parse AI response as JSON");
  }

  const formulas = parsed.formulas || [];
  if (!formulas.length) throw new Error("Claude returned no formulas");

  const now = new Date().toISOString();

  if (extraPrompt) {
    // Only add new formulas, don't delete existing
    const { data: existing } = await sb.from("chapter_formulas").select("formula_name").eq("chapter_id", ch.id);
    const existingNames = new Set((existing || []).map((f: any) => f.formula_name.toLowerCase()));
    const newFormulas = formulas.filter((f: any) => !existingNames.has(f.formula_name.toLowerCase()));

    if (newFormulas.length > 0) {
      const maxSort = (existing || []).length;
      const rows = newFormulas.map((f: any, i: number) => ({
        chapter_id: ch.id,
        formula_name: f.formula_name,
        formula_expression: f.formula_expression,
        formula_explanation: f.formula_explanation || null,
        sort_order: maxSort + i + 1,
        is_approved: false,
        is_rejected: false,
        generated_at: now,
      }));
      await sb.from("chapter_formulas").insert(rows);
    }
  } else {
    // Delete non-approved, insert fresh
    await sb.from("chapter_formulas").delete().eq("chapter_id", ch.id).eq("is_approved", false);

    const rows = formulas.map((f: any) => ({
      chapter_id: ch.id,
      formula_name: f.formula_name,
      formula_expression: f.formula_expression,
      formula_explanation: f.formula_explanation || null,
      sort_order: f.sort_order,
      is_approved: false,
      is_rejected: false,
      generated_at: now,
    }));

    await sb.from("chapter_formulas").insert(rows);
  }
}
