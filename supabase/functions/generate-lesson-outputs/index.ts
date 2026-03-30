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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lessonId, topic, conceptExplanation, mustMemorize, shortcuts, traps, problems } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const problemContext = (problems || [])
      .map((p: any, i: number) => `${i + 1}. ${p.code}: ${p.description || "No description"}${p.notes ? ` (Notes: ${p.notes})` : ""}`)
      .join("\n");

    const systemPrompt = `You are an expert accounting instructor creating exam-prep content for college students. Generate structured, practical teaching materials.

OUTPUT FORMAT — Return exactly these 6 labeled sections separated by "---":

LESSON SUMMARY
2–3 concise instructor-facing paragraphs. Clear conceptual framing.

---

REWRITTEN EXAM PROBLEMS
3–5 exam-style problems based on the assigned textbook pairs. Use NEW numbers (not the textbook numbers). Slightly more concise. Optimized for cram review. Clean formatting for copy/paste. Do NOT copy textbook language.

---

PROBLEM BREAKDOWN
For each assigned problem:
- What concept it tests
- Why it matters
- Where students mess up

---

VIDEO OUTLINE
Structure:
1. 20–30 second hook
2. Concept overview
3. Show completed exam-style version
4. Rework step-by-step
5. Exam traps & shortcuts
6. Wrap-up memory reinforcement

---

CANVA SLIDE BLOCKS
Format per slide:
- Slide Title
- Bullet Points
- Example Setup
- Key Numbers
- Exam Reminder
Clean formatting. No fluff.

---

SLIDE SCRIPT
Conversational script per slide. Natural tone. Concise. Optimized for 8–15 minute video.`;

    const userPrompt = `Topic: ${topic || "Not specified"}

Concept Explanation: ${conceptExplanation || "Not provided"}

Must Memorize: ${mustMemorize || "Not provided"}

Shortcuts/Mnemonics: ${shortcuts || "Not provided"}

Common Traps: ${traps || "Not provided"}

Assigned Problems:
${problemContext || "None assigned"}

Generate all 6 sections.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    if (!data.content || !data.content[0]?.text) {
      throw new Error("Empty response from Anthropic API");
    }
    const content = data.content[0].text;

    // Parse sections split by ---
    const sections = content.split(/\n---\n/);

    const extract = (idx: number) => {
      const s = sections[idx] || "";
      // Remove the section header line
      return s.replace(/^(LESSON SUMMARY|REWRITTEN EXAM PROBLEMS|PROBLEM BREAKDOWN|VIDEO OUTLINE|CANVA SLIDE BLOCKS|SLIDE SCRIPT)\s*/i, "").trim();
    };

    const outputData = {
      lesson_id: lessonId,
      lesson_summary: extract(0),
      rewritten_exam_problems: extract(1),
      problem_breakdown: extract(2),
      video_outline: extract(3),
      canva_slide_blocks: extract(4),
      slide_script: extract(5),
      generated_at: new Date().toISOString(),
    };

    // Upsert — check if outputs exist
    const { data: existing } = await supabase
      .from("lesson_outputs")
      .select("id")
      .eq("lesson_id", lessonId)
      .limit(1);

    if (existing?.length) {
      const { error: upErr } = await supabase
        .from("lesson_outputs")
        .update(outputData)
        .eq("id", existing[0].id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase
        .from("lesson_outputs")
        .insert(outputData);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lesson-outputs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
