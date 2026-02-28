/**
 * Universal Validation Engine
 * Runs a pipeline of validators against an answer package and returns results.
 */

export interface ValidationResult {
  validator: string;
  status: "pass" | "fail" | "warn";
  message: string;
  details?: Record<string, any>;
}

export interface AnswerPackageData {
  answer_payload: Record<string, any>;
  extracted_inputs: Record<string, any>;
  computed_values: Record<string, any>;
  /** Derived flag: true if problem text requires journal entries */
  requires_je?: boolean;
}

export type Validator = (pkg: AnswerPackageData) => ValidationResult;

// --- Base Validators ---

export const requiredFieldsPresent: Validator = (pkg) => {
  const hasQuestion = Object.keys(pkg.answer_payload).length > 0;
  return {
    validator: "required_fields_present",
    status: hasQuestion ? "pass" : "fail",
    message: hasQuestion ? "Answer payload exists" : "Answer payload is empty",
  };
};

export const mcCorrectAnswerInRange: Validator = (pkg) => {
  const { answer_type, correct_answer_index, answers } = pkg.answer_payload;
  if (answer_type !== "mc") return { validator: "mc_correct_answer_in_range", status: "pass", message: "Not MC type, skipped" };
  const arr = answers as any[] | undefined;
  if (!arr || !Array.isArray(arr)) return { validator: "mc_correct_answer_in_range", status: "fail", message: "No answers array" };
  const idx = correct_answer_index as number | undefined;
  if (idx === undefined || idx < 0 || idx >= arr.length) {
    return { validator: "mc_correct_answer_in_range", status: "fail", message: `Correct answer index ${idx} out of range (0-${arr.length - 1})` };
  }
  return { validator: "mc_correct_answer_in_range", status: "pass", message: "Correct answer index valid" };
};

export const answersCountValid: Validator = (pkg) => {
  const { answer_type, answers, correct_answer_index } = pkg.answer_payload;
  if (answer_type !== "mc") return { validator: "answers_count_valid", status: "pass", message: "Not MC type, skipped" };
  const arr = answers as any[] | undefined;
  if (!arr || arr.length < 2) return { validator: "answers_count_valid", status: "fail", message: `Only ${arr?.length ?? 0} answers, need at least 2` };
  if (correct_answer_index === undefined) return { validator: "answers_count_valid", status: "fail", message: "No correct_answer_index" };
  return { validator: "answers_count_valid", status: "pass", message: `${arr.length} answers present` };
};

export const journalEntryBalances: Validator = (pkg) => {
  const rows = pkg.answer_payload.je_rows as Array<{ debit?: number; credit?: number }> | undefined;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { validator: "journal_entry_balances", status: "pass", message: "No JE rows, skipped" };
  }
  const totalDebits = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const totalCredits = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const diff = Math.abs(totalDebits - totalCredits);
  if (diff > 0.02) {
    return { validator: "journal_entry_balances", status: "fail", message: `Debits (${totalDebits.toFixed(2)}) ≠ Credits (${totalCredits.toFixed(2)})`, details: { totalDebits, totalCredits, diff } };
  }
  return { validator: "journal_entry_balances", status: "pass", message: `Balanced: ${totalDebits.toFixed(2)}` };
};

export const noEmptyRequiredLines: Validator = (pkg) => {
  const rows = pkg.answer_payload.je_rows as Array<{ account?: string; debit?: number; credit?: number }> | undefined;
  if (!rows || rows.length === 0) return { validator: "no_empty_required_lines", status: "pass", message: "No JE rows, skipped" };
  const emptyRows = rows.filter((r, i) => !r.account && (r.debit === undefined || r.debit === null) && (r.credit === undefined || r.credit === null));
  if (emptyRows.length > 0) {
    return { validator: "no_empty_required_lines", status: "fail", message: `${emptyRows.length} empty row(s) found` };
  }
  return { validator: "no_empty_required_lines", status: "pass", message: "All rows have data" };
};

export const formattingSanity: Validator = (pkg) => {
  const payload = JSON.stringify(pkg.answer_payload);
  if (payload.includes("undefined") || payload.includes("NaN")) {
    return { validator: "formatting_sanity", status: "fail", message: "Answer contains undefined/NaN values" };
  }
  return { validator: "formatting_sanity", status: "pass", message: "No formatting issues" };
};

// --- Base validator set ---
export const BASE_VALIDATORS: Validator[] = [
  requiredFieldsPresent,
  mcCorrectAnswerInRange,
  answersCountValid,
  journalEntryBalances,
  noEmptyRequiredLines,
  formattingSanity,
];

// Import and re-export JE validators so they're always included
import { JE_VALIDATORS } from "./jeValidators";

export const ALL_VALIDATORS: Validator[] = [...BASE_VALIDATORS, ...JE_VALIDATORS];

// --- Validation Pipeline ---

export function runValidation(pkg: AnswerPackageData, extraValidators: Validator[] = []): ValidationResult[] {
  const all = [...ALL_VALIDATORS, ...extraValidators];
  return all.map((v) => v(pkg));
}

export function hasFailures(results: ValidationResult[]): boolean {
  return results.some((r) => r.status === "fail");
}
