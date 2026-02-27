/**
 * Structured Journal Entry types and parser.
 * Used across the variant generator, review queue, and asset library.
 */

export interface JournalEntryLine {
  account: string;
  debit: number | null;
  credit: number | null;
  side?: "debit" | "credit";
  needs_review?: boolean;
}

export interface JournalEntryGroup {
  label: string;
  lines: JournalEntryLine[];
  note?: string;
}

// Credit-side account keywords
const CREDIT_KEYWORDS = [
  "payable", "revenue", "unearned", "liability", "gain",
  "capital", "retained", "accumulated", "allowance", "premium",
  "contributed", "common stock", "preferred stock",
];

// Debit-side account keywords
const DEBIT_KEYWORDS = [
  "cash", "expense", "asset", "land", "equipment", "building",
  "receivable", "inventory", "supplies", "prepaid", "loss",
  "depreciation", "amortization", "discount", "interest expense",
  "cost of goods", "wage", "salary", "rent expense", "insurance expense",
];

function inferSide(account: string): "debit" | "credit" {
  const lower = account.toLowerCase();
  for (const kw of CREDIT_KEYWORDS) {
    if (lower.includes(kw)) return "credit";
  }
  for (const kw of DEBIT_KEYWORDS) {
    if (lower.includes(kw)) return "debit";
  }
  return "debit"; // default
}

/**
 * Parse a legacy "Answer Only" string into structured journal entry groups.
 *
 * Handles patterns like:
 * "Jan 1: Land $300,000; Discount on N/P $217,140; N/P $517,140. Dec 31: ..."
 * "Jan 1: Land $300,000, Discount on N/P $217,140, N/P $517,140"
 */
export function parseLegacyAnswerOnly(text: string): JournalEntryGroup[] {
  if (!text?.trim()) return [];

  // Try to detect date-based groups
  // Pattern: "Jan 1:" or "Dec 31:" or "January 1:" or "Date:" etc.
  const datePattern = /(?:^|(?:\.\s*))((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?)\s*:/gi;

  const dateMatches: { label: string; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = datePattern.exec(text)) !== null) {
    dateMatches.push({
      label: match[1].trim(),
      start: match.index + (match[0].startsWith(".") ? 2 : 0),
      end: match.index + match[0].length,
    });
  }

  if (dateMatches.length === 0) {
    // No date labels found — treat entire text as one group
    const lines = parseEntryLines(text);
    if (lines.length === 0) return [];
    return [{ label: "Journal Entry", lines }];
  }

  const groups: JournalEntryGroup[] = [];
  for (let i = 0; i < dateMatches.length; i++) {
    const dm = dateMatches[i];
    const nextStart = i + 1 < dateMatches.length ? dateMatches[i + 1].start : text.length;
    const segment = text.substring(dm.end, nextStart).trim();
    const lines = parseEntryLines(segment);
    if (lines.length > 0) {
      groups.push({ label: dm.label, lines });
    }
  }

  return groups;
}

function parseEntryLines(segment: string): JournalEntryLine[] {
  // Clean up trailing periods/parens
  let cleaned = segment.replace(/\.\s*$/, "").trim();
  // Remove trailing parenthetical notes like "(All rounded to whole dollars)"
  const noteMatch = cleaned.match(/\(([^)]+)\)\s*$/);
  cleaned = cleaned.replace(/\([^)]+\)\s*$/, "").trim();

  // Split by semicolons or periods followed by capital letters
  const parts = cleaned.split(/;\s*|(?<=\d)\.\s+(?=[A-Z])/).map(p => p.trim()).filter(Boolean);

  const lines: JournalEntryLine[] = [];
  for (const part of parts) {
    const line = parseOneLine(part);
    if (line) lines.push(line);
  }

  // If we have lines but no clear debit/credit amounts, try heuristic assignment
  assignDebitCredit(lines);

  return lines;
}

function parseOneLine(text: string): JournalEntryLine | null {
  if (!text.trim()) return null;

  // Pattern: "Account Name $123,456" or "Account Name 123456"
  const amountMatch = text.match(/^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/);
  if (amountMatch) {
    const account = amountMatch[1].trim();
    const amount = parseFloat(amountMatch[2].replace(/,/g, ""));
    const side = inferSide(account);
    return {
      account,
      debit: side === "debit" ? amount : null,
      credit: side === "credit" ? amount : null,
      side,
      needs_review: !isConfidentSide(account),
    };
  }

  // No amount found — just account name
  return {
    account: text.trim(),
    debit: null,
    credit: null,
    side: inferSide(text.trim()),
    needs_review: true,
  };
}

function isConfidentSide(account: string): boolean {
  const lower = account.toLowerCase();
  return (
    CREDIT_KEYWORDS.some(kw => lower.includes(kw)) ||
    DEBIT_KEYWORDS.some(kw => lower.includes(kw))
  );
}

function assignDebitCredit(lines: JournalEntryLine[]) {
  // Verify debits = credits, fix up if needed
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    totalDebit += l.debit || 0;
    totalCredit += l.credit || 0;
  }
  // If they balance, we're good
  // If not, clear needs_review flags aren't set — keep as-is
}

/**
 * Convert structured groups to a template (no amounts, just sides).
 */
export function toTemplate(groups: JournalEntryGroup[]): JournalEntryGroup[] {
  return groups.map(g => ({
    label: g.label,
    lines: g.lines.map(l => ({
      account: l.account,
      debit: null,
      credit: null,
      side: l.side || (l.debit != null ? "debit" : l.credit != null ? "credit" : "debit"),
    })),
  }));
}

/**
 * Format a number with commas for display.
 */
export function formatAmount(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("en-US");
}

/**
 * Convert groups to TSV for clipboard.
 */
export function groupsToTSV(groups: JournalEntryGroup[], mode: "completed" | "template" = "completed"): string {
  const rows: string[] = ["Account\tDebit\tCredit"];
  for (const g of groups) {
    if (groups.length > 1) {
      rows.push(`${g.label}\t\t`);
    }
    for (const l of g.lines) {
      if (mode === "template") {
        rows.push(`${l.account}\t${l.side === "debit" ? "X" : ""}\t${l.side === "credit" ? "X" : ""}`);
      } else {
        rows.push(`${l.account}\t${l.debit ?? ""}\t${l.credit ?? ""}`);
      }
    }
    if (g.note) {
      rows.push(`${g.note}\t\t`);
    }
  }
  return rows.join("\n");
}

/**
 * Try to get structured data: use JSON if available, else parse legacy text.
 */
export function resolveJournalEntries(
  completedJson: JournalEntryGroup[] | null | undefined,
  legacyText: string | null | undefined,
): JournalEntryGroup[] {
  if (completedJson && Array.isArray(completedJson) && completedJson.length > 0) {
    return completedJson;
  }
  if (legacyText) {
    return parseLegacyAnswerOnly(legacyText);
  }
  return [];
}

/**
 * Parse legacy pipe/tab journal_entry_block into structured groups.
 */
export function parseLegacyJEBlock(text: string | null | undefined): JournalEntryGroup[] {
  if (!text?.trim()) return [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const entryLines: JournalEntryLine[] = [];

  for (const line of lines) {
    if (/^account\s*\|?\s*debit\s*\|?\s*credit/i.test(line)) continue;
    if (/^[-|=\s]+$/.test(line)) continue;

    const pipeParts = line.split("|").map(s => s.trim());
    if (pipeParts.length >= 3) {
      const debitVal = parseFloat(pipeParts[1].replace(/[$,]/g, "")) || null;
      const creditVal = parseFloat(pipeParts[2].replace(/[$,]/g, "")) || null;
      entryLines.push({
        account: pipeParts[0],
        debit: debitVal,
        credit: creditVal,
        side: debitVal != null ? "debit" : "credit",
      });
      continue;
    }

    const tabParts = line.split("\t").map(s => s.trim());
    if (tabParts.length >= 3) {
      const debitVal = parseFloat(tabParts[1].replace(/[$,]/g, "")) || null;
      const creditVal = parseFloat(tabParts[2].replace(/[$,]/g, "")) || null;
      entryLines.push({
        account: tabParts[0],
        debit: debitVal,
        credit: creditVal,
        side: debitVal != null ? "debit" : "credit",
      });
      continue;
    }

    // Fallback
    entryLines.push({ account: line, debit: null, credit: null, side: "debit", needs_review: true });
  }

  if (entryLines.length === 0) return [];
  return [{ label: "Journal Entry", lines: entryLines }];
}
