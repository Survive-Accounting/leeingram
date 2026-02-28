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
  unbalanced?: boolean;
}

/* ------------------------------------------------------------------ */
/*  INFERENCE RULES                                                    */
/* ------------------------------------------------------------------ */

interface InferResult {
  side: "debit" | "credit";
  confident: boolean;
}

/**
 * Infer debit/credit side from account name.
 * Returns side + confidence flag.
 */
function inferSide(account: string): InferResult {
  const lower = account.toLowerCase().trim();

  // --- SPECIAL CASE: "Discount on N/P" or "Discount on Notes Payable" → DEBIT (contra-liability) ---
  if (/discount\s+on\s+(n\/p|notes?\s+payable)/i.test(account)) {
    return { side: "debit", confident: true };
  }

  // --- SPECIAL CASE: "N/P" or "Notes Payable" alone → CREDIT ---
  if (/^n\/p$/i.test(lower) || lower.includes("notes payable")) {
    return { side: "credit", confident: true };
  }

  // --- Interest + asset label → treat as interest expense (DEBIT) ---
  if (lower.includes("interest") && /land|equip|build/i.test(lower)) {
    return { side: "debit", confident: true };
  }

  // High-confidence CREDIT keywords
  const CREDIT_CONFIDENT: string[] = [
    "a/p", "accounts payable", "payable", "revenue", "unearned",
    "common stock", "preferred stock", "retained earnings",
    "bonds payable", "interest payable", "capital",
    "contributed", "accumulated", "premium",
  ];
  for (const kw of CREDIT_CONFIDENT) {
    if (lower.includes(kw)) return { side: "credit", confident: true };
  }

  // High-confidence DEBIT keywords
  const DEBIT_CONFIDENT: string[] = [
    "cash", "land", "equipment", "building", "supplies", "prepaid",
    "receivable", "inventory", "expense", "interest expense",
    "wages", "wage", "salary", "salaries", "dividends",
    "cost of goods", "rent expense", "insurance expense",
    "depreciation", "amortization", "loss",
    "discount",              // generic discount = contra, debit
  ];
  for (const kw of DEBIT_CONFIDENT) {
    if (lower.includes(kw)) return { side: "debit", confident: true };
  }

  // Weaker heuristics
  if (/liability|gain|service/i.test(lower)) return { side: "credit", confident: false };
  if (/asset/i.test(lower)) return { side: "debit", confident: false };

  return { side: "debit", confident: false }; // fallback
}

/* ------------------------------------------------------------------ */
/*  LEGACY ANSWER-ONLY PARSER                                          */
/* ------------------------------------------------------------------ */

export function parseLegacyAnswerOnly(text: string): JournalEntryGroup[] {
  if (!text?.trim()) return [];

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
    const lines = parseEntryLines(text);
    if (lines.length === 0) return [];
    const group: JournalEntryGroup = { label: "Journal Entry", lines };
    balanceGroup(group);
    return [group];
  }

  const groups: JournalEntryGroup[] = [];
  for (let i = 0; i < dateMatches.length; i++) {
    const dm = dateMatches[i];
    const nextStart = i + 1 < dateMatches.length ? dateMatches[i + 1].start : text.length;
    const segment = text.substring(dm.end, nextStart).trim();
    const lines = parseEntryLines(segment);
    if (lines.length > 0) {
      const group: JournalEntryGroup = { label: dm.label, lines };
      balanceGroup(group);
      groups.push(group);
    }
  }

  return groups;
}

function parseEntryLines(segment: string): JournalEntryLine[] {
  let cleaned = segment.replace(/\.\s*$/, "").trim();
  cleaned = cleaned.replace(/\([^)]+\)\s*$/, "").trim();

  // Strip company name prefixes like "Shadow Balance Co.:" or "Island Transfer Inc.:"
  cleaned = cleaned.replace(/^[A-Z][A-Za-z\s&.,]+(?:Co\.|Corp\.|Inc\.|LLC|Ltd\.?)\s*:\s*/gm, "");

  // Split on lettered sub-entries like "a. Cash $250,000 b. Interest Expense $5,000"
  // First try splitting on letter prefixes: a. b. c. etc.
  const letterSplit = cleaned.split(/\b([a-z])\.\s+/i);
  let rawParts: string[];
  if (letterSplit.length > 2) {
    // Reassemble: letterSplit = ["", "a", "Cash $250,000 ", "b", "Interest Expense $5,000"]
    rawParts = [];
    for (let i = 1; i < letterSplit.length; i += 2) {
      const text = (letterSplit[i + 1] || "").trim();
      if (text) rawParts.push(text);
    }
  } else {
    rawParts = cleaned.split(/;\s*|(?<=\d)\.\s+(?=[A-Z])/).map(p => p.trim()).filter(Boolean);
  }

  const lines: JournalEntryLine[] = [];
  for (const part of rawParts) {
    const line = parseOneLine(part);
    if (line) lines.push(line);
  }

  return lines;
}

function parseOneLine(text: string): JournalEntryLine | null {
  if (!text.trim()) return null;

  // Pattern: "Account Name $123,456" or "Account Name 123456"
  const amountMatch = text.match(/^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/);
  if (amountMatch) {
    const account = amountMatch[1].trim();
    const amount = parseFloat(amountMatch[2].replace(/,/g, ""));
    const { side, confident } = inferSide(account);
    return {
      account,
      debit: side === "debit" ? amount : null,
      credit: side === "credit" ? amount : null,
      side,
      needs_review: !confident,
    };
  }

  // No amount found
  const { side, confident } = inferSide(text.trim());
  return {
    account: text.trim(),
    debit: null,
    credit: null,
    side,
    needs_review: !confident,
  };
}

/* ------------------------------------------------------------------ */
/*  BALANCING LOGIC                                                    */
/* ------------------------------------------------------------------ */

function balanceGroup(group: JournalEntryGroup) {
  const lines = group.lines;

  // Normalize: ensure amount is in the correct column based on side
  for (const l of lines) {
    if (l.side === "debit" && l.credit != null && l.debit == null) {
      l.debit = l.credit;
      l.credit = null;
    } else if (l.side === "credit" && l.debit != null && l.credit == null) {
      l.credit = l.debit;
      l.debit = null;
    }
  }

  let totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  let totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) < 0.01) {
    // Balanced — clear needs_review on all lines
    for (const l of lines) l.needs_review = false;
    return;
  }

  // Try flipping uncertain lines to balance
  const uncertain = lines.filter(l => l.needs_review && (l.debit != null || l.credit != null));
  for (const u of uncertain) {
    const amount = u.debit ?? u.credit ?? 0;
    if (amount === 0) continue;

    const newSide: "debit" | "credit" = u.side === "debit" ? "credit" : "debit";
    // Check if flipping helps
    const debitDelta = u.side === "debit" ? -amount : amount;
    const creditDelta = u.side === "credit" ? -amount : amount;
    const newTotalDebit = totalDebit + debitDelta;
    const newTotalCredit = totalCredit + creditDelta;

    if (Math.abs(newTotalDebit - newTotalCredit) < Math.abs(totalDebit - totalCredit)) {
      // Flip
      u.side = newSide;
      u.debit = newSide === "debit" ? amount : null;
      u.credit = newSide === "credit" ? amount : null;
      u.needs_review = false;
      totalDebit = newTotalDebit;
      totalCredit = newTotalCredit;

      if (Math.abs(totalDebit - totalCredit) < 0.01) break;
    }
  }

  // Final check
  if (Math.abs(totalDebit - totalCredit) < 0.01) {
    for (const l of lines) l.needs_review = false;
  } else {
    group.unbalanced = true;
    // Only keep needs_review on actually uncertain lines
    for (const l of lines) {
      const { confident } = inferSide(l.account);
      if (confident) l.needs_review = false;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  TEMPLATE CONVERSION                                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  FORMATTING HELPERS                                                 */
/* ------------------------------------------------------------------ */

export function formatAmount(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

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

/* ------------------------------------------------------------------ */
/*  RESOLVE: JSON preferred, legacy fallback                           */
/* ------------------------------------------------------------------ */

export function resolveJournalEntries(
  completedJson: JournalEntryGroup[] | null | undefined,
  legacyText: string | null | undefined,
): JournalEntryGroup[] {
  if (completedJson && Array.isArray(completedJson) && completedJson.length > 0) {
    // Re-run balancing on stored JSON to ensure correctness
    const groups = completedJson.map(g => ({ ...g, lines: g.lines.map(l => ({ ...l })) }));
    groups.forEach(balanceGroup);
    return groups;
  }
  if (legacyText) {
    return parseLegacyAnswerOnly(legacyText);
  }
  return [];
}

/* ------------------------------------------------------------------ */
/*  LEGACY PIPE/TAB BLOCK PARSER                                       */
/* ------------------------------------------------------------------ */

export function parseLegacyJEBlock(text: string | null | undefined): JournalEntryGroup[] {
  if (!text?.trim()) return [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const entryLines: JournalEntryLine[] = [];

  for (const line of lines) {
    if (/^account\s*\|?\s*debit\s*\|?\s*credit/i.test(line)) continue;
    if (/^[-|=\s]+$/.test(line)) continue;

    // Strip company name prefixes
    let cleanLine = line.replace(/^[A-Z][A-Za-z\s&.,]+(?:Co\.|Corp\.|Inc\.|LLC|Ltd\.?)\s*:\s*/i, "");

    const pipeParts = cleanLine.split("|").map(s => s.trim());
    if (pipeParts.length >= 3) {
      let accountName = pipeParts[0];
      // Strip leading letter prefix like "a. " or "b. "
      accountName = accountName.replace(/^[a-z]\.\s+/i, "");
      const debitVal = parseFloat(pipeParts[1].replace(/[$,]/g, "")) || null;
      const creditVal = parseFloat(pipeParts[2].replace(/[$,]/g, "")) || null;
      const { side, confident } = inferSide(accountName);
      entryLines.push({
        account: accountName,
        debit: debitVal,
        credit: creditVal,
        side: debitVal != null ? "debit" : creditVal != null ? "credit" : side,
        needs_review: !confident && debitVal == null && creditVal == null,
      });
      continue;
    }

    const tabParts = cleanLine.split("\t").map(s => s.trim());
    if (tabParts.length >= 3) {
      let accountName = tabParts[0].replace(/^[a-z]\.\s+/i, "");
      const debitVal = parseFloat(tabParts[1].replace(/[$,]/g, "")) || null;
      const creditVal = parseFloat(tabParts[2].replace(/[$,]/g, "")) || null;
      entryLines.push({
        account: accountName,
        debit: debitVal,
        credit: creditVal,
        side: debitVal != null ? "debit" : "credit",
      });
      continue;
    }

    // Plain text line — try to extract account + amount
    let plainLine = cleanLine.replace(/^[a-z]\.\s+/i, "");
    const { side, confident } = inferSide(plainLine);
    const amountMatch = plainLine.match(/^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/);
    if (amountMatch) {
      const account = amountMatch[1].trim();
      const amount = parseFloat(amountMatch[2].replace(/,/g, ""));
      const inf = inferSide(account);
      entryLines.push({
        account,
        debit: inf.side === "debit" ? amount : null,
        credit: inf.side === "credit" ? amount : null,
        side: inf.side,
        needs_review: !inf.confident,
      });
    } else {
      entryLines.push({ account: plainLine, debit: null, credit: null, side, needs_review: !confident });
    }
  }

  if (entryLines.length === 0) return [];
  const group: JournalEntryGroup = { label: "Journal Entry", lines: entryLines };
  balanceGroup(group);
  return [group];
}
