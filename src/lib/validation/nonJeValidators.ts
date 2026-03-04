/**
 * NON_JE Validators — for problems that don't require journal entries.
 * Validates answer_parts structure, parts_json, and basic content presence.
 */

import type { Validator, ValidationResult } from "./validationEngine";

export const answerPartsPresent: Validator = (pkg) => {
  // Check both legacy answer_parts and new parts_json
  const parts = pkg.answer_payload?.answer_parts ?? pkg.answer_payload?.parts_json;
  if (!Array.isArray(parts) || parts.length === 0) {
    return { validator: "answer_parts_present", status: "fail", message: "answer_parts missing or empty" };
  }
  return { validator: "answer_parts_present", status: "pass", message: `${parts.length} answer part(s) present` };
};

export const answerPartsStructure: Validator = (pkg) => {
  const parts = pkg.answer_payload?.answer_parts ?? pkg.answer_payload?.parts_json;
  if (!Array.isArray(parts) || parts.length === 0) {
    return { validator: "answer_parts_structure", status: "skip", message: "No answer_parts to validate" };
  }
  const errors: string[] = [];
  parts.forEach((p: any, i: number) => {
    if (typeof p.label !== "string" || !p.label.trim()) errors.push(`Part ${i}: missing label`);
    if (p.type === "je") {
      // JE parts need je_structured
      if (!Array.isArray(p.je_structured) || p.je_structured.length === 0) {
        errors.push(`Part ${i} (${p.label}): je_structured missing or empty`);
      }
    } else {
      // Text parts need final_answer
      if (typeof p.final_answer !== "string" || !p.final_answer.trim()) errors.push(`Part ${i}: missing final_answer`);
      // explanation and steps are optional for new schema but checked for legacy
      if (p.steps !== undefined && typeof p.steps !== "string") errors.push(`Part ${i}: invalid steps`);
    }
  });
  if (errors.length > 0) {
    return { validator: "answer_parts_structure", status: "fail", message: errors.join("; "), details: { errors } };
  }
  return { validator: "answer_parts_structure", status: "pass", message: "All answer parts valid" };
};

export const NON_JE_VALIDATORS: Validator[] = [
  answerPartsPresent,
  answerPartsStructure,
];
