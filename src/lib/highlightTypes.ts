/**
 * Highlight types for variant problem text.
 * Highlights mark key inputs students must notice to solve a problem.
 */

export type HighlightType = "key_input" | "rate" | "amount" | "timing" | "rule" | "definition";

export interface Highlight {
  text: string;
  type: HighlightType;
}

export const HIGHLIGHT_TYPE_LABELS: Record<HighlightType, string> = {
  key_input: "Key Input",
  rate: "Rate",
  amount: "Amount",
  timing: "Timing",
  rule: "Rule",
  definition: "Definition",
};

export const HIGHLIGHT_TYPE_COLORS: Record<HighlightType, string> = {
  key_input: "bg-yellow-200/80 dark:bg-yellow-400/30",
  rate: "bg-amber-200/80 dark:bg-amber-400/30",
  amount: "bg-lime-200/80 dark:bg-lime-400/30",
  timing: "bg-sky-200/80 dark:bg-sky-400/30",
  rule: "bg-violet-200/80 dark:bg-violet-400/30",
  definition: "bg-pink-200/80 dark:bg-pink-400/30",
};

export const HIGHLIGHT_GENERATION_PROMPT = `You are an expert accounting instructor. Given a problem text and its solution steps, identify the most important information a student must notice first to solve the problem.

Rules:
- Return 6-10 highlights maximum, minimum 2
- Each highlight must be an EXACT substring of the problem text (case-sensitive match)
- Focus on inputs used in solution steps
- Do NOT highlight narrative text, company descriptions, or filler
- Highlight types: key_input, rate, amount, timing, rule, definition

Highlight these categories:
- Numbers used in calculations (type: amount)
- Interest rates or percentages (type: rate)
- Timing information like dates or periods (type: timing)
- Accounting rules mentioned in the problem (type: rule)
- Key definitions or qualifiers (type: definition)
- Other critical inputs (type: key_input)

Return JSON array only.`;

export function validateHighlights(highlights: Highlight[], problemText: string): Highlight[] {
  if (!Array.isArray(highlights)) return [];
  return highlights
    .filter(h => h && typeof h.text === "string" && h.text.length > 0)
    .filter(h => problemText.includes(h.text))
    .filter(h => ["key_input", "rate", "amount", "timing", "rule", "definition"].includes(h.type))
    .slice(0, 10);
}
