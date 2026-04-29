// Centralized AI model configuration for all student-facing tutor responses.
// Change values here to globally swap models, reasoning effort, or invalidate the
// shared response cache (bump PROMPT_VERSION).
//
// IMPORTANT: Do NOT hard-code model names in individual edge functions or in any
// frontend file. All tutor AI must flow through generateTutorResponse() which
// reads from this file.

export const DEFAULT_AI_MODEL = "gpt-5.5";

// Used automatically if DEFAULT_AI_MODEL is rejected by OpenAI (e.g. 404 model
// not found). When the real gpt-5.5 ships, no code change required.
export const FALLBACK_AI_MODEL = "gpt-5";

// Future cost-cut tiers — config-ready, not active. Flip individual actions in
// REASONING_BY_ACTION / MODEL_OVERRIDES_BY_ACTION when we want to downgrade.
// export const CHEAP_MODEL = "gpt-5.4-mini";
// export const MID_MODEL   = "gpt-5.4";

// Optional: per-action model overrides (leave empty for now — beta uses one model)
export const MODEL_OVERRIDES_BY_ACTION: Record<string, string> = {};

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";
export const FULL_WALKTHROUGH_REASONING_EFFORT: ReasoningEffort = "medium";
export const DEFAULT_VERBOSITY = "medium";

// Action-type → reasoning effort map. Anything not listed falls back to DEFAULT.
export const REASONING_BY_ACTION: Record<string, ReasoningEffort> = {
  // survive-this prompt_type values
  hint: "low",
  setup: "low",
  full_solution: "medium",
  walk_through: FULL_WALKTHROUGH_REASONING_EFFORT,
  journal_entries: "medium",
  challenge: "low",
  challenge_followup: "low",
  similar_problem: "low",
  memorize: "low",
  financial_statements: "low",
  real_world: "low",
  professor_tricks: "low",
  the_why: "low",
  strategy: "low",

  // explain-solution-part / explain-this-solution
  explain_part: "medium",
  explain_solution: "medium",
};

// Bump this any time prompts change in a way that should invalidate the shared
// response cache. Old cached rows stay in the table but a new cache_key is computed.
export const PROMPT_VERSION = "v1";

export function modelForAction(actionType: string): string {
  return MODEL_OVERRIDES_BY_ACTION[actionType] ?? DEFAULT_AI_MODEL;
}

export function reasoningForAction(actionType: string): ReasoningEffort {
  return REASONING_BY_ACTION[actionType] ?? DEFAULT_REASONING_EFFORT;
}
