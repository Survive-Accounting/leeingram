/**
 * Unified Answer Package Pipeline
 * 
 * normalize_validate_persist_answer_package()
 * 
 * ALL AI generation paths (Lovable + OpenAI) MUST call this function.
 * No direct writes to answer_packages from provider-specific code.
 * 
 * Pipeline steps:
 * 1) Normalize JE into canonical scenario_sections format
 * 2) Run validators (hard fail + warnings)
 * 3) Set status = needs_review if any hard fail
 * 4) Persist with validation_results stored
 * 5) Log granular pipeline events with provider/model metadata
 */

import { supabase } from "@/integrations/supabase/client";
import { runValidation, hasFailures, type AnswerPackageData, type ValidationResult } from "@/lib/validation";
import { autoFixDatesInAccountNames, autoFixNarrativePrefixes } from "@/lib/validation/jeValidators";
import { logActivity } from "@/lib/activityLogger";
import type { CanonicalJEPayload, CanonicalScenarioSection, CanonicalEntryByDate, CanonicalJERow } from "@/lib/journalEntryParser";
import { detectRequiresJE, normalizeLegacyJEText } from "@/lib/legacyJENormalizer";

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

// ── Helpers: Normalize AI output into canonical format ──

/** Try to extract/build canonical scenario_sections from various AI output shapes */
function normalizeToCanonical(payload: Record<string, any>): {
  canonicalPayload: Record<string, any>;
  normalized: boolean;
} {
  // Already canonical
  if (payload.scenario_sections && Array.isArray(payload.scenario_sections) && payload.scenario_sections.length > 0) {
    const sections = payload.scenario_sections.map(normalizeScenarioSection);
    return {
      canonicalPayload: { ...payload, scenario_sections: sections },
      normalized: true,
    };
  }

  // teaching_aids.scenario_sections
  if (payload.teaching_aids?.scenario_sections && Array.isArray(payload.teaching_aids.scenario_sections)) {
    const sections = payload.teaching_aids.scenario_sections.map(normalizeScenarioSection);
    const { teaching_aids, ...rest } = payload;
    return {
      canonicalPayload: { ...rest, scenario_sections: sections, teaching_aids: { ...teaching_aids, scenario_sections: undefined } },
      normalized: true,
    };
  }

  // teaching_aids.journal_entries (flat array of date-based entries)
  if (payload.teaching_aids?.journal_entries && Array.isArray(payload.teaching_aids.journal_entries) && payload.teaching_aids.journal_entries.length > 0) {
    const entries = payload.teaching_aids.journal_entries;
    const sections = convertFlatEntriesToScenarioSections(entries);
    const { teaching_aids, ...rest } = payload;
    return {
      canonicalPayload: {
        ...rest,
        scenario_sections: sections,
        teaching_aids: { ...teaching_aids, journal_entries: undefined },
      },
      normalized: true,
    };
  }

  // Legacy je_rows at top level
  if (payload.je_rows && Array.isArray(payload.je_rows) && payload.je_rows.length > 0) {
    const rows: CanonicalJERow[] = payload.je_rows.map((r: any) => ({
      account_name: r.account_name || r.account || "",
      debit: r.debit != null ? Number(r.debit) : null,
      credit: r.credit != null ? Number(r.credit) : null,
    }));
    const { je_rows, ...rest } = payload;
    return {
      canonicalPayload: {
        ...rest,
        scenario_sections: [{
          label: "Journal Entry",
          entries_by_date: [{ entry_date: "", rows }],
        }],
      },
      normalized: true,
    };
  }

  // No JE data to normalize
  return { canonicalPayload: payload, normalized: false };
}

function normalizeScenarioSection(sc: any): CanonicalScenarioSection {
  const entries = sc.entries_by_date || sc.journal_entries || [];
  return {
    label: sc.label || "Journal Entry",
    entries_by_date: entries.map((entry: any): CanonicalEntryByDate => ({
      entry_date: entry.entry_date || "",
      rows: (entry.rows || entry.lines || []).map((r: any): CanonicalJERow => ({
        account_name: r.account_name || r.account || "",
        debit: r.debit != null ? Number(r.debit) : null,
        credit: r.credit != null ? Number(r.credit) : null,
        ...(r.memo ? { memo: r.memo } : {}),
      })),
    })),
  };
}

/** Convert flat JE entries (with entry_date) into scenario_sections, grouping by scenario label */
function convertFlatEntriesToScenarioSections(entries: any[]): CanonicalScenarioSection[] {
  const scenarioPattern = /^((?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+))\s*[—\-–:]\s*/i;
  const groups: Map<string, CanonicalEntryByDate[]> = new Map();

  for (const entry of entries) {
    const dateStr = entry.entry_date || "";
    const m = dateStr.match(scenarioPattern);
    const label = m ? m[1] : "Journal Entry";
    const cleanDate = m ? dateStr.replace(scenarioPattern, "").trim() : dateStr;

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push({
      entry_date: cleanDate || dateStr,
      rows: (entry.rows || entry.lines || []).map((r: any): CanonicalJERow => ({
        account_name: r.account_name || r.account || "",
        debit: r.debit != null ? Number(r.debit) : null,
        credit: r.credit != null ? Number(r.credit) : null,
        ...(r.memo ? { memo: r.memo } : {}),
      })),
    });
  }

  return Array.from(groups.entries()).map(([label, ebd]) => ({ label, entries_by_date: ebd }));
}

/** Apply auto-fix normalizations to canonical rows */
function normalizeCanonicalRows(payload: Record<string, any>): { payload: Record<string, any>; fixApplied: boolean } {
  const sections = payload.scenario_sections;
  if (!Array.isArray(sections) || sections.length === 0) return { payload, fixApplied: false };

  let fixApplied = false;

  for (const sc of sections) {
    for (const entry of sc.entries_by_date || []) {
      const rows: CanonicalJERow[] = entry.rows || [];
      for (const row of rows) {
        // Parse string amounts
        if (typeof row.debit === "string") { row.debit = parseFloat((row.debit as string).replace(/[$,]/g, "")) || null; fixApplied = true; }
        if (typeof row.credit === "string") { row.credit = parseFloat((row.credit as string).replace(/[$,]/g, "")) || null; fixApplied = true; }

        // Mutual exclusivity
        const hasDebit = row.debit != null && row.debit !== 0;
        const hasCredit = row.credit != null && row.credit !== 0;
        if (hasDebit && hasCredit) {
          if ((row.debit ?? 0) >= (row.credit ?? 0)) { row.credit = null; } else { row.debit = null; }
          fixApplied = true;
        }

        // Strip embedded dollar amounts from account_name
        if (row.account_name) {
          const cleaned = row.account_name.replace(/\s*\$[\d,]+(?:\.\d+)?\s*/g, " ").replace(/\s{2,}/g, " ").trim();
          if (cleaned !== row.account_name) { row.account_name = cleaned; fixApplied = true; }
        }
      }
    }
  }

  return { payload, fixApplied };
}

// ── Main pipeline ──

export async function normalizeValidatePersistAnswerPackage(
  draft: AnswerPackageDraft
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const providerMeta = {
    provider: draft.provider ?? "unknown",
    model: draft.model ?? "unknown",
    source_problem_id: draft.source_problem_id,
  };

  // ── Log: normalize_started ──
  await logActivity({
    actor_type: "system",
    entity_type: "source_problem",
    entity_id: draft.source_problem_id,
    event_type: "normalize_started",
    severity: "info",
    provider: draft.provider,
    model: draft.model,
    message: `Normalizing output from ${draft.provider ?? "unknown"}/${draft.model ?? "unknown"}`,
    payload_json: providerMeta,
  });

  // ── Step 1: Normalize into canonical scenario_sections ──
  const { canonicalPayload, normalized: structureNormalized } = normalizeToCanonical(draft.answer_payload);
  const { payload: cleanPayload, fixApplied } = normalizeCanonicalRows(canonicalPayload);
  const normalized = structureNormalized || fixApplied;

  await logActivity({
    actor_type: "system",
    entity_type: "source_problem",
    entity_id: draft.source_problem_id,
    event_type: "normalize_completed",
    severity: "info",
    provider: draft.provider,
    model: draft.model,
    message: structureNormalized ? "Structure normalized to canonical format" : (fixApplied ? "Row-level fixes applied" : "Already canonical"),
    payload_json: { ...providerMeta, structure_normalized: structureNormalized, rows_fixed: fixApplied },
  });

  // ── Step 1b: If requires_je, try legacy text normalization ──
  const problemText = draft.extracted_inputs?.problem_text || "";
  const requiresJE = detectRequiresJE(problemText);
  const hasStructuredJE = Array.isArray(cleanPayload.scenario_sections) && cleanPayload.scenario_sections.length > 0;

  if (requiresJE && !hasStructuredJE) {
    // Try to find legacy JE text in the payload
    const legacyText = cleanPayload.journal_entry_text
      || cleanPayload.teaching_aids?.journal_entry_text
      || cleanPayload._raw_unparsed
      || "";
    if (legacyText && typeof legacyText === "string") {
      const normalizeResult = normalizeLegacyJEText(legacyText);
      if (normalizeResult.success) {
        cleanPayload.scenario_sections = normalizeResult.scenario_sections;
        cleanPayload._legacy_je_text = legacyText;
        await logActivity({
          actor_type: "system",
          entity_type: "source_problem",
          entity_id: draft.source_problem_id,
          event_type: "legacy_je_normalized",
          severity: "info",
          provider: draft.provider,
          model: draft.model,
          message: `Normalized ${normalizeResult.rowCount} legacy JE rows into ${normalizeResult.scenario_sections.length} scenario section(s)`,
          payload_json: { ...providerMeta, row_count: normalizeResult.rowCount, section_count: normalizeResult.scenario_sections.length },
        });
      }
    }
  }

  // ── Step 2: Run validators ──
  await logActivity({
    actor_type: "system",
    entity_type: "source_problem",
    entity_id: draft.source_problem_id,
    event_type: "validate_started",
    severity: "info",
    provider: draft.provider,
    model: draft.model,
    message: "Running validators",
    payload_json: providerMeta,
  });

  const pkgData: AnswerPackageData = {
    answer_payload: cleanPayload,
    extracted_inputs: draft.extracted_inputs ?? {},
    computed_values: draft.computed_values ?? {},
  };
  const validationResults = runValidation(pkgData);
  const failCount = validationResults.filter(r => r.status === "fail").length;
  const warnCount = validationResults.filter(r => r.status === "warn").length;
  const passCount = validationResults.filter(r => r.status === "pass").length;

  await logActivity({
    actor_type: "system",
    entity_type: "source_problem",
    entity_id: draft.source_problem_id,
    event_type: "validate_completed",
    severity: failCount > 0 ? "warn" : "info",
    provider: draft.provider,
    model: draft.model,
    message: failCount > 0 ? `${failCount} validator(s) failed` : `All ${passCount} validators passed`,
    payload_json: { ...providerMeta, validation_summary: { pass: passCount, fail: failCount, warn: warnCount } },
  });

  // ── Step 3: Determine status ──
  // Hard rule: if requires_je but still no structured JE after normalization, force needs_review
  const finalHasJE = Array.isArray(cleanPayload.scenario_sections) && cleanPayload.scenario_sections.length > 0;
  const missingRequiredJE = requiresJE && !finalHasJE;
  const status = (hasFailures(validationResults) || missingRequiredJE) ? "needs_review" : "drafted";

  // ── Step 4: Persist ──
  const { data: newPkg, error: insertErr } = await supabase
    .from("answer_packages")
    .insert({
      source_problem_id: draft.source_problem_id,
      version: draft.version,
      generator: draft.generator as any,
      answer_payload: cleanPayload,
      extracted_inputs: draft.extracted_inputs ?? {},
      computed_values: draft.computed_values ?? {},
      validation_results: validationResults as any,
      status: status as any,
      output_type: (draft.output_type ?? "mixed") as any,
    } as any)
    .select("*")
    .single();

  if (insertErr) throw insertErr;

  // ── Step 5: Log persist_completed ──
  const totalMs = Date.now() - pipelineStart;

  await logActivity({
    actor_type: "ai",
    entity_type: "source_problem",
    entity_id: draft.source_problem_id,
    event_type: "persist_completed",
    severity: failCount > 0 ? "warn" : "info",
    provider: draft.provider,
    model: draft.model,
    duration_ms: totalMs,
    message: `Package v${draft.version} persisted as ${status} (${totalMs}ms)`,
    payload_json: {
      package_id: newPkg.id,
      version: draft.version,
      ...providerMeta,
      token_usage: draft.token_usage,
      generation_time_ms: draft.generation_time_ms,
      pipeline_time_ms: totalMs,
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
