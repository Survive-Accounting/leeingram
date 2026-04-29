// AI clustering / categorization of beta feedback.
// Direct Anthropic API per project rule (no Lovable AI gateway).
// Lee-only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com"];
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Auth
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const email = (user?.email ?? "").toLowerCase();
    if (!LEE_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { items, force } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (items.length > 200) {
      return new Response(JSON.stringify({ error: "Max 200 items per call" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Cache lookup
    const cacheKey = "beta_dashboard_cluster_" + (await sha256(JSON.stringify(items.map((i: any) => i.id).sort())));
    if (!force) {
      const { data: cached } = await db.from("ai_generation_cache")
        .select("response_json,created_at")
        .eq("cache_key", cacheKey).eq("status", "success").maybeSingle();
      if (cached?.response_json) {
        const ageMin = (Date.now() - new Date(cached.created_at).getTime()) / 60000;
        if (ageMin < 60) {
          return new Response(JSON.stringify({ ...cached.response_json, cached: true, ageMin: Math.round(ageMin) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const systemPrompt = `You are an analyst categorizing student beta feedback for an accounting exam prep platform.

For each feedback item, assign:
- category: one of bug | confusion | feature_request | content_gap | praise | pricing | auth_issue | performance | other
- severity: low | medium | high (high = blocks usage or angry student)
- suggested_action: one short sentence describing the smallest fix
- theme_id: a short snake_case identifier grouping related items (you invent these)

Then list up to 8 distinct themes with: id, label (3-6 words), summary (one sentence), count, representative_ids (up to 5 item ids that best illustrate the theme).

Return ONLY valid JSON in this exact shape:
{
  "items": [{"id":"...","category":"...","severity":"...","suggested_action":"...","theme_id":"..."}],
  "themes": [{"id":"...","label":"...","summary":"...","count":N,"representative_ids":["..."]}]
}`;

    const userPrompt = `Categorize these ${items.length} feedback items:\n\n${JSON.stringify(items, null, 2)}`;

    const t0 = Date.now();
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const latencyMs = Date.now() - t0;

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Anthropic error:", resp.status, errText);
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}: ${errText.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiData = await resp.json();
    const text = apiData?.content?.[0]?.text ?? "";

    // Extract JSON
    let parsed: any = null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch (e) { console.error("JSON parse fail", e); }
    }
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Could not parse AI response", raw: text.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache it
    await db.from("ai_generation_cache").upsert({
      cache_key: cacheKey,
      tool_type: "beta_dashboard",
      action_type: "cluster",
      model_version: ANTHROPIC_MODEL,
      response_text: text,
      response_json: parsed,
      status: "success",
      latency_ms: latencyMs,
    }, { onConflict: "cache_key" });

    await db.from("ai_request_log").insert({
      cache_key: cacheKey,
      cache_hit: false,
      tool_type: "beta_dashboard",
      action_type: "cluster",
      model_used: ANTHROPIC_MODEL,
      latency_ms: latencyMs,
      user_id: user?.id,
    });

    return new Response(JSON.stringify({ ...parsed, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("beta-dashboard-summarize error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
