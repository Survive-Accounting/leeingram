import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const {
      journalBody,
      emailType,
      audience,
      purpose,
      giving,
      hopingToReceive,
      localFlavor,
      emailStyleGuide,
      refinementPrompt,
      previousDraft,
      passNumber,
    } = await req.json();

    const isRefinement = !!refinementPrompt && !!previousDraft;

    const systemPrompt = `You are a pure editorial assistant for a passionate solo educator (Lee) who runs Survive Accounting — an exam-prep tutoring service at Ole Miss in Oxford, MS. Your motto: "Give more than you receive."

RULES:
- You are a PURE EDITOR. Never add new ideas or content the author didn't write. Only refine what's there.
- Preserve Lee's authentic human voice. This must sound written by Lee, not by AI.
- Keep emails concise, scannable, and easy to read.
- Maintain a balance: professional/authoritative educator who genuinely cares + charismatic/funny/warm personality.
- The email should make students smile, feel better (not worse), and be willing to engage.

${emailStyleGuide ? `\nEMAIL STYLE GUIDE:\n${emailStyleGuide}` : ""}

CONTEXT FOR THIS EMAIL:
- Type: ${emailType}
- Audience: ${audience}
- Purpose: ${purpose}
- What Lee is giving: ${giving}
- What Lee hopes to receive: ${hopingToReceive}
${localFlavor ? `- Local flavor / Ole Miss touches: ${localFlavor}` : ""}

After editing the email, provide STRATEGY NOTES in a clearly separated section with:
1. **Top 10 Subject Lines** — ranked best to worst
2. **Top 10 CTAs** — ranked best to worst
3. **Series Potential** — could this email be part of a recurring series? How?
4. **VLOG-Worthy?** — is this email topic worth a video? Why?
5. **Reward/Incentive Ideas** — Amazon gift card, Venmo, etc. Financial brainstorming.
6. **Bigger Implications** — could this email strategy scale? Lead to something larger?
7. **Engagement Predictions** — what response rate to expect and how to improve it.

Format your response as:
---REFINED EMAIL---
[the edited email]

---STRATEGY NOTES---
[all strategy analysis]`;

    const messages: Array<{ role: string; content: string }> = [];

    if (isRefinement) {
      messages.push({
        role: "user",
        content: `Here is my raw journal draft for this email. Edit it to be polished, concise, and on-brand while keeping my voice:\n\n${journalBody}`,
      });
      messages.push({
        role: "assistant",
        content: `---REFINED EMAIL---\n${previousDraft}`,
      });
      messages.push({
        role: "user",
        content: `Revision pass ${passNumber}. Apply this feedback and re-edit:\n\n${refinementPrompt}\n\nReturn the full revised email and updated strategy notes.`,
      });
    } else {
      messages.push({
        role: "user",
        content: `Here is my raw journal draft for this email. Edit it to be polished, concise, and on-brand while keeping my voice:\n\n${journalBody}`,
      });
    }

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
        messages,
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
      throw new Error("AI refinement failed");
    }

    const data = await response.json();
    if (!data.content || !data.content[0]?.text) {
      throw new Error("Empty response from Anthropic API");
    }
    const content = data.content[0].text;

    const emailMatch = content.match(/---REFINED EMAIL---\s*([\s\S]*?)(?=---STRATEGY NOTES---|$)/i);
    const strategyMatch = content.match(/---STRATEGY NOTES---\s*([\s\S]*?)$/i);

    return new Response(
      JSON.stringify({
        refinedEmail: emailMatch?.[1]?.trim() || content,
        strategyNotes: strategyMatch?.[1]?.trim() || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("refine-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
