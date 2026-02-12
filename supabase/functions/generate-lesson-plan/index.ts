import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lessonTitle, questionnaire } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const questionnaireText = Object.entries(questionnaire as Record<string, string>)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join("\n\n");

    const systemPrompt = `You are an expert accounting instructor helping create exam-prep video lessons. You produce structured, practical lesson plans.

When given a lesson title and questionnaire answers, generate exactly three sections:

1. LESSON SUMMARY - A concise 2-3 paragraph explanation of the topic suitable for an instructor's reference.

2. PROBLEM BREAKDOWN - A numbered list of key problems to demonstrate, with brief notes on what each problem teaches and common pitfalls.

3. VIDEO OUTLINE - Always use this exact 5-segment structure:
   Segment 1 — Concept Overview (20-30 seconds): Brief conceptual explanation
   Segment 2 — Show Completed Problem & Solution: Display the finished solution first
   Segment 3 — Rework Problems Step-by-Step: Walk through solving each problem
   Segment 4 — Exam Tips & Shortcuts: Key exam strategies
   Segment 5 — Wrap Up & Next Steps: Summary and preview of next lesson

Be specific and practical. Reference the actual textbook problems and concepts mentioned in the questionnaire.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Lesson Title: ${lessonTitle}\n\nQuestionnaire Answers:\n${questionnaireText}\n\nGenerate the three sections: LESSON SUMMARY, PROBLEM BREAKDOWN, and VIDEO OUTLINE.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse sections
    const lessonPlanMatch = content.match(/LESSON SUMMARY[:\s\-—]*([\s\S]*?)(?=PROBLEM BREAKDOWN|$)/i);
    const problemListMatch = content.match(/PROBLEM BREAKDOWN[:\s\-—]*([\s\S]*?)(?=VIDEO OUTLINE|$)/i);
    const videoOutlineMatch = content.match(/VIDEO OUTLINE[:\s\-—]*([\s\S]*?)$/i);

    return new Response(
      JSON.stringify({
        lessonPlan: lessonPlanMatch?.[1]?.trim() || content,
        problemList: problemListMatch?.[1]?.trim() || "",
        videoOutline: videoOutlineMatch?.[1]?.trim() || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-lesson-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
