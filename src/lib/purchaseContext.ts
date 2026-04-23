export type PurchaseContext = {
  email: string | null;
  campus: string | null;
  selectedCourse: string | null;
  selectedPlan: string | null;
  includedCourses: string[];
  amountPaid: number | null;
  verifiedAt: string;
};

const KEY = "sa_purchase_context";

export function getPurchaseContext(): PurchaseContext | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PurchaseContext;
  } catch {
    return null;
  }
}

export function clearPurchaseContext() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
