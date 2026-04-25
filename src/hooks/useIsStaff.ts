import { useAuth } from "@/contexts/AuthContext";
import { useVaAccount } from "@/hooks/useVaAccount";

const ADMIN_EMAILS = ["lee@survivestudios.com", "jking.cim@gmail.com"];

/**
 * Returns true if the signed-in user is an admin or any VA
 * (i.e. anyone who should see internal dev tools).
 */
export function useIsStaff(): boolean {
  const { user } = useAuth();
  const { vaAccount } = useVaAccount();
  const email = (user?.email ?? "").trim().toLowerCase();
  if (ADMIN_EMAILS.includes(email)) return true;
  if (vaAccount) return true; // any va_accounts row (admin or VA role)
  return false;
}
