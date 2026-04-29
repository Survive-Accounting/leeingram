import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateTutorResponse } from "../_shared/generateTutorResponse.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lee Ingram — an accounting tutor at the University of Mississippi who has helped over 500 students ace their exams.

A student just solved a practice problem and wants to understand the concept more deeply before their exam.

Write a focused exam-strategy explanation for ONE part of an accounting problem.

YOUR GOAL:
Help the student understand:
1. WHY this accounting concept works this way (the intuition)
2. WHERE this shows up on exams (what to watch for)
3. WHAT trips students up most (common mistakes to avoid)

FORMAT:
- 3-4 short paragraphs maximum
- Conversational, warm, direct
- "You" perspective throughout
- No bullet points — flowing prose
- No headers
- No step-by-step (that's already shown)
- Connect to the bigger picture of the chapter topic
- End with one sentence that ties it to exam success

VOICE:
- Like a tutor explaining after office hours, not a textbook
- Confident, encouraging
- "Here's the thing most students miss about this..."
- "When you see this on an exam..."
- "The reason this works is..."

Do NOT:
- Repeat the steps already shown
- Re-explain the calculation
- Use AI phrases or hedging
- Start with "Great question" or similar filler
- Be longer than 4 paragraphs`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      asset_id,
      part_label,
      part_instruction,
      part_answer,
      part_steps,
      chapter_name,
      topic_name,
    } = await req.json();

    if (!asset_id || !part_label) {
      throw new Error("asset_id and part_label are required");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const userMessage = `Chapter: ${chapter_name ?? ""}
Topic: ${topic_name ?? ""}
Part (${part_label}): ${part_instruction ?? ""}
Answer: ${part_answer ?? "Journal entry"}

The student already has the step-by-step solution. Explain the concept behind this part and how it shows up on exams.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "o3",
        max_completion_tokens: 800,
        response_format: { type: "text" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`OpenAI ${aiResp.status}: ${errText.slice(0, 500)}`);
    }

    const aiData = await aiResp.json();
    const explanation: string =
      aiData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!explanation) {
      throw new Error("Empty explanation returned from AI");
    }

    // Merge into cache
    const { data: row, error: fetchErr } = await sb
      .from("teaching_assets")
      .select("survive_solution_explanation_cache")
      .eq("id", asset_id)
      .single();

    if (fetchErr) throw new Error(`Asset fetch failed: ${fetchErr.message}`);

    const existingCache =
      (row?.survive_solution_explanation_cache as Record<string, string>) ?? {};
    const newCache = { ...existingCache, [part_label]: explanation };

    const { error: updateErr } = await sb
      .from("teaching_assets")
      .update({ survive_solution_explanation_cache: newCache })
      .eq("id", asset_id);

    if (updateErr) throw new Error(`Cache update failed: ${updateErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        explanation,
        part_label,
        asset_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("explain-solution-part error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message ?? err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
