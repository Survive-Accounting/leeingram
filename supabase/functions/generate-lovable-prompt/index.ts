import { corsHeaders } from "@supabase/supabase-js/cors";

const SYSTEM = `You are an expert product builder writing clean, modular Lovable prompts.
Convert the user's request into a structured, concise, implementation-ready prompt.
Avoid fluff. Prioritize clarity, modularity, and low drift.

Output STRICTLY in this markdown format (no preamble, no closing remarks):

## Goal
<one sentence>

## Steps
- <step>
- <step>

## Constraints
- <constraint>

## UX Notes
- <note>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, screenshotBase64, screenshotMime } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const userContent: any[] = [{ type: "text", text }];
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

    return new Response(JSON.stringify({ prompt }), {
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
