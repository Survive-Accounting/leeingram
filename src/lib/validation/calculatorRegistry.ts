/**
 * Calculator Plugin Registry
 * 
 * Calculators take extracted_inputs and produce computed_values.
 * Validators can then compare computed_values against answer_payload.
 */

import type { Validator, ValidationResult, AnswerPackageData } from "./validationEngine";

export interface CalculatorResult {
  computed_values: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Calculator {
  id: string;
  name: string;
  /** Topics/keywords this calculator applies to */
  appliesTo: string[];
  /** Run the calculation from extracted inputs */
  compute: (inputs: Record<string, any>) => CalculatorResult;
  /** Optional validator that checks answer_payload against computed_values */
  validator?: Validator;
}

// --- Registry ---

const registry: Calculator[] = [];

export function registerCalculator(calc: Calculator): void {
  const existing = registry.findIndex((c) => c.id === calc.id);
  if (existing >= 0) registry[existing] = calc;
  else registry.push(calc);
}

export function getCalculator(id: string): Calculator | undefined {
  return registry.find((c) => c.id === id);
}

export function findCalculatorsForTopic(topicKeywords: string[]): Calculator[] {
  const lower = topicKeywords.map((k) => k.toLowerCase());
  return registry.filter((c) => c.appliesTo.some((a) => lower.some((k) => k.includes(a.toLowerCase()))));
}

export function getAllCalculators(): Calculator[] {
  return [...registry];
}

// --- Utility: run matching calculators & collect validators ---

export function runCalculatorsForPkg(
  pkg: AnswerPackageData,
  topicKeywords: string[]
): { computedValues: Record<string, any>; extraValidators: Validator[] } {
  const calcs = findCalculatorsForTopic(topicKeywords);
  let computedValues: Record<string, any> = {};
  const extraValidators: Validator[] = [];

  for (const calc of calcs) {
    try {
      const result = calc.compute(pkg.extracted_inputs);
      computedValues = { ...computedValues, ...result.computed_values, [`_${calc.id}_meta`]: result.metadata };
      if (calc.validator) extraValidators.push(calc.validator);
    } catch (e) {
      console.warn(`Calculator ${calc.id} failed:`, e);
    }
  }

  return { computedValues, extraValidators };
}
