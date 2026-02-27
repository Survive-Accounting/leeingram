/**
 * Note Valuation Calculator (PV + Effective Interest)
 * First plugin calculator — handles present value of notes payable/receivable.
 */

import { registerCalculator, type CalculatorResult } from "../calculatorRegistry";
import type { Validator, AnswerPackageData, ValidationResult } from "../validationEngine";

interface NoteInputs {
  face_value: number;
  stated_rate: number;       // annual, as decimal (e.g. 0.10)
  market_rate: number;       // annual, as decimal
  periods: number;           // total payment periods
  payments_per_year?: number; // default 1 (annual)
  payment_amount?: number;   // if explicitly provided
}

function computePV(fv: number, rate: number, n: number): number {
  if (rate === 0) return fv;
  return fv / Math.pow(1 + rate, n);
}

function computePVAnnuity(pmt: number, rate: number, n: number): number {
  if (rate === 0) return pmt * n;
  return pmt * ((1 - Math.pow(1 + rate, -n)) / rate);
}

export function computeNoteValuation(inputs: Record<string, any>): CalculatorResult {
  const fv = Number(inputs.face_value) || 0;
  const statedRate = Number(inputs.stated_rate) || 0;
  const marketRate = Number(inputs.market_rate) || 0;
  const periods = Number(inputs.periods) || 1;
  const ppYear = Number(inputs.payments_per_year) || 1;

  const periodicStated = statedRate / ppYear;
  const periodicMarket = marketRate / ppYear;
  const cashInterest = fv * periodicStated;
  const pvFace = computePV(fv, periodicMarket, periods);
  const pvInterest = computePVAnnuity(cashInterest, periodicMarket, periods);
  const issuancePrice = pvFace + pvInterest;
  const premiumDiscount = issuancePrice - fv;

  // Build amortization schedule
  const schedule: Array<{
    period: number;
    beginning_balance: number;
    cash_interest: number;
    interest_expense: number;
    amortization: number;
    ending_balance: number;
  }> = [];

  let balance = issuancePrice;
  for (let i = 1; i <= periods; i++) {
    const interestExpense = balance * periodicMarket;
    const amortization = interestExpense - cashInterest;
    const endingBalance = balance + amortization;
    schedule.push({
      period: i,
      beginning_balance: Math.round(balance * 100) / 100,
      cash_interest: Math.round(cashInterest * 100) / 100,
      interest_expense: Math.round(interestExpense * 100) / 100,
      amortization: Math.round(amortization * 100) / 100,
      ending_balance: Math.round(endingBalance * 100) / 100,
    });
    balance = endingBalance;
  }

  return {
    computed_values: {
      pv_face: Math.round(pvFace * 100) / 100,
      pv_interest: Math.round(pvInterest * 100) / 100,
      issuance_price: Math.round(issuancePrice * 100) / 100,
      premium_discount: Math.round(premiumDiscount * 100) / 100,
      cash_interest_per_period: Math.round(cashInterest * 100) / 100,
      amortization_schedule: schedule,
    },
    metadata: {
      calculator: "note_valuation",
      periodic_stated_rate: periodicStated,
      periodic_market_rate: periodicMarket,
    },
  };
}

const noteValidator: Validator = (pkg: AnswerPackageData): ValidationResult => {
  const computed = pkg.computed_values;
  const answer = pkg.answer_payload;
  if (!computed.issuance_price) {
    return { validator: "note_valuation_match", status: "pass", message: "No computed issuance price, skipped" };
  }
  // Check if answer mentions an issuance price within tolerance
  const answerPrice = Number(answer.issuance_price ?? answer.present_value ?? answer.pv);
  if (!answerPrice) {
    return { validator: "note_valuation_match", status: "warn", message: "Could not find issuance price in answer to compare" };
  }
  const diff = Math.abs(answerPrice - computed.issuance_price);
  const tolerance = Math.max(1, computed.issuance_price * 0.005); // 0.5% or $1
  if (diff > tolerance) {
    return {
      validator: "note_valuation_match",
      status: "fail",
      message: `Issuance price mismatch: answer=${answerPrice}, computed=${computed.issuance_price} (diff=${diff.toFixed(2)})`,
      details: { answerPrice, computedPrice: computed.issuance_price, diff, tolerance },
    };
  }
  return { validator: "note_valuation_match", status: "pass", message: `Issuance price matches within tolerance (${diff.toFixed(2)})` };
};

// Register on import
registerCalculator({
  id: "note_valuation",
  name: "Note Valuation (PV + Effective Interest)",
  appliesTo: ["note", "notes payable", "notes receivable", "bond", "bonds", "present value", "pv", "effective interest", "amortization"],
  compute: computeNoteValuation,
  validator: noteValidator,
});
