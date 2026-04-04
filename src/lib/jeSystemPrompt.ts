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
              "credit": number | null,
              "debit_credit_reason": "Brief explanation of why this account is debited or credited in this context. Written for an accounting student. Example: 'Income Tax Expense is debited because it is an expense account — expenses increase with a debit and decrease with a credit.'",
              "amount_source": "Brief explanation of where this specific dollar amount comes from, referencing the calculation in the solution text when possible. Example: 'Current Tax ($136,000) + Deferred Tax ($45,000) = $181,000, as calculated in the solution above.' If the amount is given directly, say so: 'Given directly in the problem — $50,000 annual rent payment.'"
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
   - debit_credit_reason: 1-2 sentence explanation of why this account is debited or credited, written as a tutor explaining to a student
   - amount_source: 1-2 sentence explanation of where the dollar amount comes from, referencing the solution calculation when possible
3. Never place dates, explanations, "Situation", slashes, or dollar signs inside account fields.
4. Accounts must match the approved chart_of_accounts list when possible.
5. If an account is not found in the list, mark: "needs_review": true
6. Each entry_by_date block must balance (total debits = total credits).
7. Also include final_answers with specific numeric/text answers the problem asks for.
8. debit_credit_reason and amount_source must be included on EVERY row — never omit them.

ENTITY NAMING:
The primary entity — the one whose transactions are being described and whose books the student will primarily work from — is always named "Survive Company A ([role])" where [role] is one of ONLY these 7 allowed roles: seller, buyer, manufacturer, borrower, lender, lessee, lessor. Do NOT use any other role labels.
If a second entity is involved, name them "Survive Company B ([role])" using the corresponding counterpart role (e.g. borrower/lender, lessee/lessor, seller/buyer).
Never use "Survive Company" without the A or B suffix and role hint.
Never use "Counterparty", "the other party", or X/Y naming.
Include the parenthetical role hint ONLY on the very first mention of each entity in the problem text. All subsequent mentions use only the name without the parenthetical (e.g. first: "Survive Company A (the issuer)", later: "Survive Company A").

PERSPECTIVE CLARITY:
Every instruction that asks the student to prepare a journal entry must explicitly name the entity inline.
CORRECT: "Prepare the journal entry on the books of Survive Company A (the issuer) to record the issuance of the bonds on January 1."
WRONG: "Prepare the journal entry to record the issuance..." (missing whose books).
Each instruction line must be self-contained and unambiguous — never rely on a generic header for perspective.

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

  parts.push("REMINDER: Name the primary entity 'Survive Company A ([role])' and secondary entity 'Survive Company B ([role])'. Include the parenthetical role hint only on the FIRST mention of each entity; omit it on all subsequent mentions. Every instruction line must specify whose books inline using 'on the books of Survive Company A/B'. Never leave perspective ambiguous.");

  return parts.join("\n\n");
}
