import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      provider,
      model,
      messages,
      response_format_json_schema,
      temperature = 0.2,
      max_output_tokens = 3000,
      source_problem_id,
    } = await req.json();

    if (!provider || !messages || !source_problem_id) {
      throw new Error("Missing required fields: provider, messages, source_problem_id");
    }

    const startTime = Date.now();
    let aiResponse: any;
    let tokenUsage: any = {};

    if (provider === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

      const body: any = {
        model: model || "gpt-4.1",
        input: messages,
        temperature,
        max_output_tokens,
      };

      if (response_format_json_schema) {
        body.text = {
          format: {
            type: "json_schema",
            ...response_format_json_schema,
          },
        };
      }

      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const outputText = data.output?.find((o: any) => o.type === "message")?.content?.find((c: any) => c.type === "output_text")?.text;
      aiResponse = outputText || "";
      tokenUsage = data.usage || {};

    } else if (provider === "lovable") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const body: any = {
        model: model || "google/gemini-2.5-flash",
        messages,
        temperature,
      };

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lovable AI error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      aiResponse = data.choices?.[0]?.message?.content ?? "";
      tokenUsage = data.usage || {};

    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const latencyMs = Date.now() - startTime;

    // Parse JSON response
    let parsed: any = null;
    let parseError: string | null = null;
    try {
      // Strip markdown fences if present
      let cleaned = aiResponse;
      if (typeof cleaned === "string") {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      }
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parseError = e.message;
    }

    // Log to activity_log
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    await sb.from("activity_log").insert({
      actor_type: "ai",
      entity_type: "source_problem",
      entity_id: source_problem_id,
      event_type: "ai_generation_test",
      severity: parseError ? "warn" : "info",
      payload_json: {
        provider,
        model: model || (provider === "openai" ? "gpt-4.1" : "google/gemini-2.5-flash"),
        token_usage: tokenUsage,
        generation_time_ms: latencyMs,
        parse_error: parseError,
      },
    });

    return new Response(JSON.stringify({
      parsed,
      raw: aiResponse,
      parse_error: parseError,
      token_usage: tokenUsage,
      generation_time_ms: latencyMs,
      provider,
      model: model || (provider === "openai" ? "gpt-4.1" : "google/gemini-2.5-flash"),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-ai-output error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
