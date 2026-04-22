import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lee Ingram — an accounting tutor at Ole Miss since 2015.
500+ students have passed their exams with your help.
You write like you're in office hours: warm, direct, confident, never robotic.
Use "you" throughout.
3-4 short paragraphs maximum.
Start with the most important insight.
End with one specific exam tip.
Never hedge. Never use AI phrases.`;

function buildUserPrompt(promptType: string, ctx: any): string {
  const course = ctx?.course_name || "";
  const chapter = ctx?.chapter_name || "";
  const topic = ctx?.topic_name || "";
  const problem = ctx?.problem_text || "";
  const instructions = ctx?.instructions || "";

  switch (promptType) {
    case "strategy":
      return `A student needs a study strategy for this problem before they start.

Course: ${course}
Chapter: ${chapter}
Topic: ${topic}

Problem: ${problem}

Instructions: ${instructions}

Give them:
1. What accounting concept this tests
2. The best approach before calculating
3. One specific exam strategy tip`;

    case "walkthrough":
      return `A student wants to understand how to get the answer step by step.

Chapter: ${chapter}

Problem: ${problem}

Instructions: ${instructions}

Walk them through the thinking process:
1. What to identify first
2. What formula or method to apply
3. How to check their work

Do NOT give the actual numbers — guide the process, not the answer.`;

    case "journal_entry":
      return `A student is confused about the journal entries in this problem.

Chapter: ${chapter}

Problem: ${problem}

Explain:
1. What economic event is being recorded
2. Which accounts are debited/credited and the intuition behind each
3. The most common exam mistake with these entries`;

    case "formula":
      return `A student wants to memorize the key formulas for this problem.

Chapter: ${chapter}
Topic: ${topic}

Problem: ${problem}

Give them:
1. The key formula(s) needed
2. What each variable means in plain English
3. A memory trick or pattern to remember it on an exam`;

    case "tricky":
      return `A student wants to understand why this problem is tricky.

Chapter: ${chapter}

Problem: ${problem}

Instructions: ${instructions}

Explain:
1. What makes this concept confusing for most students
2. The most common mistake students make on this type
3. How to avoid that mistake on the exam`;

    default:
      return `Help the student understand this problem.

Chapter: ${chapter}
Problem: ${problem}
Instructions: ${instructions}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { asset_id, prompt_type, context } = body || {};

    if (!asset_id || !prompt_type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing asset_id or prompt_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 1 — CHECK CACHE
    const { data: cached } = await sb
      .from("survive_ai_responses")
      .select("response_text")
      .eq("asset_id", asset_id)
      .eq("prompt_type", prompt_type)
      .limit(1)
      .maybeSingle();

    if (cached?.response_text) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          response_text: cached.response_text,
          prompt_type,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 2/3 — Build prompts
    const userPrompt = buildUserPrompt(prompt_type, context || {});

    // STEP 4 — CALL OPENAI (o3)
    const model = "o3";
    let responseText = "";

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: 500,
          response_format: { type: "text" },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("OpenAI API error:", res.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `OpenAI error: ${res.status} ${errText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await res.json();
      responseText = data?.choices?.[0]?.message?.content?.trim() || "";

      if (!responseText) {
        return new Response(
          JSON.stringify({ success: false, error: "Empty response from OpenAI" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e: any) {
      console.error("OpenAI call failed:", e);
      return new Response(
        JSON.stringify({ success: false, error: e?.message || "OpenAI call failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 5 — SAVE TO CACHE (never overwrite)
    try {
      await sb.from("survive_ai_responses").insert({
        asset_id,
        prompt_type,
        response_text: responseText,
        model_used: model,
      } as any);
    } catch (e) {
      // Ignore conflicts / RLS / column mismatches — caching is best-effort
      console.warn("Cache insert skipped:", (e as any)?.message);
    }

    // STEP 6 — RETURN
    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        response_text: responseText,
        prompt_type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("survive-this fatal error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
