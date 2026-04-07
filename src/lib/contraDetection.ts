// Contra account detection logic shared between JE and Accounts tabs

const CONTRA_ASSET_PREFIXES = [
  "Allowance for",
  "Accumulated Depreciation",
  "Accumulated Amortization",
  "Treasury Stock",
];

const CONTRA_LIABILITY_PREFIXES = [
  "Discount on Bonds",
  "Discount on Notes",
];

const CONTRA_REVENUE_NAMES = [
  "Sales Returns and Allowances",
  "Sales Discounts",
];

const NOT_CONTRA_PREFIXES = ["Unearned", "Deferred"];
const NOT_CONTRA_NAMES = ["Premium on Bonds Payable"];

const CONTRA_TYPES = ["Contra Asset", "Contra Revenue", "Contra Liability"];

export function isContraAccount(accountName: string, accountType?: string): boolean {
  if (accountType && CONTRA_TYPES.includes(accountType)) return true;

  const name = accountName.trim();
  
  // Explicit exclusions
  if (NOT_CONTRA_NAMES.includes(name)) return false;
  if (NOT_CONTRA_PREFIXES.some(p => name.startsWith(p))) return false;

  // Check contra asset prefixes (but "Discount on" only for assets, handled by prefix check below)
  if (CONTRA_ASSET_PREFIXES.some(p => name.startsWith(p))) return true;
  if (name.startsWith("Discount on") && !name.startsWith("Discount on Bonds") && !name.startsWith("Discount on Notes")) return true;

  // Contra liability
  if (CONTRA_LIABILITY_PREFIXES.some(p => name.startsWith(p))) return true;

  // Contra revenue
  if (CONTRA_REVENUE_NAMES.includes(name)) return true;

  return false;
}
