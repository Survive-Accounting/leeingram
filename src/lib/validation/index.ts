// Re-export everything + auto-register calculators
export * from "./validationEngine";
export * from "./calculatorRegistry";

// Import calculators to trigger registration
import "./calculators/noteValuation";
