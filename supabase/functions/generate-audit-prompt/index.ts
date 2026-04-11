const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERAL_SYSTEM = `You generate precise Lovable prompts for an accounting study platform called Survive Accounting.

The platform uses:
- React + TypeScript + Vite + shadcn/ui via Lovable.dev
- Supabase backend
- Navy #14213D, Red #CE1126
- "You" voice: second-person, concise, cause and effect
- Admin tool at /admin/chapter-qa with tabs per content type

Your prompt must:
1. Be scoped to ONE content tab and ONE chapter only
2. Reference the chapter by exact name
3. Be specific enough that Lovable won't drift
4. Use existing admin UI patterns
5. Never touch other tabs or unrelated functionality
6. Be paste-ready — no explanation, just the prompt`;

const UI_ONLY_SYSTEM = `Generate a minimal Lovable prompt for a UI/display fix only.
The platform uses React + TypeScript + Vite + shadcn/ui via Lovable.dev with Supabase backend.
Navy #14213D, Red #CE1126.

Rules:
1. Scope tightly to the specific rendering issue
2. Do not include any content or data changes — those are handled separately
3. One issue per prompt. No drift.
4. Reference the chapter by exact name
5. Be paste-ready — no explanation, just the prompt`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const { chapter_name, course_code, tab_name, findings, admin_notes, ui_only } = await req.json();

    if (!chapter_name || !tab_name || !findings) {
      throw new Error("chapter_name, tab_name, and findings required");
    }

    const systemPrompt = ui_only ? UI_ONLY_SYSTEM : GENERAL_SYSTEM;

    const userPrompt = `Generate a Lovable prompt to fix these ${ui_only ? "UI/display " : ""}issues for:
Chapter: ${chapter_name} (${course_code})
Tab: ${tab_name}

Accepted findings:
${findings}

Admin notes:
${admin_notes || "None"}

The prompt should tell Lovable exactly what ${ui_only ? "UI/display changes" : "content to generate, update, or add in /admin/chapter-qa"} for the ${tab_name} tab of this chapter. Be specific — reference the chapter name and exact ${ui_only ? "rendering fix" : "content"} needed. Scope tightly to avoid drift.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`Anthropic ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const rawText = aiData.content?.[0]?.text || "";
    const cleaned = rawText.replace(/^```[\w]*\n?/gm, "").replace(/```\n?$/gm, "").trim();

    return new Response(JSON.stringify({ prompt: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-audit-prompt error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
