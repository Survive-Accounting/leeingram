/**
 * Zod schema for structured JE payload.
 * Used to validate AI output before persisting.
 */
import { z } from "zod";

export const StructuredJERowSchema = z.object({
  account: z.string().min(1, "Account name is required"),
  debit: z.number().nullable(),
  credit: z.number().nullable(),
  needs_review: z.boolean().optional(),
});

export const EntryByDateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  rows: z.array(StructuredJERowSchema).min(1, "At least one row required"),
});

export const ScenarioSectionSchema = z.object({
  scenario_label: z.string().min(1, "Scenario label is required"),
  entries_by_date: z.array(EntryByDateSchema).min(1, "At least one entry_by_date required"),
});

export const StructuredJEPayloadSchema = z.object({
  scenario_sections: z.array(ScenarioSectionSchema).min(1, "At least one scenario_section required"),
});

/** Also accept canonical format (label/entry_date/account_name) */
export const CanonicalJERowSchema = z.object({
  account_name: z.string().min(1),
  debit: z.number().nullable(),
  credit: z.number().nullable(),
});

export const CanonicalEntrySchema = z.object({
  entry_date: z.string(),
  rows: z.array(CanonicalJERowSchema).min(1),
});

export const CanonicalScenarioSchema = z.object({
  label: z.string().min(1),
  entries_by_date: z.array(CanonicalEntrySchema).min(1),
});

export const CanonicalJEPayloadSchema = z.object({
  scenario_sections: z.array(CanonicalScenarioSchema).min(1),
});

export type StructuredJEPayload = z.infer<typeof StructuredJEPayloadSchema>;

/**
 * Validate parsed AI output against structured JE schema.
 * Accepts both AI format (scenario_label/date/account) and canonical (label/entry_date/account_name).
 */
export function validateStructuredJESchema(parsed: any): {
  valid: boolean;
  errors: string[];
} {
  // Try AI format first
  const aiResult = StructuredJEPayloadSchema.safeParse(parsed);
  if (aiResult.success) return { valid: true, errors: [] };

  // Try canonical format
  const canonResult = CanonicalJEPayloadSchema.safeParse(parsed);
  if (canonResult.success) return { valid: true, errors: [] };

  // Also accept teaching_aids wrapper
  if (parsed?.teaching_aids?.scenario_sections) {
    const wrappedAi = StructuredJEPayloadSchema.safeParse({ scenario_sections: parsed.teaching_aids.scenario_sections });
    if (wrappedAi.success) return { valid: true, errors: [] };
    const wrappedCanon = CanonicalJEPayloadSchema.safeParse({ scenario_sections: parsed.teaching_aids.scenario_sections });
    if (wrappedCanon.success) return { valid: true, errors: [] };
  }

  // Collect errors from the AI format attempt (more informative)
  const errors = aiResult.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { valid: false, errors };
}
