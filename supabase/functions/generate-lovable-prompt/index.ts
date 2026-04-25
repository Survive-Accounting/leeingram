const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_BUILD = `You are an expert product builder optimizing for speed, clarity, and conversion.

Always:
- Use modular steps
- Minimize unnecessary text
- Use progressive reveal patterns
- Avoid overengineering
- Prioritize UI/UX clarity and flow
- Structure prompts for Lovable (low drift)

If unclear, simplify rather than expand.

Output STRICTLY in this markdown format (no preamble, no closing remarks):

## Goal
<one sentence>

## Step-by-step implementation
- <step>
- <step>

## UX improvements
- <note>

## Constraints
- <constraint>`;

const SYSTEM_PLAN = `You are an expert product strategist writing a PLANNING prompt for Lovable.

The output MUST instruct Lovable to NOT write code yet — only to produce an implementation plan for review.

Output STRICTLY in this markdown format (no preamble, no closing remarks):

Do not build yet. First create an implementation plan.

## Goal
<one sentence>

## Proposed approach
- <high-level approach point>

## Files / areas likely affected
- <file or area>

## Open questions
- <question for the user>

## Risks / edge cases
- <risk>

End with: "Reply with approval or adjustments before I write any code."`;

const MODE_HINTS: Record<string, string> = {
  ui_fix: "Mode: UI Fix. Focus on minimal, surgical UI corrections — preserve existing structure, fix only what is broken or unclear.",
  new_feature: "Mode: New Feature. Focus on a clean, modular new build with clear data, UI, and behavior boundaries.",
  conversion: "Mode: Conversion Optimization. Focus on clarity, friction removal, trust signals, and CTA hierarchy that lifts conversion.",
};

const REFINEMENT_HINTS: Record<string, string> = {
  concise: "Refine the prior prompt to be MORE CONCISE. Cut redundancy, shorten bullets, keep all required sections.",
  modular: "Refine the prior prompt to be MORE MODULAR. Split steps into smaller independent units with clear boundaries.",
  conversion: "Refine the prior prompt with INCREASED CONVERSION FOCUS. Sharpen CTA, reduce friction, emphasize trust + clarity.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, screenshotBase64, screenshotMime, mode, refinement, priorPrompt, promptKind } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const kind: "build" | "plan" = promptKind === "plan" ? "plan" : "build";
    const SYSTEM = kind === "plan" ? SYSTEM_PLAN : SYSTEM_BUILD;

    const parts: string[] = [];
    if (mode && MODE_HINTS[mode]) parts.push(MODE_HINTS[mode]);
    if (screenshotBase64 && screenshotMime) {
      parts.push("Reference the attached screenshot for visual context.");
    }
    parts.push(`User request:\n${text}`);
    if (refinement && REFINEMENT_HINTS[refinement] && priorPrompt) {
      parts.push(`Prior generated prompt:\n${priorPrompt}`);
      parts.push(REFINEMENT_HINTS[refinement]);
    }

    const userContent: any[] = [{ type: "text", text: parts.join("\n\n") }];
    if (screenshotBase64 && screenshotMime) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${screenshotMime};base64,${screenshotBase64}` },
      });
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI error", resp.status, errText);
      return new Response(JSON.stringify({ error: `OpenAI ${resp.status}`, detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const prompt = data?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ prompt, promptKind: kind }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lovable-prompt error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
