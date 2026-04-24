import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { postToSlack } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MASCOT_EMOJI: Record<string, string> = {
  razorback: "🐗", razorbacks: "🐗",
  tiger: "🐅", tigers: "🐅",
  bear: "🐻", bears: "🐻",
  bulldog: "🐶", bulldogs: "🐶",
  eagle: "🦅", eagles: "🦅",
  wildcat: "🐱", wildcats: "🐱",
  gator: "🐊", gators: "🐊",
  longhorn: "🐂", longhorns: "🐂",
  buckeye: "🌰", buckeyes: "🌰",
  wolverine: "🐺", wolverines: "🐺",
  panther: "🐆", panthers: "🐆",
  hawk: "🦅", hawks: "🦅",
  cardinal: "🐦", cardinals: "🐦",
  rebel: "🎩", rebels: "🎩",
};

function pickMascotEmoji(mascot?: string | null): string {
  if (!mascot) return "";
  const key = mascot.toLowerCase().trim().split(/\s+/).pop() || "";
  return MASCOT_EMOJI[key] ?? "";
}

async function callOpenAI(emailDomain: string): Promise<any | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.warn("OPENAI_API_KEY missing — skipping enrichment");
    return null;
  }

  const prompt = `Given the university email domain: ${emailDomain}

Return a JSON object with:
- clean_name (official short name, no campus suffixes like Fayetteville unless necessary)
- confidence_score (0–100)
- course_codes (array of 4 strings for Intro 1, Intro 2, Intermediate 1, Intermediate 2 — if unknown, use generic placeholders)
- mascot
- fight_song_or_cheer (short phrase if known, else null)
- colors (array of up to 3 hex codes, ranked from most prominent to least prominent — 3rd is optional)

Rules:
- Prefer the most commonly used public name (e.g., 'University of Arkansas' instead of 'University of Arkansas – Fayetteville')
- Keep output concise and best-guess (does not need to be perfect)
- If uncertain, still provide a reasonable guess with lower confidence_score

Return ONLY valid JSON.`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You return ONLY valid JSON. No prose." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      console.error("OpenAI enrichment failed:", resp.status, await resp.text());
      return null;
    }
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(text);
  } catch (e) {
    console.error("OpenAI enrichment error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email_domain, campus_id } = await req.json();
    if (!email_domain || typeof email_domain !== "string") {
      return new Response(JSON.stringify({ error: "email_domain required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const enriched = await callOpenAI(email_domain);

    const cleanName = enriched?.clean_name ?? null;
    const confidence = typeof enriched?.confidence_score === "number"
      ? Math.max(0, Math.min(100, Math.round(enriched.confidence_score)))
      : null;
    const mascot = enriched?.mascot ?? null;
    const cheer = enriched?.fight_song_or_cheer ?? null;
    const colors: string[] = Array.isArray(enriched?.colors) ? enriched.colors.slice(0, 3) : [];
    const courseCodes: string[] = Array.isArray(enriched?.course_codes) ? enriched.course_codes.slice(0, 4) : [];

    // Update campus row (if id provided)
    if (campus_id) {
      await supabase.from("campuses").update({
        auto_name: cleanName,
        confidence_score: confidence,
        mascot,
        cheer,
        color_primary: colors[0] ?? null,
        color_secondary: colors[1] ?? null,
        color_tertiary: colors[2] ?? null,
        course_codes_json: courseCodes.length ? courseCodes : null,
        status: "unverified",
        enriched_at: new Date().toISOString(),
      }).eq("id", campus_id);
    }

    // Build Slack message
    const emoji = pickMascotEmoji(mascot);
    const lowConf = confidence !== null && confidence < 70 ? " ⚠️" : "";
    const courseLines = (courseCodes.length ? courseCodes : ["—", "—", "—", "—"])
      .map((c) => `• ${c}`).join("\n");
    const colorLines = [
      colors[0] ? `1. ${colors[0]}` : null,
      colors[1] ? `2. ${colors[1]}` : null,
      colors[2] ? `3. ${colors[2]}` : null,
    ].filter(Boolean).join("\n");

    const dashUrl = `https://learn.surviveaccounting.com/admin/campus-ops?domain=${encodeURIComponent(email_domain)}`;

    const message = [
      `🚨 Founding Student Detected at New Campus! Let's Go!!!!`,
      ``,
      `Domain: ${email_domain}`,
      `Name (AI): ${cleanName ?? "—"} ${emoji}`.trim(),
      `AI Confidence: ${confidence ?? "—"}%${lowConf}`,
      ``,
      `Course Codes:`,
      courseLines,
      ``,
      `Mascot: ${mascot ?? "—"} ${emoji}`.trim(),
      `Fight Song/Cheer: ${cheer ?? "—"}`,
      ``,
      `School Colors (ranked):`,
      colorLines || "—",
      ``,
      `Open Campus-Ops Dashboard: ${dashUrl}`,
    ].join("\n");

    await postToSlack(message);

    return new Response(JSON.stringify({ ok: true, enriched: !!enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("enrich-new-campus error:", err);
    // Fail silently per spec — still return 200 so caller doesn't block.
    return new Response(JSON.stringify({ ok: false, error: err?.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
