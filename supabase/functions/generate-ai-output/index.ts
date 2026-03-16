import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  // Helper to log generation events when run_id is provided
  let eventSeq = 100; // Start at 100 to not collide with frontend seqs
  async function logEvent(
    runId: string | null,
    scope: string,
    level: string,
    eventType: string,
    message: string,
    payload?: any
  ) {
    if (!runId) return;
    eventSeq++;
    try {
      await sb.from("generation_events").insert({
        run_id: runId,
        seq: eventSeq,
        scope,
        level,
        event_type: eventType,
        message,
        payload_json: payload ?? null,
      });
    } catch (_) { /* swallow */ }
  }

  try {
    const {
      provider,
      model,
      messages,
      response_format_json_schema,
      temperature = 0.2,
      max_output_tokens = 3000,
      source_problem_id,
      run_id,
    } = await req.json();

    if (!provider || !messages) {
      throw new Error("Missing required fields: provider, messages");
    }

    const selectedModel = model || (provider === "openai" ? "gpt-4.1" : "google/gemini-2.5-flash");

    // ── Log: FETCH_SOURCE (context about what we received) ──
    await logEvent(run_id, "backend", "info", "FETCH_SOURCE", "Source data received", {
      source_problem_id,
      provider,
      model: selectedModel,
      message_count: messages.length,
      total_prompt_chars: messages.reduce((s: number, m: any) => s + (m.content?.length ?? 0), 0),
    });

    // ── Log: BUILD_PROMPT ──
    const promptSummary = messages.map((m: any) => ({
      role: m.role,
      content_length: m.content?.length ?? 0,
      content_preview: typeof m.content === "string" ? m.content.slice(0, 500) : "",
    }));
    await logEvent(run_id, "backend", "info", "BUILD_PROMPT", "Prompt constructed", {
      provider,
      model: selectedModel,
      temperature,
      max_output_tokens,
      json_schema_mode: !!response_format_json_schema,
      messages_summary: promptSummary,
    });

    // ── Legacy activity_log ──
    if (source_problem_id) {
      await sb.from("activity_log").insert({
        actor_type: "ai",
        entity_type: "source_problem",
        entity_id: source_problem_id,
        event_type: "ai_generate_started",
        severity: "info",
        payload_json: { provider, model: selectedModel, run_id },
      });
    }

    // ── Log: AI_REQUEST ──
    await logEvent(run_id, "ai", "info", "AI_REQUEST", `Calling ${provider}/${selectedModel}`, {
      provider,
      model: selectedModel,
      temperature,
      max_output_tokens,
    });

    const startTime = Date.now();
    let aiResponse: any;
    let tokenUsage: any = {};

    if (provider === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

      const body: any = {
        model: selectedModel,
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
        model: selectedModel,
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

    // ── Log: AI_RESPONSE ──
    const responseStr = typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse);
    await logEvent(run_id, "ai", "info", "AI_RESPONSE", `Response received (${latencyMs}ms, ${responseStr.length} chars)`, {
      response_length_chars: responseStr.length,
      response_text_first_1000: responseStr.slice(0, 1000),
      response_text_last_1000: responseStr.length > 1000 ? responseStr.slice(-1000) : undefined,
      latency_ms: latencyMs,
      token_usage: tokenUsage,
    });

    // ── Parse JSON response ──
    await logEvent(run_id, "backend", "info", "PARSE_JSON_START", "Attempting JSON parse");

    let parsed: any = null;
    let parseError: string | null = null;
    try {
      let cleaned = aiResponse;
      if (typeof cleaned === "string") {
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      }
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parseError = e.message;
    }

    const topLevelKeys = parsed ? Object.keys(parsed) : [];
    await logEvent(run_id, "backend", parseError ? "error" : "info", "PARSE_JSON_END",
      parseError ? `JSON parse failed: ${parseError}` : `Parsed OK, keys: ${topLevelKeys.join(", ")}`,
      { parse_success: !parseError, parse_error: parseError, extracted_top_level_keys: topLevelKeys }
    );

    // ── Validate canonical JE schema if parsed ──
    await logEvent(run_id, "validator", "info", "VALIDATE_SCHEMA_START", "Running canonical schema validation");

    let schemaValid = true;
    let schemaErrors: string[] = [];
    if (parsed && !parseError) {
      const validation = validateCanonicalSchema(parsed);
      schemaValid = validation.valid;
      schemaErrors = validation.errors;
    }

    await logEvent(run_id, "validator", schemaValid ? "info" : "warn", "VALIDATE_SCHEMA_END",
      schemaValid ? "Schema valid" : `Schema issues: ${schemaErrors.length}`,
      { schema_name: "canonical_je", success: schemaValid, schema_errors: schemaErrors }
    );

    // ── Legacy activity_log: ai_generate_completed ──
    const rawSnippet = typeof aiResponse === "string" ? aiResponse.slice(0, 2000) : JSON.stringify(aiResponse).slice(0, 2000);
    await sb.from("activity_log").insert({
      actor_type: "ai",
      entity_type: "source_problem",
      entity_id: source_problem_id,
      event_type: "ai_generate_completed",
      severity: parseError ? "warn" : "info",
      payload_json: {
        provider,
        model: selectedModel,
        token_usage: tokenUsage,
        generation_time_ms: latencyMs,
        parse_error: parseError,
        schema_valid: schemaValid,
        schema_errors: schemaErrors.length > 0 ? schemaErrors : undefined,
        raw_output_snippet: rawSnippet,
        parsed_json_snippet: parsed ? JSON.stringify(parsed).slice(0, 2000) : null,
        run_id,
      },
    });

    return new Response(JSON.stringify({
      parsed,
      raw: aiResponse,
      parse_error: parseError,
      schema_valid: schemaValid,
      schema_errors: schemaErrors,
      token_usage: tokenUsage,
      generation_time_ms: latencyMs,
      provider,
      model: selectedModel,
      run_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-ai-output error:", e);

    // Try to log error
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.source_problem_id) {
        await sb.from("activity_log").insert({
          actor_type: "ai",
          entity_type: "source_problem",
          entity_id: body.source_problem_id,
          event_type: "ai_generate_completed",
          severity: "error",
          payload_json: { error: e.message, provider: body.provider, model: body.model, run_id: body.run_id },
        });
      }
      // Log to generation_events if run_id available
      if (body.run_id) {
        await logEvent(body.run_id, "backend", "error", "BACKEND_ERROR", e.message, { stack: e.stack?.slice(0, 1000) });
      }
    } catch (_) { /* swallow logging errors */ }

    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function validateCanonicalSchema(parsed: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sections = parsed.scenario_sections || parsed.teaching_aids?.scenario_sections;
  if (!sections) return { valid: true, errors: [] };
  if (!Array.isArray(sections)) {
    errors.push("scenario_sections must be an array");
    return { valid: false, errors };
  }
  for (let si = 0; si < sections.length; si++) {
    const sc = sections[si];
    if (!sc.label) errors.push(`scenario_sections[${si}] missing 'label'`);
    const entries = sc.entries_by_date;
    if (!entries || !Array.isArray(entries)) {
      errors.push(`scenario_sections[${si}] missing 'entries_by_date' array`);
      continue;
    }
    for (let ei = 0; ei < entries.length; ei++) {
      const entry = entries[ei];
      if (!entry.entry_date && entry.entry_date !== "") {
        errors.push(`scenario_sections[${si}].entries_by_date[${ei}] missing 'entry_date'`);
      }
      if (!entry.rows || !Array.isArray(entry.rows)) {
        errors.push(`scenario_sections[${si}].entries_by_date[${ei}] missing 'rows' array`);
        continue;
      }
      for (let ri = 0; ri < entry.rows.length; ri++) {
        const row = entry.rows[ri];
        if (!row.account_name && row.account_name !== "") {
          errors.push(`Row [${si}][${ei}][${ri}] missing 'account_name'`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
