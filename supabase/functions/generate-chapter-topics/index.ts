import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapter_id } = await req.json();
    if (!chapter_id) throw new Error("chapter_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch chapter + course info
    const { data: chapter, error: chErr } = await sb
      .from("chapters")
      .select("id, chapter_number, chapter_name, course_id")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) throw new Error("Chapter not found");

    const { data: course } = await sb
      .from("courses")
      .select("id, course_name")
      .eq("id", chapter.course_id)
      .single();

    // Fetch teaching assets for the chapter
    const { data: assets, error: assetErr } = await sb
      .from("teaching_assets")
      .select("asset_name, source_ref, problem_title, problem_context, asset_type")
      .eq("chapter_id", chapter_id)
      .not("asset_approved_at", "is", null);
    if (assetErr) throw assetErr;

    if (!assets || assets.length === 0) {
      throw new Error("No approved teaching assets found for this chapter");
    }

    // Prepare asset summaries for the prompt
    const assetSummaries = assets.map((a) => ({
      asset_name: a.asset_name,
      source_ref: a.source_ref,
      problem_title: a.problem_title,
      problem_context: (a.problem_context || "").substring(0, 300),
      asset_type: a.asset_type,
    }));

    const systemPrompt = `You are an accounting curriculum designer. Generate exactly 10 topics ordered by exam importance — most critical first. Each topic should be genuinely distinct. Some topics may be narrower than others — that is fine. The user will decide how many to keep.

For each topic:
- Give it a short clear name (4-8 words)
- Write a 2-3 sentence description of what concepts it covers
- Write 1 sentence explaining why this topic commonly appears on exams
- List which asset codes from the provided list are most relevant to this topic (by asset_name)

Return ONLY valid JSON in this format:
{
  "topics": [
    {
      "topic_number": 1,
      "topic_name": "...",
      "topic_description": "...",
      "topic_rationale": "...",
      "asset_codes": ["IA2_CH17_P001_A", ...]
    }
  ]
}

Generate exactly 10 topics. Each asset code can appear in multiple topics if relevant. Focus on topics that would make good 10-15 minute instructional videos.`;

    const userPrompt = `Course: ${course?.course_name || "Unknown"}
Chapter ${chapter.chapter_number}: ${chapter.chapter_name}

Here are the ${assets.length} approved teaching assets for this chapter:

${JSON.stringify(assetSummaries, null, 2)}

Please identify the 10 most important exam topics from these assets, ordered by importance.`;

    // Call Lovable AI Gateway
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) throw new Error("Rate limited — please try again in a moment");
      if (aiResp.status === 402) throw new Error("AI credits exhausted — please top up");
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = rawContent;
    const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1];

    let parsed: { topics: Array<{ topic_number: number; topic_name: string; topic_description: string; topic_rationale: string; asset_codes: string[] }> };
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("AI returned invalid JSON — please try again");
    }

    if (!parsed.topics || !Array.isArray(parsed.topics)) {
      throw new Error("AI response missing topics array");
    }

    // Delete existing topics for this chapter (regeneration)
    await sb.from("chapter_topics").delete().eq("chapter_id", chapter_id);

    // Also clear topic_id on teaching_assets for this chapter
    await sb.from("teaching_assets").update({ topic_id: null } as any).eq("chapter_id", chapter_id);

    // Unlock chapter topics if locked
    await sb.from("chapters").update({
      topics_locked: false,
      topics_locked_at: null,
      topics_locked_count: null,
    } as any).eq("id", chapter_id);

    // Insert new topics (up to 10)
    const insertedTopics: Array<{ id: string; asset_codes: string[] }> = [];
    for (const t of parsed.topics.slice(0, 10)) {
      const assetCodes = t.asset_codes || [];
      const { data: inserted, error: insErr } = await sb
        .from("chapter_topics")
        .insert({
          chapter_id,
          course_id: chapter.course_id,
          topic_name: t.topic_name,
          topic_number: t.topic_number,
          topic_description: t.topic_description || "",
          topic_rationale: t.topic_rationale || "",
          asset_codes: assetCodes,
          original_asset_codes: assetCodes,
          display_order: t.topic_number,
          is_active: true,
          generated_by_ai: true,
          is_supplementary: false,
          video_status: "not_started",
          quiz_status: "not_started",
        } as any)
        .select("id")
        .single();

      if (insErr) {
        console.error("Insert error:", insErr);
        continue;
      }
      if (inserted) {
        insertedTopics.push({ id: inserted.id, asset_codes: assetCodes });
      }
    }

    // Create the Supplementary Problems topic (always last, not counted in slider)
    const { data: suppInserted } = await sb
      .from("chapter_topics")
      .insert({
        chapter_id,
        course_id: chapter.course_id,
        topic_name: "Supplementary Problems",
        topic_number: 99,
        topic_description: "Lower-priority problems that don't fit a core topic. Great for extra practice.",
        topic_rationale: "",
        asset_codes: [],
        original_asset_codes: [],
        display_order: 99,
        is_active: true,
        generated_by_ai: true,
        is_supplementary: true,
        video_status: "not_started",
        quiz_status: "not_started",
      } as any)
      .select("id")
      .single();

    // Collect all assigned asset codes
    const allAssignedCodes = new Set(insertedTopics.flatMap(t => t.asset_codes));

    // Find unassigned approved assets and put them in supplementary
    if (suppInserted) {
      const unassignedAssets = (assets || []).filter(a => !allAssignedCodes.has(a.asset_name));
      if (unassignedAssets.length > 0) {
        const suppCodes = unassignedAssets.map(a => a.asset_name);
        await sb.from("chapter_topics").update({ asset_codes: suppCodes } as any).eq("id", suppInserted.id);
        // Tag those assets
        for (const code of suppCodes) {
          await sb.from("teaching_assets").update({ topic_id: suppInserted.id } as any)
            .eq("chapter_id", chapter_id).eq("asset_name", code);
        }
      }
    }

    // Update topic_id on teaching_assets (first matching topic wins)
    for (const topic of insertedTopics) {
      for (const assetCode of topic.asset_codes) {
        await sb
          .from("teaching_assets")
          .update({ topic_id: topic.id } as any)
          .eq("chapter_id", chapter_id)
          .eq("asset_name", assetCode)
          .is("topic_id" as any, null);
      }
    }

    return new Response(
      JSON.stringify({ success: true, topic_count: insertedTopics.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-chapter-topics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
