/**
 * Unified Answer Package Pipeline
 * 
 * normalize_validate_persist_answer_package()
 * 
 * ALL AI generation paths (Lovable + OpenAI) MUST call this function.
 * No direct writes to answer_packages from provider-specific code.
 */

import { supabase } from "@/integrations/supabase/client";
import { runValidation, hasFailures, type AnswerPackageData, type ValidationResult } from "@/lib/validation";
import { autoFixDatesInAccountNames, autoFixNarrativePrefixes } from "@/lib/validation/jeValidators";
import { logActivity } from "@/lib/activityLogger";

export interface AnswerPackageDraft {
  source_problem_id: string;
  version: number;
  generator: "ai" | "mixed" | "manual";
  answer_payload: Record<string, any>;
  extracted_inputs?: Record<string, any>;
  computed_values?: Record<string, any>;
  output_type?: string;
  /** Provider info for logging */
  provider?: string;
  model?: string;
  token_usage?: any;
  generation_time_ms?: number;
  /** Extra context for the activity log */
  log_event_type?: string;
  log_extra_payload?: Record<string, any>;
}

export interface PipelineResult {
  package: any;
  validation_results: ValidationResult[];
  status: string;
  normalized: boolean;
}

/**
 * 1) Normalize JE rows (strip narrative prefixes, move dates to entry_date, parse amounts)
 * 2) Run validators (hard fail + warnings)
 * 3) Set status = needs_review if any hard fail
 * 4) Persist with validation_results stored
 * 5) Log provider/model + validation outcome
 */
export async function normalizeValidatePersistAnswerPackage(
  draft: AnswerPackageDraft
): Promise<PipelineResult> {
  let payload = { ...draft.answer_payload };
  let normalized = false;

  // ── Step 1: Normalize JE rows ──
  const jeSections = payload?.teaching_aids?.journal_entries;
  if (Array.isArray(jeSections) && jeSections.length > 0) {
    // 1a: Strip dates from account_name → move to entry_date
    const dateFix = autoFixDatesInAccountNames(jeSections);
    let sections = dateFix.fixed ? dateFix.sections : jeSections;

    // 1b: Strip narrative prefixes (e.g. "Issue Bonds: Cash" → "Cash", prefix → memo)
    const narrativeFix = autoFixNarrativePrefixes(sections);
    if (narrativeFix.fixed) sections = narrativeFix.sections;

    // 1c: Ensure each line has proper debit/credit (not both, parse amounts)
    for (const section of sections) {
      if (!Array.isArray(section.lines)) continue;
      for (const line of section.lines) {
        // Parse string amounts to numbers
        if (typeof line.debit === "string") line.debit = parseFloat(line.debit.replace(/[$,]/g, "")) || null;
        if (typeof line.credit === "string") line.credit = parseFloat(line.credit.replace(/[$,]/g, "")) || null;

        // Ensure mutual exclusivity: if both set, zero out the smaller
        const hasDebit = line.debit != null && line.debit !== 0;
        const hasCredit = line.credit != null && line.credit !== 0;
        if (hasDebit && hasCredit) {
          // Keep the larger, zero the smaller (likely a parsing error)
          if ((line.debit ?? 0) >= (line.credit ?? 0)) {
            line.credit = null;
          } else {
            line.debit = null;
          }
        }

        // Strip embedded dollar amounts from account_name
        if (line.account_name) {
          line.account_name = line.account_name
            .replace(/\s*\$[\d,]+(?:\.\d+)?\s*/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
        }
      }
    }

    normalized = dateFix.fixed || narrativeFix.fixed;
    payload = {
      ...payload,
      teaching_aids: {
        ...(payload.teaching_aids ?? {}),
        journal_entries: sections,
      },
    };
  }

  // ── Step 2: Run validators ──
  const pkgData: AnswerPackageData = {
    answer_payload: payload,
    extracted_inputs: draft.extracted_inputs ?? {},
    computed_values: draft.computed_values ?? {},
  };
  const validationResults = runValidation(pkgData);

  // ── Step 3: Determine status ──
  const status = hasFailures(validationResults) ? "needs_review" : "drafted";

  // ── Step 4: Persist ──
  const { data: newPkg, error: insertErr } = await supabase
    .from("answer_packages")
    .insert({
      source_problem_id: draft.source_problem_id,
      version: draft.version,
      generator: draft.generator as any,
      answer_payload: payload,
      extracted_inputs: draft.extracted_inputs ?? {},
      computed_values: draft.computed_values ?? {},
      validation_results: validationResults as any,
      status: status as any,
      output_type: (draft.output_type ?? "mixed") as any,
    } as any)
    .select("*")
    .single();

  if (insertErr) throw insertErr;

  // ── Step 5: Log provider/model + validation outcome ──
  const failCount = validationResults.filter(r => r.status === "fail").length;
  const warnCount = validationResults.filter(r => r.status === "warn").length;
  const passCount = validationResults.filter(r => r.status === "pass").length;

  await logActivity({
    actor_type: "ai",
    entity_type: "source_problem",
    entity_id: draft.source_problem_id,
    event_type: draft.log_event_type ?? "answer_package_created",
    severity: failCount > 0 ? "warn" : "info",
    payload_json: {
      package_id: newPkg.id,
      version: draft.version,
      provider: draft.provider ?? "unknown",
      model: draft.model ?? "unknown",
      token_usage: draft.token_usage,
      generation_time_ms: draft.generation_time_ms,
      status,
      normalized,
      validation_summary: { pass: passCount, fail: failCount, warn: warnCount },
      ...(draft.log_extra_payload ?? {}),
    },
  });

  return { package: newPkg, validation_results: validationResults, status, normalized };
}

/**
 * Shorthand for saving an unparseable AI response as needs_review.
 */
export async function persistUnparseablePackage(
  sourceProblemId: string,
  version: number,
  rawOutput: string,
  extras?: { extracted_inputs?: any; computed_values?: any; output_type?: string; provider?: string; model?: string },
): Promise<any> {
  const { data: newPkg, error } = await supabase
    .from("answer_packages")
    .insert({
      source_problem_id: sourceProblemId,
      version,
      generator: "ai" as any,
      answer_payload: { _raw_unparsed: rawOutput },
      extracted_inputs: extras?.extracted_inputs ?? {},
      computed_values: extras?.computed_values ?? {},
      validation_results: [] as any,
      status: "needs_review" as any,
      output_type: (extras?.output_type ?? "mixed") as any,
    } as any)
    .select("*")
    .single();

  if (error) throw error;

  await logActivity({
    actor_type: "ai",
    entity_type: "source_problem",
    entity_id: sourceProblemId,
    event_type: "answer_package_unparseable",
    severity: "error",
    payload_json: {
      package_id: newPkg.id,
      version,
      provider: extras?.provider ?? "unknown",
      model: extras?.model ?? "unknown",
    },
  });

  return newPkg;
}
