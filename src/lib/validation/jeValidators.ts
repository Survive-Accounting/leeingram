/**
 * Global Journal Entry Validators
 * Run on every answer package that contains journal entries.
 */

import type { Validator, ValidationResult, AnswerPackageData } from "./validationEngine";

/** Extract JE sections from answer_payload (handles multiple storage formats) */
function extractJESections(pkg: AnswerPackageData): Array<{
  entry_date: string;
  sectionIndex: number;
  lines: Array<{
    account_name: string;
    debit: number | null;
    credit: number | null;
    memo: string;
    lineIndex: number;
  }>;
}> {
  const payload = pkg.answer_payload;
  const sections: any[] = [];

  // teaching_aids.journal_entries (structured format)
  if (payload?.teaching_aids?.journal_entries && Array.isArray(payload.teaching_aids.journal_entries)) {
    return payload.teaching_aids.journal_entries.map((s: any, si: number) => ({
      entry_date: s.entry_date || "",
      sectionIndex: si,
      lines: (s.lines || s.rows || []).map((l: any, li: number) => ({
        account_name: l.account_name || "",
        debit: l.debit != null ? Number(l.debit) : null,
        credit: l.credit != null ? Number(l.credit) : null,
        memo: l.memo || "",
        lineIndex: li,
      })),
    }));
  }

  // Legacy je_rows at top level
  if (payload?.je_rows && Array.isArray(payload.je_rows)) {
    return [{
      entry_date: "",
      sectionIndex: 0,
      lines: payload.je_rows.map((l: any, li: number) => ({
        account_name: l.account || l.account_name || "",
        debit: l.debit != null ? Number(l.debit) : null,
        credit: l.credit != null ? Number(l.credit) : null,
        memo: l.memo || "",
        lineIndex: li,
      })),
    }];
  }

  return sections;
}

// Date-like patterns
const DATE_PATTERNS = [
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
  /\b20\d{2}\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
];

// Narrative prefix pattern (e.g., "Issue Bonds: Cash")
const NARRATIVE_PREFIX_PATTERN = /^.{4,}:\s*/;

// ─── V1: JE_BALANCES (HARD) ───
export const jeBalances: Validator = (pkg) => {
  const sections = extractJESections(pkg);
  if (sections.length === 0) return { validator: "JE_BALANCES", status: "pass", message: "No JE sections found, skipped" };

  const failures: string[] = [];
  const details: Record<string, any> = { sections: [] };

  for (const s of sections) {
    if (s.lines.length === 0) continue;
    const debits = s.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
    const credits = s.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
    const diff = Math.abs(debits - credits);
    const sectionInfo = { sectionIndex: s.sectionIndex, entry_date: s.entry_date, debits, credits, diff, balanced: diff <= 1.0 };
    details.sections.push(sectionInfo);
    if (diff > 1.0) {
      failures.push(`Section ${s.sectionIndex + 1}${s.entry_date ? ` (${s.entry_date})` : ""}: debits ${debits.toFixed(2)} ≠ credits ${credits.toFixed(2)} (off by ${diff.toFixed(2)})`);
    }
  }

  return {
    validator: "JE_BALANCES",
    status: failures.length > 0 ? "fail" : "pass",
    message: failures.length > 0 ? failures.join("; ") : `All ${sections.length} JE section(s) balanced`,
    details,
  };
};

// ─── V2: NO_DATES_IN_ACCOUNT_NAMES (HARD) ───
export const noDatesInAccountNames: Validator = (pkg) => {
  const sections = extractJESections(pkg);
  if (sections.length === 0) return { validator: "NO_DATES_IN_ACCOUNT_NAMES", status: "pass", message: "No JE, skipped" };

  const offending: Array<{ sectionIndex: number; lineIndex: number; account_name: string; matchedPattern: string }> = [];

  for (const s of sections) {
    for (const l of s.lines) {
      if (!l.account_name) continue;
      for (const p of DATE_PATTERNS) {
        const match = l.account_name.match(p);
        if (match) {
          offending.push({ sectionIndex: s.sectionIndex, lineIndex: l.lineIndex, account_name: l.account_name, matchedPattern: match[0] });
          break;
        }
      }
    }
  }

  return {
    validator: "NO_DATES_IN_ACCOUNT_NAMES",
    status: offending.length > 0 ? "fail" : "pass",
    message: offending.length > 0
      ? `${offending.length} account name(s) contain date-like text: ${offending.map(o => `"${o.account_name}"`).join(", ")}`
      : "No dates found in account names",
    details: { offending },
  };
};

// ─── V3: NO_NARRATIVE_PREFIX_IN_ACCOUNT_NAMES (HARD) ───
export const noNarrativePrefixInAccountNames: Validator = (pkg) => {
  const sections = extractJESections(pkg);
  if (sections.length === 0) return { validator: "NO_NARRATIVE_PREFIX", status: "pass", message: "No JE, skipped" };

  const offending: Array<{ sectionIndex: number; lineIndex: number; account_name: string; prefix: string; suggestedName: string }> = [];

  for (const s of sections) {
    for (const l of s.lines) {
      if (!l.account_name) continue;
      const colonIdx = l.account_name.indexOf(":");
      if (colonIdx >= 4) {
        const prefix = l.account_name.slice(0, colonIdx).trim();
        const after = l.account_name.slice(colonIdx + 1).trim();
        offending.push({
          sectionIndex: s.sectionIndex,
          lineIndex: l.lineIndex,
          account_name: l.account_name,
          prefix,
          suggestedName: after || l.account_name,
        });
      }
    }
  }

  return {
    validator: "NO_NARRATIVE_PREFIX",
    status: offending.length > 0 ? "fail" : "pass",
    message: offending.length > 0
      ? `${offending.length} account name(s) contain narrative prefixes: ${offending.map(o => `"${o.account_name}"`).join(", ")}`
      : "No narrative prefixes found",
    details: { offending },
  };
};

// ─── V4: ONE_SIDED_ROWS (HARD) ───
export const oneSidedRows: Validator = (pkg) => {
  const sections = extractJESections(pkg);
  if (sections.length === 0) return { validator: "ONE_SIDED_ROWS", status: "pass", message: "No JE, skipped" };

  const offending: Array<{ sectionIndex: number; lineIndex: number; account_name: string; issue: "both" | "neither" }> = [];

  for (const s of sections) {
    for (const l of s.lines) {
      const hasDebit = l.debit != null && l.debit !== 0;
      const hasCredit = l.credit != null && l.credit !== 0;
      if (hasDebit && hasCredit) {
        offending.push({ sectionIndex: s.sectionIndex, lineIndex: l.lineIndex, account_name: l.account_name, issue: "both" });
      } else if (!hasDebit && !hasCredit && l.account_name) {
        offending.push({ sectionIndex: s.sectionIndex, lineIndex: l.lineIndex, account_name: l.account_name, issue: "neither" });
      }
    }
  }

  return {
    validator: "ONE_SIDED_ROWS",
    status: offending.length > 0 ? "fail" : "pass",
    message: offending.length > 0
      ? `${offending.length} row(s) have invalid debit/credit: ${offending.map(o => `"${o.account_name}" (${o.issue})`).join(", ")}`
      : "All rows have exactly one side",
    details: { offending },
  };
};

// ─── V5: CASH_DIRECTION_SANITY (SOFT WARN) ───
const CASH_DEBIT_WARN_KEYWORDS = ["purchase", "acquire", "redeem", "retire", "call", "settle", "pay", "bought", "paid"];
const CASH_CREDIT_WARN_KEYWORDS = ["issue", "proceeds", "borrow", "collected", "receive", "sale", "sold", "earned"];

export const cashDirectionSanity: Validator = (pkg) => {
  const sections = extractJESections(pkg);
  if (sections.length === 0) return { validator: "CASH_DIRECTION_SANITY", status: "pass", message: "No JE, skipped" };

  const warnings: Array<{ sectionIndex: number; lineIndex: number; account_name: string; reason: string }> = [];

  for (const s of sections) {
    // Build context string from entry_date + all memos
    const context = [s.entry_date, ...s.lines.map(l => l.memo)].join(" ").toLowerCase();

    for (const l of s.lines) {
      if (!l.account_name.toLowerCase().includes("cash")) continue;

      const hasCashDebit = l.debit != null && l.debit > 0;
      const hasCashCredit = l.credit != null && l.credit > 0;

      if (hasCashDebit && CASH_DEBIT_WARN_KEYWORDS.some(kw => context.includes(kw))) {
        warnings.push({
          sectionIndex: s.sectionIndex, lineIndex: l.lineIndex,
          account_name: l.account_name,
          reason: `Cash debited but context suggests cash outflow (keywords: ${CASH_DEBIT_WARN_KEYWORDS.filter(kw => context.includes(kw)).join(", ")})`,
        });
      }
      if (hasCashCredit && CASH_CREDIT_WARN_KEYWORDS.some(kw => context.includes(kw))) {
        warnings.push({
          sectionIndex: s.sectionIndex, lineIndex: l.lineIndex,
          account_name: l.account_name,
          reason: `Cash credited but context suggests cash inflow (keywords: ${CASH_CREDIT_WARN_KEYWORDS.filter(kw => context.includes(kw)).join(", ")})`,
        });
      }
    }
  }

  return {
    validator: "CASH_DIRECTION_SANITY",
    status: warnings.length > 0 ? "warn" : "pass",
    message: warnings.length > 0
      ? `${warnings.length} potential cash direction issue(s)`
      : "Cash directions look reasonable",
    details: { warnings },
  };
};

// ─── V6: SCENARIO_SECTIONS_PRESENT (HARD) ───
// When scenario_labels metadata exists, ensure output contains matching scenario_sections
export const scenarioSectionsPresent: Validator = (pkg) => {
  const scenarioLabels: string[] = pkg.extracted_inputs?.scenario_labels || [];
  if (scenarioLabels.length === 0) {
    return { validator: "SCENARIO_SECTIONS_PRESENT", status: "pass", message: "Not a multi-scenario problem, skipped" };
  }

  const payload = pkg.answer_payload;

  // Check for scenario_sections wrapper structure first
  const scenarioSections: any[] = payload?.scenario_sections || payload?.teaching_aids?.scenario_sections || [];

  if (scenarioSections.length > 0) {
    // Validate each expected label has a matching section
    const foundLabels = scenarioSections.map((s: any) => (s.label || "").toLowerCase());
    const missing: string[] = [];
    for (const label of scenarioLabels) {
      const labelLower = label.toLowerCase();
      if (!foundLabels.some(fl => fl.includes(labelLower))) missing.push(label);
    }

    if (missing.length > 0) {
      return {
        validator: "SCENARIO_SECTIONS_PRESENT",
        status: "fail",
        message: `Missing scenario_sections for: ${missing.join(", ")}. Expected ${scenarioLabels.length} scenario sections.`,
        details: { expected: scenarioLabels, missing, found: foundLabels },
      };
    }

    return {
      validator: "SCENARIO_SECTIONS_PRESENT",
      status: "pass",
      message: `All ${scenarioLabels.length} scenario(s) have scenario_sections`,
      details: { expected: scenarioLabels, found: foundLabels },
    };
  }

  // Fallback: check entry_date labels in flat JE sections
  const sections = extractJESections(pkg);
  if (sections.length === 0) {
    return {
      validator: "SCENARIO_SECTIONS_PRESENT",
      status: "fail",
      message: `Missing scenario_sections for multi-situation problem. Expected ${scenarioLabels.length} scenario sections but found none.`,
      details: { expected: scenarioLabels, found: [] },
    };
  }

  const sectionDates = sections.map(s => (s.entry_date || "").toLowerCase());
  const missing: string[] = [];
  for (const label of scenarioLabels) {
    const labelLower = label.toLowerCase();
    const found = sectionDates.some(d => d.includes(labelLower));
    if (!found) missing.push(label);
  }

  if (missing.length > 0) {
    return {
      validator: "SCENARIO_SECTIONS_PRESENT",
      status: "fail",
      message: `Missing scenario_sections for multi-situation problem. Got a single mixed blob instead of per-scenario entries for: ${missing.join(", ")}.`,
      details: { expected: scenarioLabels, missing, found_dates: sectionDates },
    };
  }

  return {
    validator: "SCENARIO_SECTIONS_PRESENT",
    status: "pass",
    message: `All ${scenarioLabels.length} scenario(s) have JE sections`,
    details: { expected: scenarioLabels },
  };
};

// ─── V7: ACCOUNT_FIELD_FORMATTING (HARD) ───
// Detect narrative leakage in account_name fields
const ACCOUNT_FIELD_BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\$/, reason: "dollar sign" },
  { pattern: /:\s/, reason: "colon (narrative prefix)" },
  { pattern: /^[a-c]\.\s/i, reason: "lettered prefix (a./b./c.)" },
  { pattern: /^\d+\.\s/, reason: "numeric prefix" },
  { pattern: /\bto record\b/i, reason: "narrative phrase 'to record'" },
  { pattern: /\bdebit\b/i, reason: "embedded debit text" },
  { pattern: /\bcredit\b/i, reason: "embedded credit text" },
  { pattern: /\bdr\b\.?/i, reason: "embedded Dr abbreviation" },
  { pattern: /\bcr\b\.?/i, reason: "embedded Cr abbreviation" },
];

export const accountFieldFormatting: Validator = (pkg) => {
  const sections = extractJESections(pkg);
  if (sections.length === 0) return { validator: "ACCOUNT_FIELD_FORMATTING", status: "pass", message: "No JE, skipped" };

  const offending: Array<{ sectionIndex: number; lineIndex: number; account_name: string; reasons: string[] }> = [];

  for (const s of sections) {
    for (const l of s.lines) {
      if (!l.account_name) continue;
      const reasons: string[] = [];
      for (const { pattern, reason } of ACCOUNT_FIELD_BANNED_PATTERNS) {
        if (pattern.test(l.account_name)) reasons.push(reason);
      }
      if (reasons.length > 0) {
        offending.push({ sectionIndex: s.sectionIndex, lineIndex: l.lineIndex, account_name: l.account_name, reasons });
      }
    }
  }

  return {
    validator: "ACCOUNT_FIELD_FORMATTING",
    status: offending.length > 0 ? "fail" : "pass",
    message: offending.length > 0
      ? `Narrative leakage detected in account field: ${offending.map(o => `"${o.account_name}" (${o.reasons.join(", ")})`).join("; ")}`
      : "All account fields clean",
    details: { offending },
  };
};

// ─── Export all JE validators ───
export const JE_VALIDATORS: Validator[] = [
  jeBalances,
  noDatesInAccountNames,
  noNarrativePrefixInAccountNames,
  oneSidedRows,
  cashDirectionSanity,
  scenarioSectionsPresent,
  accountFieldFormatting,
];

// ─── Auto-fix helpers ───

export interface AutoFixResult {
  fixed: boolean;
  description: string;
  sections: any[];
}

/** Strip date tokens from account_name and move to entry_date */
export function autoFixDatesInAccountNames(sections: any[]): AutoFixResult {
  let fixCount = 0;
  const fixed = sections.map((s: any) => {
    const newLines = (s.lines || []).map((l: any) => {
      let name = l.account_name || "";
      for (const p of DATE_PATTERNS) {
        const match = name.match(p);
        if (match) {
          // Move date to entry_date if empty
          if (!s.entry_date && match[0]) {
            s = { ...s, entry_date: match[0] };
          }
          name = name.replace(p, "").replace(/^\s*[-:–]\s*/, "").trim();
          fixCount++;
        }
      }
      return { ...l, account_name: name };
    });
    return { ...s, lines: newLines };
  });
  return { fixed: fixCount > 0, description: `Stripped dates from ${fixCount} account name(s)`, sections: fixed };
}

/** Split narrative prefix (text before ":") into memo */
export function autoFixNarrativePrefixes(sections: any[]): AutoFixResult {
  let fixCount = 0;
  const fixed = sections.map((s: any) => ({
    ...s,
    lines: (s.lines || []).map((l: any) => {
      const name = l.account_name || "";
      const colonIdx = name.indexOf(":");
      if (colonIdx >= 4) {
        const prefix = name.slice(0, colonIdx).trim();
        const after = name.slice(colonIdx + 1).trim();
        if (after) {
          fixCount++;
          return { ...l, account_name: after, memo: l.memo ? `${prefix}; ${l.memo}` : prefix };
        }
      }
      return l;
    }),
  }));
  return { fixed: fixCount > 0, description: `Split ${fixCount} narrative prefix(es) into memo`, sections: fixed };
}
