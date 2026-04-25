const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_BUILD =
  "You are an expert Lovable implementation assistant. Convert this feature plan into a clean, modular, build-ready Lovable prompt. Be specific, practical, and avoid unnecessary complexity. Optimize for low drift and fast implementation.";

const SYSTEM_PLAN =
  "You are an expert Lovable implementation assistant. Convert this feature plan into a planning prompt for Lovable. The prompt MUST instruct Lovable: 'Do not build yet. First create an implementation plan.' Then ask Lovable to outline its approach, files to touch, schema changes, edge cases, and open questions before writing any code.";

function buildUserPrompt(
  feature: {
    title: string;
    description?: string;
    bullet_points?: string[];
    build_steps?: string[];
    testing_steps?: string[];
    status?: string;
  },
  mode: "build" | "plan",
) {
  const lines: string[] = [];
  lines.push(`Feature title: ${feature.title}`);
  if (feature.status) lines.push(`Current status: ${feature.status}`);
  if (feature.description) lines.push(`\nDescription:\n${feature.description}`);
  if (feature.bullet_points?.length)
    lines.push(`\nKey functionality:\n- ${feature.bullet_points.join("\n- ")}`);
  if (feature.build_steps?.length)
    lines.push(`\nBuild steps:\n- ${feature.build_steps.join("\n- ")}`);
  if (feature.testing_steps?.length)
    lines.push(`\nTesting steps:\n- ${feature.testing_steps.join("\n- ")}`);

  lines.push(
    `\nProduce a Lovable-ready ${mode === "plan" ? "PLAN" : "IMPLEMENTATION"} prompt with these sections:`,
  );
  lines.push(
    "1. Goal\n2. Current Context\n3. Implementation Steps\n4. UI/UX Requirements\n5. Database / Backend Requirements\n6. Testing Checklist\n7. Constraints",
  );
  if (mode === "plan") {
    lines.push(
      '\nIMPORTANT: Begin the prompt with the literal sentence: "Do not build yet. First create an implementation plan." Then ask Lovable to share the plan for review before writing code.',
    );
  }
  lines.push(
    "\nReturn only the prompt text in Markdown. No preamble, no explanation, no code fences around the whole output.",
  );
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { feature, mode } = await req.json();
    if (!feature?.title || typeof feature.title !== "string") {
      return new Response(JSON.stringify({ error: "feature.title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const promptMode: "build" | "plan" = mode === "plan" ? "plan" : "build";

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
          { role: "system", content: promptMode === "plan" ? SYSTEM_PLAN : SYSTEM_BUILD },
          { role: "user", content: buildUserPrompt(feature, promptMode) },
        ],
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
    const prompt = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ prompt, mode: promptMode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-build-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? (e as any).message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
