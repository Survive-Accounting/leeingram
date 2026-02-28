/**
 * Legacy JE Text → Structured Canonical JSON normalizer
 * 
 * Parses unstructured text like:
 *   "Debit Cash 350,000" / "Credit Bonds Payable 350,000"
 *   "Situation 1: Jul 1 Cash 350,000"
 * into canonical scenario_sections → entries_by_date → rows
 */

import type { CanonicalScenarioSection, CanonicalEntryByDate, CanonicalJERow } from "@/lib/journalEntryParser";

// ── Requires JE detection ──

const REQUIRES_JE_PHRASES = [
  /prepare\s+(?:the\s+)?journal\s+entr/i,
  /record\s+(?:the\s+)?(?:following\s+)?journal\s+entr/i,
  /prepare\s+(?:the\s+)?entries?\s+to\s+record/i,
  /journalize/i,
  /make\s+(?:the\s+)?(?:necessary\s+)?journal\s+entr/i,
  /\bjournal\s+entr(?:y|ies)\b/i,
];

/** Returns true if the problem text requires journal entries */
export function detectRequiresJE(text: string | null | undefined): boolean {
  if (!text) return false;
  return REQUIRES_JE_PHRASES.some(p => p.test(text));
}

// ── Normalization tokens to strip from account names ──

const STRIP_TOKENS: RegExp[] = [
  /^\s*(?:debit|dr\.?)\s+/i,
  /^\s*(?:credit|cr\.?)\s+/i,
  /^\s*[a-c]\.\s+/i,
  /^\s*\d+\.\s+/i,
  /^\s*(?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+)\s*[—\-–:]\s*/i,
];

const BANNED_IN_ACCOUNT = /[$:]/;

// ── Side detection from prefix token ──

function detectSideFromPrefix(line: string): { side: "debit" | "credit" | null; cleaned: string } {
  if (/^\s*(?:debit|dr\.?)\s+/i.test(line)) {
    return { side: "debit", cleaned: line.replace(/^\s*(?:debit|dr\.?)\s+/i, "") };
  }
  if (/^\s*(?:credit|cr\.?)\s+/i.test(line)) {
    return { side: "credit", cleaned: line.replace(/^\s*(?:credit|cr\.?)\s+/i, "") };
  }
  return { side: null, cleaned: line };
}

// ── Parse a single text line into account_name + amount ──

function parseLineToRow(raw: string): CanonicalJERow | null {
  let line = raw.trim();
  if (!line) return null;

  // Detect side from prefix
  const { side, cleaned } = detectSideFromPrefix(line);
  line = cleaned;

  // Strip lettering, numbering
  for (const token of STRIP_TOKENS) {
    line = line.replace(token, "");
  }

  // Extract amount at end: "Cash 350,000" or "Cash $350,000"
  const amountMatch = line.match(/^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/);
  if (amountMatch) {
    let accountName = amountMatch[1].trim();
    const amount = parseFloat(amountMatch[2].replace(/,/g, ""));

    // Clean banned chars from account name
    accountName = accountName.replace(/[$:]/g, "").replace(/\s{2,}/g, " ").trim();
    // Remove trailing Debit/Credit/Dr/Cr from account name
    accountName = accountName.replace(/\s+(?:Debit|Credit|Dr\.?|Cr\.?)\s*$/i, "").trim();

    if (side === "credit") {
      return { account_name: accountName, debit: null, credit: amount };
    } else {
      // default to debit if no side detected
      return { account_name: accountName, debit: amount, credit: null };
    }
  }

  // No amount found — just account name
  let accountName = line.replace(/[$:]/g, "").replace(/\s{2,}/g, " ").trim();
  accountName = accountName.replace(/\s+(?:Debit|Credit|Dr\.?|Cr\.?)\s*$/i, "").trim();
  if (!accountName) return null;

  return { account_name: accountName, debit: null, credit: null };
}

// ── Scenario/date grouping patterns ──

const SCENARIO_HEADER = /^(?:Situation|Case|Scenario)\s+(\d+|[A-Z]|[IVX]+)\s*[—\-–:]/i;
const DATE_HEADER = /^((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{2,4})?)/i;

export interface NormalizeResult {
  scenario_sections: CanonicalScenarioSection[];
  success: boolean;
  rowCount: number;
}

/** COA lookup entry for matching during normalization */
export interface COALookupEntry {
  id: string;
  canonical_name: string;
  keywords: string[] | null;
}

/** Parse legacy JE text into canonical structured format, optionally resolving to COA */
export function normalizeLegacyJEText(text: string, coaLookup?: COALookupEntry[]): NormalizeResult {
  if (!text?.trim()) return { scenario_sections: [], success: false, rowCount: 0 };

  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  
  // Skip header-like lines
  const filteredLines = lines.filter(l => !/^account\s*[\|]\s*debit\s*[\|]\s*credit/i.test(l) && !/^[-|=\s]+$/.test(l));

  let currentScenario = "Scenario 1";
  let currentDate = "";
  const scenarioMap = new Map<string, Map<string, CanonicalJERow[]>>();

  for (const line of filteredLines) {
    // Check for scenario header
    const scenarioMatch = line.match(SCENARIO_HEADER);
    if (scenarioMatch) {
      currentScenario = `Situation ${scenarioMatch[1]}`;
      // Check if rest of line has content after the header
      const rest = line.replace(SCENARIO_HEADER, "").trim();
      if (rest) {
        // May contain a date or JE line
        const dateMatch = rest.match(DATE_HEADER);
        if (dateMatch) {
          currentDate = dateMatch[1];
          const afterDate = rest.replace(DATE_HEADER, "").replace(/^[:\s]+/, "").trim();
          if (afterDate) {
            const row = parseLineToRow(afterDate);
            if (row) addRow(scenarioMap, currentScenario, currentDate, row);
          }
        } else {
          const row = parseLineToRow(rest);
          if (row) addRow(scenarioMap, currentScenario, currentDate || "Entry 1", row);
        }
      }
      continue;
    }

    // Check for date header
    const dateMatch = line.match(DATE_HEADER);
    if (dateMatch) {
      currentDate = dateMatch[1];
      const rest = line.replace(DATE_HEADER, "").replace(/^[:\s]+/, "").trim();
      if (rest) {
        const row = parseLineToRow(rest);
        if (row) addRow(scenarioMap, currentScenario, currentDate, row);
      }
      continue;
    }

    // Regular JE line
    const row = parseLineToRow(line);
    if (row) {
      addRow(scenarioMap, currentScenario, currentDate || "Entry 1", row);
    }
  }

  // Build output + resolve to COA
  const sections: CanonicalScenarioSection[] = [];
  let rowCount = 0;
  for (const [label, dateMap] of scenarioMap) {
    const entries: CanonicalEntryByDate[] = [];
    for (const [date, rows] of dateMap) {
      // Resolve rows to COA if lookup provided
      const resolvedRows = coaLookup ? rows.map(row => resolveRowToCOA(row, coaLookup)) : rows;
      entries.push({ entry_date: date, rows: resolvedRows });
      rowCount += resolvedRows.length;
    }
    sections.push({ label, entries_by_date: entries });
  }

  // If only one scenario and it's the default, relabel
  if (sections.length === 1 && sections[0].label === "Scenario 1") {
    sections[0].label = "Journal Entry";
  }

  return { scenario_sections: sections, success: rowCount > 0, rowCount };
}

/** Try to match a row's account_name to a COA entry */
function resolveRowToCOA(row: CanonicalJERow, coaLookup: COALookupEntry[]): CanonicalJERow {
  const lower = row.account_name.toLowerCase().trim();
  if (!lower) return row;

  // Direct match on canonical_name
  const direct = coaLookup.find(e => e.canonical_name.toLowerCase() === lower);
  if (direct) {
    return { ...row, account_name: direct.canonical_name, coa_id: direct.id, unknown_account: false };
  }

  // Match via keywords
  const kwMatch = coaLookup.find(e =>
    e.keywords?.some(k => k.toLowerCase() === lower)
  );
  if (kwMatch) {
    return { ...row, account_name: kwMatch.canonical_name, coa_id: kwMatch.id, unknown_account: false };
  }

  // No match found
  return { ...row, unknown_account: true };
}

function addRow(map: Map<string, Map<string, CanonicalJERow[]>>, scenario: string, date: string, row: CanonicalJERow) {
  if (!map.has(scenario)) map.set(scenario, new Map());
  const dateMap = map.get(scenario)!;
  if (!dateMap.has(date)) dateMap.set(date, []);
  dateMap.get(date)!.push(row);
}
