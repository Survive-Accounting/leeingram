// Shared server-side helper for all student-facing tutor AI calls.
//
// Responsibilities:
//   1. Compute deterministic cache_key from problem + tool + action + versions.
//   2. Hit ai_generation_cache first — return completed rows immediately.
//   3. If a row is `pending`, poll briefly so concurrent users dedupe.
//   4. Otherwise insert a pending row, call OpenAI, save result, log it.
//   5. Auto-fall back from DEFAULT_AI_MODEL to FALLBACK_AI_MODEL on 404.
//   6. Janitor: any pending row older than 60s is treated as stale.
//
// API key (OPENAI_API_KEY) is read from Deno.env — never returned to clients.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  DEFAULT_AI_MODEL,
  FALLBACK_AI_MODEL,
  PROMPT_VERSION,
  modelForAction,
  reasoningForAction,
  type ReasoningEffort,
} from "./aiConfig.ts";

export type GenerateTutorArgs = {
  toolType: string;
  actionType: string;
  systemPrompt: string;
  userPrompt: string;
  // Context for cache key — anything that materially changes the answer:
  problemId?: string | null;
  chapterId?: string | null;
  courseId?: string | null;
  problemVersion?: string | null;   // e.g. teaching_assets.updated_at iso
  solutionVersion?: string | null;
  // Telemetry
  userId?: string | null;
  sessionId?: string | null;
  // Generation knobs
  maxTokens?: number;
  // Skip cache entirely (e.g. per-student challenge follow-ups).
  skipCache?: boolean;
};

export type GenerateTutorResult = {
  success: true;
  cached: boolean;
  responseText: string;
  modelUsed: string;
  cacheKey: string;
} | {
  success: false;
  error: string;
  status?: number;
};

const STALE_PENDING_SECONDS = 60;
const POLL_INTERVAL_MS = 400;
const MAX_POLL_MS = 25_000;

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildCacheKey(args: GenerateTutorArgs): Promise<string> {
  const model = modelForAction(args.actionType);
  const parts = [
    args.courseId ?? "",
    args.chapterId ?? "",
    args.problemId ?? "",
    args.toolType,
    args.actionType,
    PROMPT_VERSION,
    model,
    args.problemVersion ?? "",
    args.solutionVersion ?? "",
  ].join("|");
  return await sha256Hex(parts);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function logRequest(
  sb: SupabaseClient,
  row: Record<string, unknown>,
) {
  try {
    await sb.from("ai_request_log").insert(row as any);
  } catch (e) {
    console.warn("ai_request_log insert failed:", (e as Error)?.message);
  }
}

async function callOpenAI(args: {
  model: string;
  reasoning: ReasoningEffort;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  apiKey: string;
}): Promise<{
  ok: true;
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  modelUsed: string;
} | {
  ok: false;
  status: number;
  error: string;
}> {
  const body: Record<string, unknown> = {
    model: args.model,
    max_completion_tokens: args.maxTokens,
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userPrompt },
    ],
  };
  // gpt-5.x reasoning models accept `reasoning_effort`. Older models silently ignore it.
  body.reasoning_effort = args.reasoning;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: res.status, error: errText.slice(0, 800) };
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
  return {
    ok: true,
    text,
    promptTokens: data?.usage?.prompt_tokens,
    completionTokens: data?.usage?.completion_tokens,
    totalTokens: data?.usage?.total_tokens,
    modelUsed: data?.model ?? args.model,
  };
}

export async function generateTutorResponse(
  args: GenerateTutorArgs,
): Promise<GenerateTutorResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!OPENAI_API_KEY) {
    return { success: false, error: "OPENAI_API_KEY not configured", status: 500 };
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const cacheKey = await buildCacheKey(args);
  const reasoning = reasoningForAction(args.actionType);
  const desiredModel = modelForAction(args.actionType);
  const maxTokens = args.maxTokens ?? 2000;
  const skipCache = !!args.skipCache;

  // ---- 1. Cache lookup ----
  if (!skipCache) {
    const { data: existing } = await sb
      .from("ai_generation_cache")
      .select("status, response_text, created_at, model_version")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (existing) {
      if (existing.status === "completed" && existing.response_text) {
        await logRequest(sb, {
          cache_key: cacheKey,
          cache_hit: true,
          tool_type: args.toolType,
          action_type: args.actionType,
          model_used: existing.model_version,
          reasoning_effort: reasoning,
          user_id: args.userId ?? null,
          session_id: args.sessionId ?? null,
          problem_id: args.problemId ?? null,
          chapter_id: args.chapterId ?? null,
        });
        return {
          success: true,
          cached: true,
          responseText: existing.response_text,
          modelUsed: existing.model_version,
          cacheKey,
        };
      }

      if (existing.status === "pending") {
        const ageSec = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
        if (ageSec < STALE_PENDING_SECONDS) {
          // Poll for the in-flight generation to complete.
          const deadline = Date.now() + MAX_POLL_MS;
          while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            const { data: poll } = await sb
              .from("ai_generation_cache")
              .select("status, response_text, model_version")
              .eq("cache_key", cacheKey)
              .maybeSingle();
            if (poll?.status === "completed" && poll.response_text) {
              await logRequest(sb, {
                cache_key: cacheKey,
                cache_hit: true,
                tool_type: args.toolType,
                action_type: args.actionType,
                model_used: poll.model_version,
                reasoning_effort: reasoning,
                user_id: args.userId ?? null,
                session_id: args.sessionId ?? null,
                problem_id: args.problemId ?? null,
                chapter_id: args.chapterId ?? null,
              });
              return {
                success: true,
                cached: true,
                responseText: poll.response_text,
                modelUsed: poll.model_version,
                cacheKey,
              };
            }
            if (poll?.status === "failed") break;
          }
          return {
            success: false,
            error: "Another request is still generating this response. Try again in a moment.",
            status: 409,
          };
        }
        // Stale pending — claim it by overwriting below.
      }
      // status === 'failed' or stale pending: fall through and regenerate.
    }
  }

  // ---- 2. Reserve pending row (atomic upsert on unique cache_key) ----
  if (!skipCache) {
    const { error: upsertErr } = await sb
      .from("ai_generation_cache")
      .upsert(
        {
          cache_key: cacheKey,
          course_id: args.courseId ?? null,
          chapter_id: args.chapterId ?? null,
          problem_id: args.problemId ?? null,
          tool_type: args.toolType,
          action_type: args.actionType,
          prompt_version: PROMPT_VERSION,
          model_version: desiredModel,
          problem_version: args.problemVersion ?? null,
          solution_version: args.solutionVersion ?? null,
          status: "pending",
          response_text: null,
          error_message: null,
          generated_by_user_id: args.userId ?? null,
          session_id: args.sessionId ?? null,
        } as any,
        { onConflict: "cache_key" },
      );
    if (upsertErr) {
      console.warn("cache pending upsert failed:", upsertErr.message);
    }
  }

  // ---- 3. Call OpenAI (with auto-fallback on bad-model 404) ----
  const startedAt = Date.now();
  let attempt = await callOpenAI({
    model: desiredModel,
    reasoning,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    maxTokens,
    apiKey: OPENAI_API_KEY,
  });

  let modelUsed = desiredModel;
  if (!attempt.ok && attempt.status === 404 && desiredModel !== FALLBACK_AI_MODEL) {
    console.warn(
      `Model "${desiredModel}" not available — falling back to "${FALLBACK_AI_MODEL}". Error: ${attempt.error}`,
    );
    attempt = await callOpenAI({
      model: FALLBACK_AI_MODEL,
      reasoning,
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      maxTokens,
      apiKey: OPENAI_API_KEY,
    });
    modelUsed = FALLBACK_AI_MODEL;
  }
  const latencyMs = Date.now() - startedAt;

  if (!attempt.ok) {
    if (!skipCache) {
      await sb
        .from("ai_generation_cache")
        .update({
          status: "failed",
          error_message: `OpenAI ${attempt.status}: ${attempt.error}`.slice(0, 1000),
          latency_ms: latencyMs,
        } as any)
        .eq("cache_key", cacheKey);
    }
    await logRequest(sb, {
      cache_key: cacheKey,
      cache_hit: false,
      tool_type: args.toolType,
      action_type: args.actionType,
      model_used: modelUsed,
      reasoning_effort: reasoning,
      latency_ms: latencyMs,
      user_id: args.userId ?? null,
      session_id: args.sessionId ?? null,
      problem_id: args.problemId ?? null,
      chapter_id: args.chapterId ?? null,
      error_message: `OpenAI ${attempt.status}: ${attempt.error}`.slice(0, 500),
    });
    // Pass-through friendly errors for 402/429
    if (attempt.status === 429) {
      return { success: false, error: "Rate limit hit. Try again in a moment.", status: 429 };
    }
    if (attempt.status === 402) {
      return { success: false, error: "AI credits exhausted.", status: 402 };
    }
    return { success: false, error: attempt.error, status: attempt.status };
  }

  if (!attempt.text) {
    if (!skipCache) {
      await sb
        .from("ai_generation_cache")
        .update({
          status: "failed",
          error_message: "Empty response",
          latency_ms: latencyMs,
        } as any)
        .eq("cache_key", cacheKey);
    }
    return { success: false, error: "Empty response from AI", status: 500 };
  }

  // ---- 4. Save completed cache row ----
  if (!skipCache) {
    await sb
      .from("ai_generation_cache")
      .update({
        status: "completed",
        response_text: attempt.text,
        model_version: modelUsed,
        prompt_tokens: attempt.promptTokens ?? null,
        completion_tokens: attempt.completionTokens ?? null,
        total_tokens: attempt.totalTokens ?? null,
        latency_ms: latencyMs,
        error_message: null,
      } as any)
      .eq("cache_key", cacheKey);
  }

  await logRequest(sb, {
    cache_key: cacheKey,
    cache_hit: false,
    tool_type: args.toolType,
    action_type: args.actionType,
    model_used: modelUsed,
    reasoning_effort: reasoning,
    prompt_tokens: attempt.promptTokens ?? null,
    completion_tokens: attempt.completionTokens ?? null,
    total_tokens: attempt.totalTokens ?? null,
    latency_ms: latencyMs,
    user_id: args.userId ?? null,
    session_id: args.sessionId ?? null,
    problem_id: args.problemId ?? null,
    chapter_id: args.chapterId ?? null,
  });

  return {
    success: true,
    cached: false,
    responseText: attempt.text,
    modelUsed,
    cacheKey,
  };
}
