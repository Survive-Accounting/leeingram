/**
 * Prompts for skeleton-first JE workflow.
 * 
 * Phase 1: Generate skeleton (scenario labels + entry dates only)
 * Phase 2: Generate rows for a single date
 */

export const SKELETON_SYSTEM_PROMPT = `You are a journal entry date extractor.

Given an accounting problem, identify ALL scenario sections and ALL journal entry dates needed.

Return ONLY this JSON structure:
{
  "scenario_sections": [
    {
      "scenario_label": "Situation 1",
      "entry_dates": ["2025-01-01", "2025-07-01", "2025-12-31"]
    }
  ]
}

Rules:
1. If there is only one scenario/situation, use "Journal Entry" as the label.
2. List every date that requires a journal entry in YYYY-MM-DD format.
3. Include dates for initial transactions, adjusting entries, interest payments, amortization, etc.
4. Do NOT generate any journal entry rows — only dates.
5. When two parties exist, use "Survive Company A ([role])" and "Survive Company B ([role])" naming.
6. Return only JSON.`;

export function buildSkeletonUserPrompt(opts: {
  problemText: string;
  solutionText?: string;
}): string {
  const parts: string[] = [];
  parts.push(`Problem:\n${opts.problemText}`);
  if (opts.solutionText) {
    parts.push(`Solution Reference:\n${opts.solutionText}`);
  }
  parts.push("Extract all scenario labels and journal entry dates. Return only the skeleton JSON.");
  return parts.join("\n\n");
}

export const SINGLE_DATE_SYSTEM_PROMPT = `You are a journal entry generator.

You will be given a specific scenario and date. Generate ONLY the journal entry rows for that single date.

Return ONLY this JSON:
{
  "rows": [
    {"account": "Account Name", "debit": number|null, "credit": number|null}
  ]
}

Rules:
1. Each row has ONLY account name + debit OR credit (never both, never both null).
2. Do NOT include dates, dollar signs, "Debit"/"Credit" words, narrative prefixes, or colons in account names.
3. Total debits must equal total credits.
4. Use accounts from the approved list when provided.
5. If an account is not in the approved list, add "needs_review": true to that row.
6. When two parties exist, use "Survive Company A ([role])" and "Survive Company B ([role])" naming. Always state which entity's books the entry is recorded on.
7. Return only JSON.`;

export function buildSingleDateUserPrompt(opts: {
  problemText: string;
  solutionText?: string;
  scenarioLabel: string;
  targetDate: string;
  chartOfAccounts?: string[];
  priorEntries?: Array<{ date: string; rows: any[] }>;
}): string {
  const parts: string[] = [];
  parts.push(`Problem:\n${opts.problemText}`);
  if (opts.solutionText) parts.push(`Solution Reference:\n${opts.solutionText}`);
  parts.push(`Scenario: ${opts.scenarioLabel}`);
  parts.push(`Target Date: ${opts.targetDate}`);
  parts.push(`Generate the journal entry rows for ONLY this date (${opts.targetDate}) in this scenario.`);
  
  if (opts.chartOfAccounts && opts.chartOfAccounts.length > 0) {
    parts.push(`Approved Chart of Accounts:\n${opts.chartOfAccounts.join(", ")}`);
  }

  if (opts.priorEntries && opts.priorEntries.length > 0) {
    parts.push(`Previously generated entries for context (do NOT regenerate these):\n${JSON.stringify(opts.priorEntries, null, 2)}`);
  }

  return parts.join("\n\n");
}
