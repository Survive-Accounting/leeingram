/**
 * Shared system prompt for structured Journal Entry generation.
 * Used by AnswerPackagePanel, AIComparisonPanel, and RegenerateDialog.
 */

export const JE_SYSTEM_PROMPT = `Journal Entry Generator (Structured Mode)

You must return ONLY structured JSON.

Do NOT write narrative journal entries.
Do NOT combine accounts.
Do NOT include words like "Debit", "Credit", "Situation", or dates inside account fields.

Your response must match this schema exactly:

{
  "final_answers": [{"label": string, "value": string}],
  "scenario_sections": [
    {
      "scenario_label": "Situation 1",
      "entries_by_date": [
        {
          "date": "YYYY-MM-DD",
          "rows": [
            {
              "account": "Account Name",
              "debit": number | null,
              "credit": number | null
            }
          ]
        }
      ]
    }
  ]
}

Rules:
1. Each journal entry date must have its own entry block.
2. Each row must contain ONLY:
   - account name (clean text, no prefixes, no dollar signs, no colons)
   - debit OR credit amount (never both, never both null for amount rows)
3. Never place dates, explanations, "Situation", slashes, or dollar signs inside account fields.
4. Accounts must match the approved chart_of_accounts list when possible.
5. If an account is not found in the list, mark: "needs_review": true
6. Each entry_by_date block must balance (total debits = total credits).
7. Also include final_answers with specific numeric/text answers the problem asks for.
8. When two parties exist, use "Survive Company A ([role])" and "Survive Company B ([role])" naming. Never use "Counterparty" or vague terms like "the other company".
9. Always explicitly state which entity's books the journal entry is recorded on.

Return only JSON.`;

/**
 * Build the full user prompt for JE generation.
 */
export function buildJEUserPrompt(opts: {
  problemText: string;
  solutionText: string;
  scenarioPromptBlock?: string;
  repairNotes?: string;
  chartOfAccounts?: string[];
}): string {
  const parts: string[] = [];

  parts.push(`Problem:\n${opts.problemText || "No problem text"}`);
  parts.push(`Solution Reference:\n${opts.solutionText || "No solution text"}`);

  if (opts.scenarioPromptBlock) {
    parts.push(opts.scenarioPromptBlock);
  }

  if (opts.repairNotes) {
    parts.push(`Previous repair notes to address:\n${opts.repairNotes}`);
  }

  if (opts.chartOfAccounts && opts.chartOfAccounts.length > 0) {
    parts.push(`Approved Chart of Accounts:\n${opts.chartOfAccounts.join(", ")}`);
  }

  return parts.join("\n\n");
}
