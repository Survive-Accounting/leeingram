import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOG_PREVIEW_CHARS = 1000;

function previewText(input: unknown, length = LOG_PREVIEW_CHARS) {
  const text = typeof input === "string"
    ? input
    : JSON.stringify(input ?? "", null, 0);

  return {
    first: text.slice(0, length),
    last: text.slice(-length),
    length: text.length,
  };
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper to log generation events when run_id is provided
async function logGenEvent(
  sb: any,
  runId: string | null,
  seq: number,
  scope: string,
  level: string,
  eventType: string,
  message: string,
  payload?: any
) {
  if (!runId) return;
  try {
    await sb.from("generation_events").insert({
      run_id: runId,
      seq,
      scope,
      level,
      event_type: eventType,
      message,
      payload_json: payload ?? null,
    });
  } catch (_) { /* swallow */ }
}

/** Extract the first JSON object from raw text, handling code fences */
function extractFirstJsonObject(raw: string): any | null {
  if (!raw || typeof raw !== "string") return null;
  // Strip markdown code fences
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  // Try parsing the whole thing first
  try { return JSON.parse(cleaned); } catch (_) { /* continue */ }
  // Find first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)); } catch (_) { /* continue */ }
  }
  // Try first [ and last ]
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try { return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1)); } catch (_) { /* continue */ }
  }
  // Try removing trailing commas
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = cleaned.slice(firstBrace, lastBrace + 1).replace(/,\s*([\]}])/g, "$1");
    try { return JSON.parse(slice); } catch (_) { /* give up */ }
  }
  return null;
}

/** Validate NON_JE candidate schema */
function validateNonJeCandidates(candidates: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { valid: false, errors: ["candidates must be a non-empty array"] };
  }
  candidates.forEach((c, i) => {
    const p = `candidates[${i}]`;
    if (typeof c.asset_name !== "string" || !c.asset_name.trim()) errors.push(`${p}.asset_name required`);
    if (!Array.isArray(c.tags)) errors.push(`${p}.tags must be array`);
    if (typeof c.survive_problem_text !== "string" || !c.survive_problem_text.trim()) errors.push(`${p}.survive_problem_text required`);
    if (typeof c.answer_only !== "string" || !c.answer_only.trim()) errors.push(`${p}.answer_only required`);
    if (typeof c.survive_solution_text !== "string" || !c.survive_solution_text.trim()) errors.push(`${p}.survive_solution_text required`);
    if (!Array.isArray(c.answer_parts) || c.answer_parts.length === 0) {
      errors.push(`${p}.answer_parts must be non-empty array`);
    } else {
      c.answer_parts.forEach((ap: any, j: number) => {
        if (typeof ap.label !== "string") errors.push(`${p}.answer_parts[${j}].label required`);
        if (typeof ap.final_answer !== "string") errors.push(`${p}.answer_parts[${j}].final_answer required`);
        if (typeof ap.steps !== "string") errors.push(`${p}.answer_parts[${j}].steps required`);
      });
    }
    // Must NOT have JE fields
    if (c.je_structured) errors.push(`${p} should not contain je_structured in NON_JE mode`);
  });
  return { valid: errors.length === 0, errors };
}

// ── NON_JE Quality Validators ──

const SELF_CORRECTION_PATTERNS = /\b(wait|check|re-|however|actually|verify|to match|incorrect|let's|fix|recalculating|recalculate|let's verify|to match source|but if we)\b/gi;

interface NonJeValidatorResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  candidate_index?: number;
  details?: any;
}

function nonJe_no_self_correction_language(candidates: any[]): NonJeValidatorResult[] {
  const results: NonJeValidatorResult[] = [];
  candidates.forEach((c, i) => {
    const textsToCheck: string[] = [];
    if (Array.isArray(c.answer_parts)) {
      c.answer_parts.forEach((p: any) => {
        if (typeof p.steps === "string") textsToCheck.push(p.steps);
      });
    }
    if (typeof c.survive_solution_text === "string") textsToCheck.push(c.survive_solution_text);

    const found: string[] = [];
    for (const text of textsToCheck) {
      const matches = text.match(SELF_CORRECTION_PATTERNS);
      if (matches) found.push(...matches.map(m => m.toLowerCase()));
    }
    const unique = [...new Set(found)];
    results.push({
      name: "nonJe_no_self_correction_language",
      candidate_index: i,
      status: unique.length > 0 ? "fail" : "pass",
      message: unique.length > 0 ? `Self-correction language found: ${unique.join(", ")}` : "No self-correction language",
      details: unique.length > 0 ? { words: unique } : undefined,
    });
  });
  return results;
}

function nonJe_answer_only_matches_parts(candidates: any[]): NonJeValidatorResult[] {
  const results: NonJeValidatorResult[] = [];
  candidates.forEach((c, i) => {
    if (!Array.isArray(c.answer_parts) || !c.answer_only) {
      results.push({ name: "nonJe_answer_only_matches_parts", candidate_index: i, status: "warn", message: "Missing answer_parts or answer_only" });
      return;
    }
    const mismatches: string[] = [];
    for (const part of c.answer_parts) {
      const fa = (part.final_answer || "").trim();
      if (fa && !c.answer_only.includes(fa)) {
        mismatches.push(`${part.label}: "${fa}" not found in answer_only`);
      }
    }
    results.push({
      name: "nonJe_answer_only_matches_parts",
      candidate_index: i,
      status: mismatches.length > 0 ? "fail" : "pass",
      message: mismatches.length > 0 ? mismatches.join("; ") : "answer_only matches all final_answers",
      details: mismatches.length > 0 ? { mismatches } : undefined,
    });
  });
  return results;
}

function nonJe_consistency_basic(candidates: any[]): NonJeValidatorResult[] {
  const results: NonJeValidatorResult[] = [];
  candidates.forEach((c, i) => {
    if (!c.survive_solution_text || !Array.isArray(c.answer_parts)) {
      results.push({ name: "nonJe_consistency_basic", candidate_index: i, status: "warn", message: "Missing data for consistency check" });
      return;
    }
    // Extract division expressions from solution text: "X / Y"
    const divPattern = /[\d,]+(?:\.\d+)?\s*\/\s*([\d,]+(?:\.\d+)?)/g;
    const solutionDenominators = new Set<string>();
    let match;
    while ((match = divPattern.exec(c.survive_solution_text)) !== null) {
      solutionDenominators.add(match[1].replace(/,/g, ""));
    }
    // Extract from steps
    const stepsDenominators = new Set<string>();
    for (const part of c.answer_parts) {
      if (typeof part.steps === "string") {
        const stepDiv = /[\d,]+(?:\.\d+)?\s*\/\s*([\d,]+(?:\.\d+)?)/g;
        let sm;
        while ((sm = stepDiv.exec(part.steps)) !== null) {
          stepsDenominators.add(sm[1].replace(/,/g, ""));
        }
      }
    }
    // Check: denominators in solution should appear in steps
    const solOnly = [...solutionDenominators].filter(d => !stepsDenominators.has(d) && stepsDenominators.size > 0);
    results.push({
      name: "nonJe_consistency_basic",
      candidate_index: i,
      status: solOnly.length > 0 ? "fail" : "pass",
      message: solOnly.length > 0
        ? `Solution uses denominators not in steps: ${solOnly.join(", ")}`
        : "Denominator consistency OK",
      details: solOnly.length > 0 ? { solution_only_denominators: solOnly } : undefined,
    });
  });
  return results;
}

function nonJe_required_fields(candidates: any[]): NonJeValidatorResult[] {
  const results: NonJeValidatorResult[] = [];
  candidates.forEach((c, i) => {
    if (!Array.isArray(c.answer_parts) || c.answer_parts.length === 0) {
      results.push({ name: "nonJe_required_fields", candidate_index: i, status: "fail", message: "answer_parts missing or empty" });
      return;
    }
    // Check each part has required fields
    const issues: string[] = [];
    for (const part of c.answer_parts) {
      if (!part.label?.trim()) issues.push("missing label");
      if (!part.final_answer?.trim()) issues.push("missing final_answer");
      if (!part.steps?.trim()) issues.push("missing steps");
    }
    results.push({
      name: "nonJe_required_fields",
      candidate_index: i,
      status: issues.length > 0 ? "fail" : "pass",
      message: issues.length > 0 ? issues.join("; ") : `${c.answer_parts.length} answer parts valid`,
    });
  });
  return results;
}

/** EPS Part (b) denominator validator — checks time-weighted incremental shares */
function nonJe_eps_denominator_check(candidates: any[], problemText: string, solutionText: string): NonJeValidatorResult[] {
  const results: NonJeValidatorResult[] = [];
  const combinedUpper = ((problemText || "") + " " + (solutionText || "")).toUpperCase();
  
  // Only run for EPS / diluted / if-converted problems
  const isEPS = combinedUpper.includes("EPS") || combinedUpper.includes("EARNINGS PER SHARE") || combinedUpper.includes("IF-CONVERTED") || combinedUpper.includes("DILUTED");
  if (!isEPS) return results;

  // Detect mid-year issuance date from problem text
  const monthNames: Record<string, number> = {
    JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
    JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
    JAN: 1, FEB: 2, MAR: 3, APR: 4, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
  };
  // Match patterns like "September 1", "Sept. 1", "Oct 1, 2025", "issued on July 1"
  const datePattern = /(?:ISSUED|ISSU(?:ED|ANCE)|SOLD|CONVERTED)\s+(?:ON\s+)?(?:THE\s+)?(\w+)\.?\s+(\d{1,2})/gi;
  let dateMatch;
  let issuanceMonth: number | null = null;
  
  while ((dateMatch = datePattern.exec(combinedUpper)) !== null) {
    const monthStr = dateMatch[1].replace(/\.$/, "");
    const m = monthNames[monthStr];
    if (m && m > 1) { // Only care about mid-year (not Jan 1)
      issuanceMonth = m;
      break;
    }
  }

  if (!issuanceMonth) {
    // No mid-year issuance detected — skip this validator
    return results;
  }

  const monthsOutstanding = 12 - issuanceMonth + 1; // e.g., Sept 1 = months 9-12 = 4 months
  const fraction = monthsOutstanding / 12;

  // Now check each candidate's part (b) or diluted EPS denominator
  candidates.forEach((c, ci) => {
    if (!Array.isArray(c.answer_parts)) return;
    
    // Find the part that deals with diluted EPS (usually part b)
    const dilutedPart = c.answer_parts.find((p: any) => {
      const label = (p.label || "").toLowerCase();
      const steps = (p.steps || "").toUpperCase();
      return (label.includes("b") || label.includes("2")) && 
             (steps.includes("DILUTED") || steps.includes("IF-CONVERTED") || steps.includes("INCREMENTAL"));
    });

    if (!dilutedPart) return;

    const steps = dilutedPart.steps || "";
    
    // Extract incremental shares from steps — look for "X × fraction" or "X * fraction" patterns
    // Also check for full-year incremental shares (no time-weighting)
    const shareConversionPattern = /(\d[\d,]*)\s*(?:shares?\s+)?(?:×|x|\*|from conversion)/gi;
    const timeWeightPattern = /(\d[\d,]*)\s*(?:×|x|\*)\s*(\d+)\s*\/\s*12/gi;
    
    let hasTimeWeighting = false;
    let twMatch;
    while ((twMatch = timeWeightPattern.exec(steps)) !== null) {
      const monthsUsed = parseInt(twMatch[2]);
      if (monthsUsed === monthsOutstanding) {
        hasTimeWeighting = true;
      }
    }

    // Also check survive_solution_text for the same
    const solText = c.survive_solution_text || "";
    const solTwPattern = /(\d[\d,]*)\s*(?:×|x|\*)\s*(\d+)\s*\/\s*12/gi;
    let solTwMatch;
    while ((solTwMatch = solTwPattern.exec(solText)) !== null) {
      const monthsUsed = parseInt(solTwMatch[2]);
      if (monthsUsed === monthsOutstanding) {
        hasTimeWeighting = true;
      }
    }

    // Check if they used the fraction in some form
    const fractionStr = `${monthsOutstanding}/12`;
    const hasFractionInSteps = steps.includes(fractionStr);
    const hasFractionInSol = solText.includes(fractionStr);

    if (!hasTimeWeighting && !hasFractionInSteps && !hasFractionInSol) {
      results.push({
        name: "nonJe_eps_denominator_check",
        candidate_index: ci,
        status: "fail",
        message: `EPS part (b): Bonds issued month ${issuanceMonth} → expected ${monthsOutstanding}/12 time-weighting for incremental shares, but no time-weighting found. Denominator likely uses full-year shares incorrectly.`,
        details: { issuance_month: issuanceMonth, months_outstanding: monthsOutstanding, expected_fraction: fractionStr },
      });
    } else {
      results.push({
        name: "nonJe_eps_denominator_check",
        candidate_index: ci,
        status: "pass",
        message: `EPS part (b): Time-weighting ${fractionStr} detected for incremental shares.`,
        details: { issuance_month: issuanceMonth, months_outstanding: monthsOutstanding },
      });
    }
  });

  return results;
}

function runNonJeQualityValidators(candidates: any[], problemText?: string, solutionText?: string): NonJeValidatorResult[] {
  return [
    ...nonJe_no_self_correction_language(candidates),
    ...nonJe_answer_only_matches_parts(candidates),
    ...nonJe_consistency_basic(candidates),
    ...nonJe_required_fields(candidates),
    ...nonJe_eps_denominator_check(candidates, problemText || "", solutionText || ""),
  ];
}

/** Strip trailing commentary after the last numbered step */
function stripTrailingCommentary(steps: string): string {
  const lines = steps.split("\n");
  let lastNumberedIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*\d+[\.\)]\s/.test(lines[i])) {
      lastNumberedIdx = i;
      break;
    }
  }
  if (lastNumberedIdx >= 0 && lastNumberedIdx < lines.length - 1) {
    // Keep lines up to and including the last numbered step
    return lines.slice(0, lastNumberedIdx + 1).join("\n");
  }
  return steps;
}

function validateCandidates(candidates: any[], expectedCount: number): string[] {
  const errors: string[] = [];

  if (!Array.isArray(candidates)) {
    return ["candidates must be an array"];
  }

  if (candidates.length !== expectedCount) {
    errors.push(`expected ${expectedCount} candidates, got ${candidates.length}`);
  }

  candidates.forEach((candidate, index) => {
    const prefix = `candidates[${index}]`;
    if (!candidate || typeof candidate !== "object") {
      errors.push(`${prefix} must be an object`);
      return;
    }

    if (typeof candidate.asset_name !== "string" || !candidate.asset_name.trim()) {
      errors.push(`${prefix}.asset_name is required`);
    }
    if (!Array.isArray(candidate.tags)) {
      errors.push(`${prefix}.tags must be an array`);
    }
    if (typeof candidate.survive_problem_text !== "string" || !candidate.survive_problem_text.trim()) {
      errors.push(`${prefix}.survive_problem_text is required`);
    }
    if (typeof candidate.answer_only !== "string" || !candidate.answer_only.trim()) {
      errors.push(`${prefix}.answer_only is required`);
    }
    if (typeof candidate.survive_solution_text !== "string" || !candidate.survive_solution_text.trim()) {
      errors.push(`${prefix}.survive_solution_text is required`);
    }
  });

  return errors;
}

function validateJeStructured(je: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!je || typeof je !== "object") {
    return { valid: false, errors: ["je_structured is missing or not an object"] };
  }

  const sections = je.scenario_sections;
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return { valid: false, errors: ["je_structured.scenario_sections must be a non-empty array"] };
  }

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const sp = `scenario_sections[${si}]`;
    if (!sec.label || typeof sec.label !== "string") {
      errors.push(`${sp}.label is required`);
    }
    const entries = sec.entries_by_date;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      errors.push(`${sp}.entries_by_date must be a non-empty array`);
      continue;
    }
    for (let ei = 0; ei < entries.length; ei++) {
      const entry = entries[ei];
      const ep = `${sp}.entries_by_date[${ei}]`;
      if (entry.date === undefined && entry.entry_date === undefined) {
        errors.push(`${ep} missing date/entry_date`);
      }
      const rows = entry.rows;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        errors.push(`${ep}.rows must be a non-empty array`);
        continue;
      }
      let totalDebit = 0;
      let totalCredit = 0;
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const rp = `${ep}.rows[${ri}]`;
        if (!row.account_name || typeof row.account_name !== "string") {
          errors.push(`${rp}.account_name is required`);
        }
        const hasDebit = row.debit !== null && row.debit !== undefined;
        const hasCredit = row.credit !== null && row.credit !== undefined;
        if (!hasDebit && !hasCredit) {
          errors.push(`${rp} must have either debit or credit`);
        }
        if (hasDebit && hasCredit && Number(row.debit) > 0 && Number(row.credit) > 0) {
          errors.push(`${rp} has both debit and credit > 0`);
        }
        if (hasDebit) totalDebit += Number(row.debit) || 0;
        if (hasCredit) totalCredit += Number(row.credit) || 0;
      }
      if (Math.abs(totalDebit - totalCredit) > 1) {
        errors.push(`${ep} debits (${totalDebit}) != credits (${totalCredit})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function runCandidateValidators(candidates: any[], requiresJournalEntry: boolean) {
  const results: Array<Record<string, any>> = [];

  const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
  results.push({
    name: "candidate_presence",
    status: hasCandidates ? "pass" : "fail",
    details_if_fail: hasCandidates ? undefined : "No candidates were generated",
  });

  const allHaveAnswerOnly = hasCandidates && candidates.every((c) => typeof c?.answer_only === "string" && c.answer_only.trim().length > 0);
  results.push({
    name: "answer_only_present",
    status: allHaveAnswerOnly ? "pass" : "fail",
    details_if_fail: allHaveAnswerOnly ? undefined : "One or more candidates are missing answer_only",
  });

  if (!requiresJournalEntry) {
    results.push({
      name: "je_structured_valid",
      status: "skip",
      reason_if_skip: "Journal entry not required for this source problem",
    });
  } else {
    // Deep validate each candidate's je_structured
    const perCandidateResults: Array<{ index: number; valid: boolean; errors: string[] }> = [];
    let allValid = true;

    if (hasCandidates) {
      candidates.forEach((c, idx) => {
        const je = c?.je_structured;
        if (!je) {
          perCandidateResults.push({ index: idx, valid: false, errors: ["je_structured field is missing"] });
          allValid = false;
        } else {
          const validation = validateJeStructured(je);
          perCandidateResults.push({ index: idx, valid: validation.valid, errors: validation.errors });
          if (!validation.valid) allValid = false;
        }
      });
    } else {
      allValid = false;
    }

    results.push({
      name: "je_structured_valid",
      status: allValid ? "pass" : "fail",
      details_if_fail: allValid ? undefined : "One or more candidates have invalid/missing je_structured",
      per_candidate: perCandidateResults,
    });
  }

  return results;
}

async function finalizeRunRecord(
  sb: any,
  params: {
    runId: string | null;
    status: "success" | "failed";
    durationMs: number;
    errorSummary?: string | null;
    variantId?: string | null;
    provider?: string | null;
    model?: string | null;
    courseId?: string | null;
    chapterId?: string | null;
    sourceProblemId?: string | null;
  }
) {
  if (!params.runId) return;

  try {
    const { data: timeline } = await sb
      .from("generation_events")
      .select("seq,scope,level,event_type,message,payload_json,created_at")
      .eq("run_id", params.runId)
      .order("seq", { ascending: true });

    const debugBundle = {
      run_id: params.runId,
      status: params.status,
      provider: params.provider ?? null,
      model: params.model ?? null,
      course_id: params.courseId ?? null,
      chapter_id: params.chapterId ?? null,
      source_problem_id: params.sourceProblemId ?? null,
      variant_id: params.variantId ?? null,
      duration_ms: params.durationMs,
      error_summary: params.errorSummary ?? null,
      timeline: (timeline ?? []).map((evt: any) => ({
        seq: evt.seq,
        scope: evt.scope,
        level: evt.level,
        event_type: evt.event_type,
        message: evt.message,
        payload: evt.payload_json,
        created_at: evt.created_at,
      })),
    };

    await sb
      .from("generation_runs")
      .update({
        status: params.status,
        duration_ms: params.durationMs,
        error_summary: params.errorSummary ?? null,
        variant_id: params.variantId ?? null,
        debug_bundle_json: debugBundle,
      })
      .eq("id", params.runId);
  } catch (error) {
    console.error("Failed to finalize generation run:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let runId: string | null = null;
  let eventSeq = 100;
  const runStartedAt = Date.now();
  let sbService: any = null;
  let runMeta: {
    provider: string | null;
    model: string | null;
    course_id: string | null;
    chapter_id: string | null;
    source_problem_id: string | null;
  } = {
    provider: null,
    model: null,
    course_id: null,
    chapter_id: null,
    source_problem_id: null,
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Allow service-role calls (from batch step) to bypass user JWT validation
    let claimsData: any = null;
    if (!isServiceRole) {
      const { data: cd, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !cd?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      claimsData = cd;
    } else {
      // Service-role calls don't have user claims; use a placeholder
      claimsData = { claims: { sub: "service-role" } };
    }

    const body = await req.json();
    const { mode } = body;

    runId = body.run_id ?? null;
    runMeta = {
      provider: body.provider ?? body.ui_provider_selected ?? "lovable",
      model: body.model ?? null,
      course_id: body.courseId ?? body.course_id ?? null,
      chapter_id: body.chapterId ?? body.chapter_id ?? null,
      source_problem_id: body.problemId ?? body.source_problem_id ?? null,
    };

    // Service client for backend logging + run finalization (RLS bypass)
    sbService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (runId) {
      const { data: lastEvent } = await sbService
        .from("generation_events")
        .select("seq")
        .eq("run_id", runId)
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();

      eventSeq = Math.max(100, Number(lastEvent?.seq ?? 0));
    }

    // ─── MODE: save ─── Save a chosen candidate to DB
    if (mode === "save") {
      const problemId = body.problemId ?? body.source_problem_id;
      const courseId = body.courseId ?? body.course_id;
      const chapterId = body.chapterId ?? body.chapter_id;
      const candidate = body.candidate;
      const requiresJournalEntry = !!body.requiresJournalEntry;

      runMeta = {
        ...runMeta,
        course_id: courseId ?? runMeta.course_id,
        chapter_id: chapterId ?? runMeta.chapter_id,
        source_problem_id: problemId ?? runMeta.source_problem_id,
      };

      // ── Idempotency: check if this source problem already has approved teaching asset ──
      const { data: existingApproved } = await supabase
        .from("teaching_assets")
        .select("id, asset_name")
        .eq("base_raw_problem_id", problemId)
        .limit(1);
      if (existingApproved && existingApproved.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          asset: existingApproved[0],
          duplicate: true,
          message: `Already approved as ${existingApproved[0].asset_name}`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_START", "Starting variant persistence", {
        mode: "save",
        problem_id: problemId,
        course_id: courseId,
        chapter_id: chapterId,
        candidate_fields_present: {
          survive_problem_text: !!candidate?.survive_problem_text,
          survive_solution_text: !!candidate?.survive_solution_text,
          answer_only: !!candidate?.answer_only,
          journal_entry_block: !!candidate?.journal_entry_block,
          journal_entry_completed_json: !!candidate?.journal_entry_completed_json,
          journal_entry_template_json: !!candidate?.journal_entry_template_json,
        },
      });

      await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "RUN_VALIDATORS_START", "Running save-path validators");
      const saveValidatorResults = [
        {
          name: "candidate_payload_present",
          status: candidate && typeof candidate === "object" ? "pass" : "fail",
          details_if_fail: candidate && typeof candidate === "object" ? undefined : "Candidate payload is missing or invalid",
        },
        !requiresJournalEntry
          ? {
              name: "journal_entry_requirement",
              status: "skip",
              reason_if_skip: "Journal entry not required for this save operation",
            }
          : {
              name: "journal_entry_requirement",
              status:
                candidate?.journal_entry_block ||
                candidate?.journal_entry_completed_json ||
                candidate?.journal_entry_template_json
                  ? "pass"
                  : "fail",
              details_if_fail:
                candidate?.journal_entry_block ||
                candidate?.journal_entry_completed_json ||
                candidate?.journal_entry_template_json
                  ? undefined
                  : "Journal entry is required but no JE payload was provided",
            },
      ];

      await logGenEvent(
        sbService,
        runId,
        ++eventSeq,
        "validator",
        saveValidatorResults.some((v) => v.status === "fail") ? "warn" : "info",
        "RUN_VALIDATORS_END",
        "Save-path validators completed",
        { validator_results: saveValidatorResults }
      );

      // ── Auto-generate Instance ID ──
      const { data: course, error: courseErr } = await supabase
        .from("courses").select("code").eq("id", courseId).single();
      if (courseErr || !course) throw new Error("Course not found");

      const { data: chapter, error: chErr } = await supabase
        .from("chapters").select("chapter_number").eq("id", chapterId).single();
      if (chErr || !chapter) throw new Error("Chapter not found");

      const courseCode = course.code || "UNK";
      const chNum = chapter.chapter_number;

      const { count: existingVariants } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("base_raw_problem_id", problemId);
      const variantLetter = String.fromCharCode(65 + (existingVariants || 0));

      let seqNum: number;
      if ((existingVariants || 0) === 0) {
        const { data: distinctSources } = await supabase
          .from("teaching_assets")
          .select("base_raw_problem_id")
          .eq("chapter_id", chapterId)
          .not("base_raw_problem_id", "is", null);
        const uniqueSources = new Set((distinctSources || []).map((d: any) => d.base_raw_problem_id));
        seqNum = uniqueSources.size + 1;
      } else {
        const { data: siblings } = await supabase
          .from("teaching_assets")
          .select("asset_name")
          .eq("base_raw_problem_id", problemId)
          .limit(1);
        const match = siblings?.[0]?.asset_name?.match(/_P(\d+)/);
        seqNum = match ? parseInt(match[1], 10) : 1;
      }

      const instanceId = `${courseCode}_CH${chNum}_P${String(seqNum).padStart(3, "0")}${variantLetter}`;

      const { data: newAsset, error: insertErr } = await supabase
        .from("teaching_assets")
        .insert({
          course_id: courseId,
          chapter_id: chapterId,
          base_raw_problem_id: problemId,
          asset_name: instanceId,
          tags: candidate.tags || [],
          survive_problem_text: candidate.survive_problem_text,
          journal_entry_block: requiresJournalEntry ? (candidate.journal_entry_block || null) : null,
          survive_solution_text: candidate.survive_solution_text,
          source_ref: candidate.answer_only || null,
          journal_entry_completed_json: candidate.journal_entry_completed_json || null,
          journal_entry_template_json: candidate.journal_entry_template_json || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from("chapter_problems")
        .update({ status: "approved", pipeline_status: "approved" })
        .eq("id", problemId);
      if (updateErr) console.error("Failed to update problem status:", updateErr);

      await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_END", "Variant persisted", {
        variant_id: newAsset?.id ?? null,
        variant_name: newAsset?.asset_name ?? null,
        fields_written: {
          source_ref: !!newAsset?.source_ref,
          journal_entry_block: !!newAsset?.journal_entry_block,
          journal_entry_completed_json: !!newAsset?.journal_entry_completed_json,
          journal_entry_template_json: !!newAsset?.journal_entry_template_json,
        },
      });

      const durationMs = Date.now() - runStartedAt;
      await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FINALIZE_RUN", "Finalizing save run", {
        status: "success",
        duration_ms: durationMs,
        variant_id: newAsset?.id ?? null,
      });

      await finalizeRunRecord(sbService, {
        runId,
        status: "success",
        durationMs,
        variantId: newAsset?.id ?? null,
        provider: runMeta.provider,
        model: runMeta.model,
        courseId: runMeta.course_id,
        chapterId: runMeta.chapter_id,
        sourceProblemId: runMeta.source_problem_id,
      });

      return new Response(JSON.stringify({ success: true, asset: newAsset }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE: candidates (default) ─── Generate N variants with V2 prompt
    const problemId = body.problemId ?? body.source_problem_id;
    const sourceLabel = body.sourceLabel;
    const title = body.title;
    const problemText = body.problemText;
    const solutionText = body.solutionText;
    const journalEntryText = body.journalEntryText;
    const notes = body.notes;
    const uiRequiresJournalEntry = !!body.requiresJournalEntry;
    const containsNoJournalEntries = !!body.containsNoJournalEntries;
    const difficultyToggles = body.difficultyToggles;
    const reqProvider = body.provider ?? body.ui_provider_selected;
    const reqModel = body.model;
    const reqChapterId = body.chapterId ?? body.chapter_id;
    const reqScenarioBlocks = body.scenarioBlocks;
    const uiSettings = body.ui_settings ?? null;

    const provider = reqProvider || "lovable";
    const aiModel = reqModel || "google/gemini-3-flash-preview";

    runMeta = {
      provider,
      model: aiModel,
      course_id: body.courseId ?? body.course_id ?? runMeta.course_id,
      chapter_id: reqChapterId ?? runMeta.chapter_id,
      source_problem_id: problemId ?? runMeta.source_problem_id,
    };

    const scenarioBlocks = reqScenarioBlocks as Array<{ label: string; text: string }> | undefined;
    const uiHasScenarios = !!(scenarioBlocks && scenarioBlocks.length >= 2);

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FETCH_SOURCE_START", "Starting source fetch and preprocessing", {
      course_id: runMeta.course_id,
      chapter_id: runMeta.chapter_id,
      source_problem_id: runMeta.source_problem_id,
      source_label: sourceLabel,
      has_ui_settings: !!uiSettings,
    });

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FETCH_SOURCE_END", "Source payload prepared", {
      problem_text_length: problemText?.length ?? 0,
      solution_text_length: solutionText?.length ?? 0,
      journal_entry_text_length: journalEntryText?.length ?? 0,
      ui_has_scenarios: uiHasScenarios,
      scenario_count: scenarioBlocks?.length ?? 0,
      problem_image_count: Array.isArray(body.problemImageUrls) ? body.problemImageUrls.length : null,
      solution_image_count: Array.isArray(body.solutionImageUrls) ? body.solutionImageUrls.length : null,
    });

    // ── Backend requirement detection (3-way: text_only, je_only, hybrid) ──
    const DETECTION_RULES_VERSION = "v3_parts";
    const combinedText = [problemText, solutionText, journalEntryText, notes].filter(Boolean).join(" ").toLowerCase();

    // JE indicators
    const jePatterns = [
      /prepare\s+(the\s+)?journal\s+entr(y|ies)/i,
      /record\s+(the\s+)?(following\s+)?journal\s+entr(y|ies)/i,
      /journalize\s+(the|each|all)/i,
      /make\s+(the\s+)?journal\s+entr(y|ies)/i,
      /\bjournal\s+entr(y|ies)\b/i,
    ];
    const jeMatchedRule = jePatterns.findIndex((p) => p.test(combinedText));
    const hasJEIndicators = jeMatchedRule >= 0 || !!journalEntryText?.trim() || uiRequiresJournalEntry;

    // Text/numeric indicators
    const textPatterns = [
      /\bcompute\b/i,
      /\bcalculate\b/i,
      /\bdetermine\b/i,
      /\bwhat\s+amount\b/i,
      /\bwhat\s+is\s+the\b/i,
      /\bhow\s+much\b/i,
      /\bcredit\s+loss\b/i,
      /\bnet\s+income\b/i,
      /\bearnings\s+per\s+share\b/i,
      /\bEPS\b/,
    ];
    const textMatchedRule = textPatterns.findIndex((p) => p.test(combinedText));
    const hasTextIndicators = textMatchedRule >= 0;

    // 3-way classification
    let generationMode: "text_only" | "je_only" | "hybrid";
    if (containsNoJournalEntries) {
      generationMode = "text_only";
    } else if (hasJEIndicators && hasTextIndicators) {
      generationMode = "hybrid";
    } else if (hasJEIndicators) {
      generationMode = "je_only";
    } else {
      generationMode = "text_only";
    }

    const requiresJournalEntry = generationMode === "je_only" || generationMode === "hybrid";

    // Scenario detection
    const scenarioPatterns = [
      /\b(situation|scenario|case)\s+(1|2|a|b|i|ii)\b/i,
      /\bindependent\s+(situations|scenarios|cases)\b/i,
      /\b(situation|scenario)\s*#?\s*\d/i,
    ];
    const scenarioMatchedRule = scenarioPatterns.findIndex((p) => p.test(problemText || ""));
    const hasScenarios = scenarioMatchedRule >= 0 || uiHasScenarios;

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "DETECT_REQUIREMENTS",
      `Mode: ${generationMode}, JE: ${requiresJournalEntry ? "required" : "not required"}, Scenarios: ${hasScenarios ? "detected" : "none"}`, {
      detection_rules_version: DETECTION_RULES_VERSION,
      generation_mode: generationMode,
      contains_no_journal_entries: containsNoJournalEntries,
      has_je_indicators: hasJEIndicators,
      has_text_indicators: hasTextIndicators,
      requires_je_final: requiresJournalEntry,
      je_matched_rule: jeMatchedRule >= 0 ? `rule_${jeMatchedRule}` : null,
      text_matched_rule: textMatchedRule >= 0 ? `rule_${textMatchedRule}` : null,
      has_scenarios_final: hasScenarios,
      scenario_blocks_from_ui: scenarioBlocks?.length ?? 0,
    });

    if (provider === "lovable") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    } else if (provider === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    }

    // Fetch user's variant generation settings
    const userId = claimsData.claims.sub;
    const { data: genSettings } = await supabase
      .from("variant_generation_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Allow explicit variant_count override (e.g. from batch generate)
    const variantCount = body.variant_count ?? genSettings?.variants_per_request ?? 3;

    const teachingTone: string[] = genSettings?.teaching_tone || [
      "Neutral but memorable", "Mix of playful and professional",
      "No campus-specific language", "No fluff or storytelling filler",
    ];
    const examRealism: string[] = genSettings?.exam_realism || [
      "All generated problems must be exam-style", "No bolded numbers",
      "Round all calculations to whole dollars", "Use short, concise sentences",
    ];
    // Standardized company names — no rotating list
    const SURVIVE_COMPANY = "Survive Company";
    const SURVIVE_COUNTERPARTY = "Survive Counterparty";

    // Fetch recent correction events for lightweight learning
    let constraintsBlock = "";
    if (reqChapterId) {
      const { data: recentFixes } = await supabase
        .from("correction_events")
        .select("summary, auto_tags")
        .eq("chapter_id", reqChapterId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (recentFixes && recentFixes.length > 0) {
        constraintsBlock = `\nCONSTRAINTS FROM RECENT FIXES (apply these to avoid repeating errors):
${recentFixes.map((f: any, i: number) => `${i + 1}. ${f.summary} [tags: ${(f.auto_tags || []).join(", ")}]`).join("\n")}
`;
      }
    }

    // Merge saved tricky toggles with per-request overrides
    const savedTrickyToggles: string[] = [];
    if (genSettings?.tricky_partial_period) savedTrickyToggles.push("Partial period / stub period");
    if (genSettings?.tricky_missing_info) savedTrickyToggles.push("Missing information requiring inference");
    if (genSettings?.tricky_sign_reversal) savedTrickyToggles.push("Premium vs discount sign reversal traps");
    if (genSettings?.tricky_multi_step_decoy) savedTrickyToggles.push("Multi-step with decoy step");
    if (genSettings?.tricky_numerical_decoys) savedTrickyToggles.push("Decoy numerical values");
    if (genSettings?.tricky_je_direction_trap) savedTrickyToggles.push("Journal entry debit/credit direction traps");
    const allToggles = [...new Set([...savedTrickyToggles, ...(difficultyToggles || [])])];

    // Build difficulty toggles instruction
    let difficultySection = "";
    if (allToggles.length > 0) {
      difficultySection = `\nEXAM DIFFICULTY PATTERNS (incorporate at least one per variant):
${allToggles.map((t: string) => `- ${t}`).join("\n")}

For each variant, include an "exam_trap_note" explaining what makes this variant tricky.`;
    }

    const journalInstruction = requiresJournalEntry
      ? `JOURNAL ENTRY HANDLING (STRICT — structured output required):
- You MUST populate the "je_structured" field for every candidate.
- Use this EXACT structure:
  { "scenario_sections": [
      { "label": "Main" OR "Situation 1" etc.,
        "entries_by_date": [
          { "date": "YYYY-MM-DD or descriptive label",
            "rows": [
              { "account_name": "Cash", "debit": 1000, "credit": null },
              { "account_name": "Revenue", "debit": null, "credit": 1000 }
            ]
          }
        ]
      }
    ]
  }
- For single-scenario problems, use a single scenario_section with label "Main".
- Each entry_by_date must balance (sum debits == sum credits).
- Each row: exactly ONE of debit or credit is a number, the other is null.
- account_name must be CLEAN: no "$", no ":", no "a./b./c.", no "1./2.", no narrative text.
- Do NOT include reasoning checklists — just JE rows.
- Also populate journal_entry_block as a text summary for backward compatibility.`
      : "JOURNAL ENTRY: Leave journal_entry_block and je_structured as null. This problem does not require a journal entry.";

    let scenarioInstruction = "";
    if (scenarioBlocks && scenarioBlocks.length >= 2) {
      scenarioInstruction = `
MULTI-SCENARIO PROBLEM (${scenarioBlocks.length} independent scenarios detected):
This problem contains multiple independent scenarios. For EACH variant:
- Generate SEPARATE entries_by_date for EACH scenario
- Use the scenario_sections wrapper format:
  { "scenario_sections": [{ "label": "Situation 1", "entries_by_date": [...] }, ...] }
- Do NOT merge all scenarios into a single journal entry blob
- Each scenario should include entries for: a) issuance, b) interest payment, c) accrual (if applicable)
- Keep scenario numbering consistent

SCENARIO BLOCKS:
${scenarioBlocks.map((b: any) => `--- ${b.label} ---\n${b.text}`).join("\n\n")}
`;
    }

    // Fetch approved account whitelist for this chapter
    let accountWhitelistBlock = "";
    let whitelistNames: string[] = [];
    let whitelistEnabled = false;
    if (reqChapterId) {
      await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "COA_FETCH_START", "Fetching chapter account whitelist", {
        chapter_id: reqChapterId,
      });

      const { data: approvedAccounts, error: coaErr } = await supabase
        .from("chapter_accounts")
        .select("account_name")
        .eq("chapter_id", reqChapterId)
        .eq("is_approved", true);

      whitelistNames = (approvedAccounts ?? []).map((a: any) => a.account_name as string);
      whitelistEnabled = whitelistNames.length > 0;

      await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "COA_FETCH_END", `Whitelist: ${whitelistEnabled ? "enabled" : "disabled"} (${whitelistNames.length} accounts)`, {
        chapter_id: reqChapterId,
        whitelist_enabled: whitelistEnabled,
        whitelist_count: whitelistNames.length,
        account_names: whitelistNames,
        fetch_error: coaErr?.message ?? null,
      });

      if (whitelistEnabled) {
        const accountList = whitelistNames.join(", ");
        accountWhitelistBlock = `
APPROVED ACCOUNT WHITELIST (STRICT — use ONLY these account names in journal entries):
${accountList}
Do NOT invent or use account names outside this list. If an account is needed but not listed, use the closest match.
`;
      }
    }

    let systemPrompt: string;
    let userPrompt: string;

    // ── Shared prompt preamble ──
    const preamble = `You are an expert accounting instructor creating Scalable Teaching Assets for exam prep.

TEACHING TONE:
${teachingTone.map((t: string) => `- ${t}`).join("\n")}

EXAM REALISM RULES:
${examRealism.map((r: string) => `- ${r}`).join("\n")}

CORE RULES:
- Generate exactly ${variantCount} exam-style practice problem variants from the source.
- Each variant must teach the SAME core accounting concept as the source.
- Use DIFFERENT numerical values across all ${variantCount} variants.
- All variants MUST use the company name "${SURVIVE_COMPANY}" as the primary entity.
- If a second entity is needed (counterparty, investor, lender, etc.), use "${SURVIVE_COUNTERPARTY}".
- Do NOT use any other fictional company names.
- All scenarios must feel realistic and finance/accounting related.
- Do NOT include "Survive Accounting" in student-facing text.

${difficultySection}
${constraintsBlock}`;

    // ── Parts-based output instructions (universal) ──
    const partsInstruction = `
PARTS-BASED ANSWER FORMAT (CRITICAL):
Every variant's answer MUST be an ordered array called "parts".
Each part has a "label" (store as "a", "b", "c" — UI renders as (a), (b), (c)) and a "type" which is either "text" or "je".

TEXT parts (type: "text"):
- final_answer: short statement (e.g. "The credit loss is $10,000.")
- explanation: 1-4 sentence reasoning
- worked_steps: compact calculation (e.g. "50,000 − 40,000 = 10,000")
- final_value: optional numeric value (number, not string)
- units: optional (e.g. "USD", "%")

JOURNAL ENTRY parts (type: "je"):
- je_structured: array of { date: string, entries: [{ account: string, debit: number|null, credit: number|null }] }
- Each entry must balance (total debits = total credits)
- Account names must be CLEAN: no "$", no ":", no narrative text
${accountWhitelistBlock ? `- Use ONLY accounts from the approved whitelist\n${accountWhitelistBlock}` : ""}

HYBRID problems: Maintain the same order as the problem instructions.
Example: (a) text, (b) journal entry, (c) text, (d) journal entry

The number of parts MUST match the number of requirements in the source problem.
Round to whole dollars unless the problem requires cents (e.g. EPS).`;

    const qualityRules = `
STRICT OUTPUT QUALITY RULES (CRITICAL):
1. NO SELF-CORRECTIONS: Do NOT use "wait", "check", "re-", "however", "actually", "verify", "let's fix". Every step must be decisive and final.
2. ONE COMPUTATION PATH ONLY: Each text part's worked_steps must have exactly ONE final computation path.
3. ANSWER CONSISTENCY: answer_only must match the final_answer values from text parts.
4. CLEAN STEPS FORMAT: Compact calculations, no narrative filler.

SUPPLEMENTAL CONTENT (REQUIRED for every candidate):
- important_formulas: List of formulas/equations needed to solve this problem, one per line. Only include formulas actually relevant.
- concept_notes: 2-5 bullet points explaining key accounting concepts tested. Write for a student who understands basics.
- exam_traps: 2-4 common mistakes or traps students fall into. Be specific and actionable.`;

    if (generationMode === "text_only") {
      systemPrompt = `${preamble}

THIS IS A TEXT/NUMERIC-ONLY PROBLEM. Do NOT generate any journal entry parts.
All parts must have type: "text".
${partsInstruction}
${qualityRules}

${(() => {
  const upperProblem = (problemText || "").toUpperCase();
  const upperSolution = (solutionText || "").toUpperCase();
  const combinedUpper = upperProblem + " " + upperSolution + " " + (title || "").toUpperCase();
  const isEPS = combinedUpper.includes("EPS") || combinedUpper.includes("EARNINGS PER SHARE") || combinedUpper.includes("IF-CONVERTED") || combinedUpper.includes("DILUTED");
  if (!isEPS) return "";
  return `
EPS / IF-CONVERTED METHOD — MANDATORY RULES (CRITICAL):
A) BONDS/CONVERTIBLES ISSUED DURING THE YEAR: Time-weight BOTH interest addback and incremental shares.
B) FINAL EPS LINE: Use the exact denominator computed. Do NOT simplify.
C) ONE correct denominator. No alternates.
`;
})()}

SOLUTION STORAGE — For every variant:
1. answer_only: Final numeric answers summary (concise)
2. survive_solution_text: Fully worked steps (step-by-step, compact)
3. parts: Array of text parts

OUTPUT: Return exactly ${variantCount} candidates using tool calling.`;

      userPrompt = `Source Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${notes ? `Instructor Notes:\n${notes}` : ""}

Generate ${variantCount} exam-style practice variants. Focus on calculations, ratios, and analysis.
REMINDER: No self-corrections. One clean computation path per part.`;

    } else if (generationMode === "je_only") {
      systemPrompt = `${preamble}
${accountWhitelistBlock}

THIS IS A JOURNAL-ENTRY-ONLY PROBLEM. All parts must have type: "je".
${partsInstruction}
${scenarioInstruction}

SOLUTION STORAGE — For every variant:
1. answer_only: Final JE summary (concise)
2. survive_solution_text: Fully worked steps with solution logic
3. parts: Array of je parts
4. journal_entry_block: Text summary for backward compatibility

OUTPUT: Return exactly ${variantCount} candidates using tool calling.`;

      userPrompt = `Source Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${journalEntryText ? `Original Journal Entry:\n${journalEntryText}` : ""}
${notes ? `Instructor Notes:\n${notes}` : ""}

Generate ${variantCount} exam-style practice variants with structured journal entries.`;

    } else {
      // hybrid
      systemPrompt = `${preamble}
${accountWhitelistBlock}

THIS IS A HYBRID PROBLEM with both text/numeric answers AND journal entries.
Parts must maintain the same order as the source problem instructions.
${partsInstruction}
${qualityRules}
${scenarioInstruction}

SOLUTION STORAGE — For every variant:
1. answer_only: Final answers summary (concise)
2. survive_solution_text: Fully worked steps with all solution logic
3. parts: Ordered array mixing text and je parts as needed
4. journal_entry_block: Text summary for backward compatibility (JE portions only)

OUTPUT: Return exactly ${variantCount} candidates using tool calling.`;

      userPrompt = `Source Problem: ${sourceLabel} — ${title}

Original Problem Text:
${problemText || "Not provided"}

Original Solution:
${solutionText || "Not provided"}

${journalEntryText ? `Original Journal Entry:\n${journalEntryText}` : ""}
${notes ? `Instructor Notes:\n${notes}` : ""}

Generate ${variantCount} exam-style practice variants. This problem requires BOTH text/numeric answers AND journal entries — use the parts[] format with mixed types.`;
    }

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "BUILD_PROMPT", "Prompt built", {
      prompt_version: "convert_to_asset_parts_v1",
      generation_mode: generationMode,
      provider,
      model: aiModel,
      variant_count: variantCount,
      structured_mode: {
        requires_journal_entry: requiresJournalEntry,
        scenario_split: hasScenarios,
        account_whitelist_enabled: accountWhitelistBlock.length > 0,
      },
      ui_settings: uiSettings,
      constraints_applied: constraintsBlock.length > 0,
      system_prompt_length: systemPrompt.length,
      user_prompt_length: userPrompt.length,
    });

    const promptCombined = `${systemPrompt}\n\n${userPrompt}`;
    const promptHash = await sha256Hex(promptCombined);
    const systemPreview = previewText(systemPrompt);
    const userPreview = previewText(userPrompt);

    const temperature = 0.2;
    const maxTokens = 8000;

    await logGenEvent(sbService, runId, ++eventSeq, "ai", "info", "AI_REQUEST", `Calling ${provider}/${aiModel}`, {
      provider,
      model: aiModel,
      temperature,
      max_tokens: maxTokens,
      json_mode: true,
      prompt_hash: promptHash,
      system_prompt_preview: { first: systemPreview.first, last: systemPreview.last },
      user_prompt_preview: { first: userPreview.first, last: userPreview.last },
    });

    const toolSpec = [
      {
        type: "function",
        function: {
          name: "create_teaching_asset_candidates",
          description: `Create ${variantCount} candidate scalable teaching assets from a raw problem. Each candidate uses a parts-based answer format.`,
          parameters: {
            type: "object",
            properties: {
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    asset_name: { type: "string", description: "Short clear name for this variant" },
                    tags: { type: "array", items: { type: "string" }, description: "2-6 concise concept tags" },
                    survive_problem_text: { type: "string", description: "Student-facing practice problem text" },
                    parts: {
                      type: "array",
                      description: "Ordered array of answer parts. Each part is either text or je type.",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string", description: "Part label: a, b, c, etc. (lowercase letter)" },
                          type: { type: "string", enum: ["text", "je"], description: "Part type" },
                          // Text part fields
                          final_answer: { type: "string", description: "Short final answer (text parts only)" },
                          explanation: { type: "string", description: "1-4 sentence reasoning (text parts only)" },
                          worked_steps: { type: "string", description: "Compact calculation steps (text parts only)" },
                          final_value: { type: "number", description: "Optional numeric value (text parts only)" },
                          units: { type: "string", description: "Optional units e.g. USD, % (text parts only)" },
                          // JE part fields
                          je_structured: {
                            type: "array",
                            description: "Array of journal entries by date (je parts only)",
                            items: {
                              type: "object",
                              properties: {
                                date: { type: "string", description: "Entry date" },
                                entries: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      account: { type: "string" },
                                      debit: { type: ["number", "null"] },
                                      credit: { type: ["number", "null"] },
                                    },
                                    required: ["account", "debit", "credit"],
                                  },
                                },
                              },
                              required: ["date", "entries"],
                            },
                          },
                        },
                        required: ["label", "type"],
                      },
                    },
                    answer_only: { type: "string", description: "Final numeric answers + JE summary only" },
                    survive_solution_text: { type: "string", description: "Fully worked step-by-step solution" },
                    ...(requiresJournalEntry ? {
                      journal_entry_block: { type: "string", description: "Text summary of JE for backward compatibility" },
                    } : {}),
                    exam_trap_note: { type: "string", description: "Internal note on what makes this tricky" },
                    important_formulas: { type: "string", description: "Formulas/equations needed, one per line" },
                    concept_notes: { type: "string", description: "2-5 bullet points on key concepts tested" },
                    exam_traps: { type: "string", description: "2-4 common student mistakes, specific and actionable" },
                  },
                  required: [
                    "asset_name", "tags", "survive_problem_text", "parts", "answer_only", "survive_solution_text",
                    "important_formulas", "concept_notes", "exam_traps",
                  ],
                },
                description: `Exactly ${variantCount} candidate teaching assets`,
              },
            },
            required: ["candidates"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiStartTime = Date.now();
    let response: Response;

    if (provider === "openai") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: toolSpec,
          tool_choice: { type: "function", function: { name: "create_teaching_asset_candidates" } },
        }),
      });
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: toolSpec,
          tool_choice: { type: "function", function: { name: "create_teaching_asset_candidates" } },
        }),
      });
    }

    const aiLatencyMs = Date.now() - aiStartTime;

    if (!response.ok) {
      const errStatus = response.status;
      const errText = await response.text();
      const errPreview = previewText(errText);

      await logGenEvent(sbService, runId, ++eventSeq, "ai", "error", "AI_RESPONSE", `AI error: ${errStatus}`, {
        status: errStatus,
        response_text_truncated: {
          first: errPreview.first,
          last: errPreview.last,
        },
        response_length_chars: errPreview.length,
        finish_reason: null,
        latency_ms: aiLatencyMs,
      });

      if (errStatus === 429) {
        throw new Error("Rate limit exceeded. Try again shortly.");
      }
      if (errStatus === 402) {
        throw new Error("AI credits exhausted. Add funds in Settings.");
      }
      throw new Error(`AI generation failed (${errStatus})`);
    }

    const data = await response.json();
    const rawResponseMessage = JSON.stringify(data?.choices?.[0]?.message ?? {});
    const aiResponsePreview = previewText(rawResponseMessage);

    await logGenEvent(sbService, runId, ++eventSeq, "ai", "info", "AI_RESPONSE", `Response received (${aiLatencyMs}ms)`, {
      response_text_truncated: {
        first: aiResponsePreview.first,
        last: aiResponsePreview.last,
      },
      response_length_chars: aiResponsePreview.length,
      finish_reason: data.choices?.[0]?.finish_reason ?? null,
      usage: data.usage ?? null,
      latency_ms: aiLatencyMs,
    });

    // Detailed raw response log for debugging
    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "AI_RESPONSE_RAW", "Raw AI response payload captured", {
      provider,
      model: aiModel,
      response_length: rawResponseMessage.length,
      first_2000_chars: rawResponseMessage.slice(0, 2000),
      last_2000_chars: rawResponseMessage.slice(-2000),
    });

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PARSE_JSON_START", "Parsing tool call JSON");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    let parseSource = "tool_call"; // track where we got JSON from

    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        const rawArgs = toolCall.function.arguments || "";
        await logGenEvent(sbService, runId, ++eventSeq, "backend", "warn", "PARSE_ERROR", "Tool call JSON parse failed, trying fallback", {
          error_message: parseError instanceof Error ? parseError.message : "Unknown",
          response_preview: rawArgs.slice(0, 3000),
        });
        // Try fallback on malformed tool_call arguments
        parsed = extractFirstJsonObject(rawArgs);
        if (parsed) parseSource = "tool_call_fallback";
      }
    }

    // Fallback: extract JSON from raw message content if tool_calls missing/failed
    if (!parsed) {
      const rawContent = data.choices?.[0]?.message?.content || "";
      if (rawContent) {
        await logGenEvent(sbService, runId, ++eventSeq, "backend", "warn", "PARSE_FALLBACK", "No tool_calls, attempting JSON extraction from message content", {
          content_length: rawContent.length,
          content_preview: rawContent.slice(0, 500),
        });
        parsed = extractFirstJsonObject(rawContent);
        if (parsed) parseSource = "content_fallback";
      }
    }

    // If still nothing, return structured error (NOT a 500)
    if (!parsed) {
      const rawPreview = (data.choices?.[0]?.message?.content || JSON.stringify(data.choices?.[0]?.message ?? {})).slice(0, 500);
      await logGenEvent(sbService, runId, ++eventSeq, "backend", "error", "AI_RESPONSE_UNSTRUCTURED", "Could not extract structured JSON from AI response", {
        raw_length: rawPreview.length,
        raw_preview: rawPreview,
      });

      const durationMs = Date.now() - runStartedAt;
      await finalizeRunRecord(sbService, {
        runId,
        status: "failed",
        durationMs,
        errorSummary: "AI did not return tool-call JSON",
        variantId: null,
        provider: runMeta.provider,
        model: runMeta.model,
        courseId: runMeta.course_id,
        chapterId: runMeta.chapter_id,
        sourceProblemId: runMeta.source_problem_id,
      });

      return new Response(JSON.stringify({
        ok: false,
        error_code: "AI_UNSTRUCTURED",
        message: "AI did not return tool-call JSON. Try again or switch providers.",
        raw_preview: rawPreview,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PARSE_JSON_END", `Parsed via ${parseSource}`, {
      parse_success: true,
      parse_source: parseSource,
    });

    const candidates = parsed.candidates || [];

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PARSE_JSON_END", `Parsed ${candidates.length} candidates`, {
      parse_success: true,
      extracted_top_level_keys: Object.keys(parsed || {}),
      candidate_count: candidates.length,
    });

    // Full first-candidate preview for debugging
    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PARSED_CANDIDATES", `${candidates.length} candidates extracted`, {
      candidate_count: candidates.length,
      candidates_preview: candidates.slice(0, 1),
    });

    // Post-generation whitelist check
    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "WHITELIST_APPLIED", `Whitelist ${whitelistEnabled ? "enabled" : "disabled"}`, {
      whitelist_enabled: whitelistEnabled,
      whitelist_count: whitelistNames.length,
    });

    if (whitelistEnabled && requiresJournalEntry) {
      const whitelistLower = new Set(whitelistNames.map(n => n.toLowerCase()));
      const unknownAccounts: Array<{ candidate_index: number; account_name: string }> = [];

      for (let ci = 0; ci < candidates.length; ci++) {
        const je = candidates[ci]?.je_structured;
        if (!je?.scenario_sections) continue;
        for (const sc of je.scenario_sections) {
          for (const entry of (sc.entries_by_date || [])) {
            for (const row of (entry.rows || [])) {
              const name = (row.account_name || "").trim();
              if (name && !whitelistLower.has(name.toLowerCase())) {
                unknownAccounts.push({ candidate_index: ci, account_name: name });
              }
            }
          }
        }
      }

      const uniqueUnknown = [...new Set(unknownAccounts.map(u => u.account_name))];

      await logGenEvent(sbService, runId, ++eventSeq, "backend",
        uniqueUnknown.length > 0 ? "warn" : "info",
        "UNKNOWN_ACCOUNTS_FOUND",
        uniqueUnknown.length > 0
          ? `${uniqueUnknown.length} unknown account(s): ${uniqueUnknown.join(", ")}`
          : "All accounts match whitelist",
        {
          unknown_accounts: uniqueUnknown,
          unknown_count: uniqueUnknown.length,
          total_account_references: unknownAccounts.length,
          details: unknownAccounts.slice(0, 20),
        }
      );
    }

    // Post-processing: replace any non-standard company names with Survive Company / Survive Counterparty
    const companyNameReplacements: Array<{ candidate_index: number; field: string; original: string }> = [];
    for (let ci = 0; ci < candidates.length; ci++) {
      const c = candidates[ci];
      // Replace in problem text
      if (c.survive_problem_text && typeof c.survive_problem_text === "string") {
        const original = c.survive_problem_text;
        // The AI should already use Survive Company, but if it didn't, we can't regex-guess arbitrary names.
        // Instead, log a warning if neither Survive Company nor Survive Counterparty appear.
        if (!original.includes(SURVIVE_COMPANY) && !original.includes(SURVIVE_COUNTERPARTY)) {
          companyNameReplacements.push({ candidate_index: ci, field: "survive_problem_text", original: original.slice(0, 200) });
        }
      }
      if (c.survive_solution_text && typeof c.survive_solution_text === "string") {
        if (!c.survive_solution_text.includes(SURVIVE_COMPANY) && !c.survive_solution_text.includes(SURVIVE_COUNTERPARTY)) {
          companyNameReplacements.push({ candidate_index: ci, field: "survive_solution_text", original: c.survive_solution_text.slice(0, 200) });
        }
      }
    }

    if (companyNameReplacements.length > 0) {
      await logGenEvent(sbService, runId, ++eventSeq, "validator", "warn", "COMPANY_NAME_CHECK",
        `${companyNameReplacements.length} field(s) missing standard company name`, {
          replacements: companyNameReplacements,
        }
      );
    } else {
      await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "COMPANY_NAME_CHECK",
        "All candidates use standard Survive Company name", {});
    }

    await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "VALIDATE_SCHEMA_START", "Validating candidate schema", {
      schema_name: "create_teaching_asset_candidates",
      expected_candidate_count: variantCount,
    });

    const schemaErrors = validateCandidates(candidates, variantCount);
    if (schemaErrors.length > 0) {
      await logGenEvent(sbService, runId, ++eventSeq, "validator", "error", "VALIDATE_SCHEMA_END", "Schema validation failed", {
        schema_name: "create_teaching_asset_candidates",
        success: false,
        zod_errors: schemaErrors,
      });
      throw new Error(`Schema validation failed: ${schemaErrors[0]}`);
    }

    await logGenEvent(sbService, runId, ++eventSeq, "validator", "info", "VALIDATE_SCHEMA_END", "Schema validation passed", {
      schema_name: "create_teaching_asset_candidates",
      success: true,
      zod_errors: [],
    });

    // Parts-based validation for all modes
    const allHaveParts = candidates.every((c: any) => Array.isArray(c.parts) && c.parts.length >= 1);
    if (!allHaveParts) {
      await logGenEvent(sbService, runId, ++eventSeq, "validator", "warn", "VALIDATE_PARTS",
        "Some candidates missing parts[] array — will attempt legacy conversion on frontend", {});
    } else {
      // Validate parts structure
      const partsErrors: string[] = [];
      candidates.forEach((c: any, ci: number) => {
        (c.parts || []).forEach((p: any, pi: number) => {
          if (!p.label) partsErrors.push(`candidates[${ci}].parts[${pi}] missing label`);
          if (!["text", "je"].includes(p.type)) partsErrors.push(`candidates[${ci}].parts[${pi}] invalid type: ${p.type}`);
          if (p.type === "text" && !p.final_answer) partsErrors.push(`candidates[${ci}].parts[${pi}] text part missing final_answer`);
          if (p.type === "je" && !Array.isArray(p.je_structured)) partsErrors.push(`candidates[${ci}].parts[${pi}] je part missing je_structured`);
        });
      });
      await logGenEvent(sbService, runId, ++eventSeq, "validator", partsErrors.length > 0 ? "warn" : "info", "VALIDATE_PARTS",
        partsErrors.length > 0 ? `Parts validation: ${partsErrors.length} issues` : "Parts validation passed",
        { errors: partsErrors }
      );
    }

    // Quality validators for text parts (same self-correction checks)
    if (generationMode !== "je_only") {
      // Build legacy answer_parts from parts for quality validators
      const legacyCandidates = candidates.map((c: any) => ({
        ...c,
        answer_parts: (c.parts || []).filter((p: any) => p.type === "text").map((p: any) => ({
          label: p.label,
          final_answer: p.final_answer,
          steps: p.worked_steps || p.explanation || "",
        })),
      }));
      const nonJeQualityResults = runNonJeQualityValidators(legacyCandidates, problemText, solutionText);
      await logGenEvent(sbService, runId, ++eventSeq, "validator",
        nonJeQualityResults.some(r => r.status === "fail") ? "warn" : "info",
        "VALIDATE_TEXT_QUALITY",
        `Text quality: ${nonJeQualityResults.filter(r => r.status === "fail").length} failures`,
        { results: nonJeQualityResults }
      );
      for (const c of candidates) {
        c._non_je_quality_results = nonJeQualityResults.filter((r: any) => r.candidate_index !== undefined ? r.candidate_index === candidates.indexOf(c) : true);
      }
    }

    // Annotate candidates with generation_mode and parts counts
    for (const c of candidates) {
      c._generation_mode = generationMode;
      const parts = c.parts || [];
      c._problem_type_detected = generationMode;
      c._parts_detected = parts.length;
      c._je_parts_count = parts.filter((p: any) => p.type === "je").length;
      c._text_parts_count = parts.filter((p: any) => p.type === "text").length;
    }

    // Log problem type detection summary
    const firstCandidate = candidates[0];
    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "PROBLEM_TYPE_SUMMARY",
      `Detected: ${generationMode} | Parts: ${firstCandidate?._parts_detected ?? 0} (${firstCandidate?._text_parts_count ?? 0} text, ${firstCandidate?._je_parts_count ?? 0} JE)`, {
      problem_type_detected: generationMode,
      parts_detected: firstCandidate?._parts_detected ?? 0,
      je_parts_count: firstCandidate?._je_parts_count ?? 0,
      text_parts_count: firstCandidate?._text_parts_count ?? 0,
      candidate_count: candidates.length,
    });

    // Compute validator summary from candidate annotations
    const _nonJeFailures = candidates.some((c: any) => (c._non_je_quality_results || []).some((r: any) => r.status === "fail"));
    const validatorFailed = _nonJeFailures;
    const jeValidationFailed = false; // JE validation runs separately in normalize_validate_persist
    const validatorResults = candidates.map((c: any) => c._non_je_quality_results || []).flat();

    await logGenEvent(
      sbService,
      runId,
      ++eventSeq,
      "validator",
      validatorFailed ? "warn" : "info",
      "RUN_VALIDATORS_END",
      validatorFailed
        ? `Quality validation warnings detected`
        : "Validator pass complete",
      {
        validator_results: validatorResults,
        je_validation_failed: jeValidationFailed,
        requires_je: requiresJournalEntry,
        generation_mode: generationMode,
        validator_set_used: generationMode === "text_only" ? "TEXT_VALIDATORS" : generationMode === "je_only" ? "JE_VALIDATORS" : "HYBRID_VALIDATORS",
        candidate_keys_present: candidates.length > 0 ? Object.keys(candidates[0]) : [],
      }
    );

    // Log what would be saved as variant rows (for frontend persistence)
    const variantPreviewRows = candidates.slice(0, 1).map((c: any, i: number) => ({
      variant_label: `Variant ${String.fromCharCode(65 + i)}`,
      survive_problem_text: c.survive_problem_text?.slice(0, 500) || "",
      survive_solution_text: c.survive_solution_text?.slice(0, 500) || "",
      je_structured: c.je_structured ?? null,
      answer_only: c.answer_only?.slice(0, 300) || "",
      tags: c.tags ?? [],
      _je_valid: c._je_valid,
      _status: c._status,
    }));

    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "VARIANT_SAVE_PAYLOAD", `Preview of ${candidates.length} rows to insert`, {
      rows_to_insert_preview: variantPreviewRows,
    });

    await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_START", "No backend variant persistence for candidates mode", {
      persisted: false,
      reason: "Variants are persisted by frontend after review",
    });

    await logGenEvent(sbService, runId, ++eventSeq, "db", "info", "SAVE_VARIANT_END", "No variant rows inserted by backend", {
      inserted_variant_ids: [],
      persisted: false,
    });

    const durationMs = Date.now() - runStartedAt;
    await logGenEvent(sbService, runId, ++eventSeq, "backend", "info", "FINALIZE_RUN", "Candidates generated — frontend will finalize run after variant persistence", {
      status: "pending_frontend_finalize",
      duration_ms: durationMs,
      note: "variant_id will be set by frontend after inserting problem_variants rows",
      je_validation_failed: jeValidationFailed,
    });

    // Do NOT call finalizeRunRecord here for candidates mode.
    // The frontend inserts variants, captures IDs, and calls logger.finalize()
    // which writes variant_id + debug_bundle_json to generation_runs.

    const constraintsCount = constraintsBlock
      ? constraintsBlock.split("\n").filter((l: string) => l.match(/^\d+\./)).length
      : 0;
    const scenarioLabels = scenarioBlocks?.map((b: any) => b.label) ?? [];

    return new Response(JSON.stringify({
      success: true,
      candidates,
      constraints_count: constraintsCount,
      scenario_labels: scenarioLabels,
      validator_results: validatorResults,
      requires_je: requiresJournalEntry,
      je_validation_failed: jeValidationFailed,
      generation_mode: generationMode,
      whitelist_enabled: whitelistEnabled,
      whitelist_count: whitelistNames.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("convert-to-asset error:", e);

    const errorMessage = e instanceof Error ? e.message : "Unknown error";

    if (sbService && runId) {
      const durationMs = Date.now() - runStartedAt;

      await logGenEvent(sbService, runId, ++eventSeq, "backend", "error", "FINALIZE_RUN", "Finalizing generation run with failure", {
        status: "failed",
        duration_ms: durationMs,
        error_summary: errorMessage,
      });

      await finalizeRunRecord(sbService, {
        runId,
        status: "failed",
        durationMs,
        errorSummary: errorMessage,
        variantId: null,
        provider: runMeta.provider,
        model: runMeta.model,
        courseId: runMeta.course_id,
        chapterId: runMeta.chapter_id,
        sourceProblemId: runMeta.source_problem_id,
      });
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

