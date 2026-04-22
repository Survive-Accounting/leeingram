import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lee Ingram — an accounting tutor at Ole Miss who has helped 500+ students ace their exams.

You explain accounting like a patient, knowledgeable tutor in office hours.
Not a textbook. Not a chatbot.

Keep it concise: 3 short paragraphs.
Use "you" throughout.
Connect to exam success.
End with one actionable exam tip.
Never hedge. Write like you know.`;

function buildUserPrompt(
  promptType: string,
  ctx: {
    problem_text?: string;
    instructions?: string;
    chapter_name?: string;
    topic_name?: string;
    course_name?: string;
  },
): string {
  const chapter = ctx.chapter_name ?? "";
  const topic = ctx.topic_name ?? "";
  const course = ctx.course_name ?? "";
  const problem = ctx.problem_text ?? "";
  const instructions = ctx.instructions ?? "";

  if (promptType === "problem") {
    return `A student opened this practice problem and wants a suggested strategy before they start solving.

Course: ${course}
Chapter: ${chapter}
Topic: ${topic}
Problem: ${problem}

Give them:
1. What accounting concept this tests
2. The best strategy to approach it
3. One exam tip for this type of problem`;
  }

  if (promptType === "instructions") {
    return `A student is looking at the instructions for this practice problem and needs help understanding what each part is asking.

Chapter: ${chapter}
Instructions: ${instructions}

Break down each instruction in plain English. What is each part actually asking them to calculate or prepare?`;
  }

  if (promptType === "journal_entry") {
    return `A student needs help understanding the journal entries in this problem.

Chapter: ${chapter}
Problem: ${problem}

Explain:
1. What transactions need to be recorded
2. Which accounts are affected and why
3. The exam trap with these entries`;
  }

  throw new Error(`Unknown prompt_type: ${promptType}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { asset_id, prompt_type, context } = await req.json();

    if (!asset_id || !prompt_type) {
      throw new Error("asset_id and prompt_type are required");
    }
    if (!["problem", "instructions", "journal_entry"].includes(prompt_type)) {
      throw new Error(
        "prompt_type must be 'problem', 'instructions', or 'journal_entry'",
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // STEP 1 — Cache check
    const { data: cached, error: cacheErr } = await sb
      .from("survive_ai_responses")
      .select("response_text")
      .eq("asset_id", asset_id)
      .eq("prompt_type", prompt_type)
      .maybeSingle();

    if (cacheErr) {
      console.error("Cache lookup error:", cacheErr);
    }

    if (cached?.response_text) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          response_text: cached.response_text,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 2 — Build prompt
    const userPrompt = buildUserPrompt(prompt_type, context ?? {});

    // STEP 3 — Call OpenAI (o3)
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "o3",
        max_completion_tokens: 500,
        response_format: { type: "text" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`OpenAI ${aiResp.status}: ${errText.slice(0, 500)}`);
    }

    const aiData = await aiResp.json();
    const responseText: string =
      aiData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!responseText) {
      throw new Error("Empty response returned from AI");
    }

    // STEP 4 — Save to cache (never overwrite)
    const { error: insertErr } = await sb
      .from("survive_ai_responses")
      .insert({
        asset_id,
        prompt_type,
        response_text: responseText,
        model_used: "o3",
      });

    if (insertErr && !insertErr.message?.includes("duplicate")) {
      console.error("Cache insert error:", insertErr);
    }

    // STEP 5 — Return
    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        response_text: responseText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("survive-this error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message ?? err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
