/**
 * Account type metadata: derives normal_balance, debit_effect, credit_effect from account_type.
 */

export const ACCOUNT_TYPES = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense",
  "Contra Asset",
  "Contra Liability",
  "Contra Equity",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

interface AccountDefaults {
  normal_balance: "Debit" | "Credit";
  debit_effect: "Increase" | "Decrease";
  credit_effect: "Increase" | "Decrease";
}

const DEFAULTS: Record<AccountType, AccountDefaults> = {
  Asset:             { normal_balance: "Debit",  debit_effect: "Increase", credit_effect: "Decrease" },
  Liability:         { normal_balance: "Credit", debit_effect: "Decrease", credit_effect: "Increase" },
  Equity:            { normal_balance: "Credit", debit_effect: "Decrease", credit_effect: "Increase" },
  Revenue:           { normal_balance: "Credit", debit_effect: "Decrease", credit_effect: "Increase" },
  Expense:           { normal_balance: "Debit",  debit_effect: "Increase", credit_effect: "Decrease" },
  "Contra Asset":    { normal_balance: "Credit", debit_effect: "Decrease", credit_effect: "Increase" },
  "Contra Liability":{ normal_balance: "Debit",  debit_effect: "Increase", credit_effect: "Decrease" },
  "Contra Equity":   { normal_balance: "Debit",  debit_effect: "Increase", credit_effect: "Decrease" },
};

export function deriveDefaults(accountType: AccountType): AccountDefaults {
  return DEFAULTS[accountType] ?? DEFAULTS.Asset;
}

export function generateCsvTemplate(): string {
  return "account_name,account_type,normal_balance\nCash,Asset,Debit\nAccounts Receivable,Asset,Debit\nAccounts Payable,Liability,Credit\n";
}

export function parseCsvImport(csv: string): Array<{
  account_name: string;
  account_type: AccountType;
  normal_balance: string;
  debit_effect: string;
  credit_effect: string;
}> {
  const lines = csv.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const nameIdx = header.indexOf("account_name");
  const typeIdx = header.indexOf("account_type");
  const balIdx = header.indexOf("normal_balance");

  if (nameIdx === -1) return [];

  const results: ReturnType<typeof parseCsvImport> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    const name = cols[nameIdx];
    if (!name) continue;

    const rawType = cols[typeIdx] || "Asset";
    const matchedType = ACCOUNT_TYPES.find(t => t.toLowerCase() === rawType.toLowerCase()) || "Asset";
    const defaults = deriveDefaults(matchedType);

    const normalBal = balIdx >= 0 && cols[balIdx] ? cols[balIdx] : defaults.normal_balance;

    results.push({
      account_name: name,
      account_type: matchedType,
      normal_balance: normalBal,
      debit_effect: defaults.debit_effect,
      credit_effect: defaults.credit_effect,
    });
  }

  return results;
}
