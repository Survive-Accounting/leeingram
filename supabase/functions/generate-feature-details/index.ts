const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `You generate concise, practical product specs for a web app being built with Lovable. Return strict JSON only.`;

function buildPrompt(title: string) {
  return `Given this feature title: "${title}"

Generate:
1. A clear product description (2–3 sentences)
2. Key functionality bullet points (5–8)
3. Step-by-step build plan
4. Step-by-step testing plan

Context: This is part of a web app being built with Lovable.
Priorities: practical implementation, simple architecture, scalable for future features.
Avoid: vague language, generic fluff. Be specific and actionable.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title } = await req.json();
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildPrompt(title.trim()) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "feature_spec",
              description: "Structured feature specification.",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  bullet_points: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 5,
                    maxItems: 8,
                  },
                  build_steps: { type: "array", items: { type: "string" } },
                  testing_steps: { type: "array", items: { type: "string" } },
                },
                required: ["description", "bullet_points", "build_steps", "testing_steps"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "feature_spec" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("AI gateway error:", resp.status, text);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No tool call in response");
    const parsed = JSON.parse(args);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-feature-details error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
