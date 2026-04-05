import { postToSlack } from "./slack.ts";

// Anthropic pricing per 1M tokens (as of 2025)
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

export function calculateAnthropicCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = ANTHROPIC_PRICING[model] || DEFAULT_PRICING;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export function calculateHctiCost(imageCount: number): number {
  return imageCount * 0.002;
}

export async function logCost(
  supabase: any,
  params: {
    operation_type: string;
    asset_code?: string;
    topic_id?: string;
    chapter_id?: string;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    image_count?: number;
    metadata?: any;
  },
) {
  const estimated_cost_usd = params.input_tokens
    ? calculateAnthropicCost(
        params.input_tokens,
        params.output_tokens || 0,
        params.model || "claude-sonnet-4-20250514",
      )
    : params.image_count
      ? calculateHctiCost(params.image_count)
      : null;

  // High cost warning
  if (estimated_cost_usd && estimated_cost_usd > 0.5) {
    console.warn(
      `⚠️ High cost alert: ${params.operation_type} on ${params.asset_code || "N/A"} cost $${estimated_cost_usd.toFixed(4)}`,
    );
    postToSlack(
      `⚠️ *High cost alert*: ${params.operation_type} on ${params.asset_code || "N/A"} cost $${estimated_cost_usd.toFixed(4)} (model: ${params.model || "unknown"})`,
    ).catch(() => {});
  }

  try {
    await supabase.from("ai_cost_log").insert({
      ...params,
      estimated_cost_usd,
    });
  } catch (e) {
    console.error("Failed to log cost:", e);
  }
}
