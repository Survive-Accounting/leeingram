import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAILS = [
  "lee@survivestudios.com",
  "jking.cim@gmail.com",
];

interface UseAccessControlParams {
  courseId: string;
  chapterId?: string;
}

export type AccessLevel = "admin" | "paid" | "trial" | "free_user" | "none";

interface AccessControlResult {
  hasAccess: boolean;
  isLoading: boolean;
  isExpired: boolean;
  accessType: "full_pass" | "chapter_pass" | null;
  accessLevel: AccessLevel;
  freeUserEmail: string | null;
}

interface CacheEntry {
  hasAccess: boolean;
  isExpired: boolean;
  accessType: "full_pass" | "chapter_pass" | null;
  ts: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const FREE_USER_EMAIL_KEY = "sa_free_user_email";

function getStoredFreeUserEmail(): string | null {
  try {
    const raw = localStorage.getItem(FREE_USER_EMAIL_KEY);
    if (!raw) return null;
    const trimmed = raw.trim().toLowerCase();
    return trimmed || null;
  } catch {
    return null;
  }
}

async function getActiveTrialPass(): Promise<boolean> {
  try {
    const params = new URLSearchParams(window.location.search);
    const passCode = params.get("pass");
    if (!passCode || params.get("trial") !== "active") return false;
    const { data } = await (supabase as any)
      .from("viral_passes")
      .select("trial_expires_at")
      .eq("pass_code", passCode.toUpperCase())
      .maybeSingle();
    if (!data?.trial_expires_at) return false;
    return new Date(data.trial_expires_at).getTime() > Date.now();
  } catch {
    return false;
  }
}

export function useAccessControl({ courseId, chapterId }: UseAccessControlParams): AccessControlResult {
  const [result, setResult] = useState<AccessControlResult>({
    hasAccess: false,
    isLoading: true,
    isExpired: false,
    accessType: null,
    accessLevel: "none",
    freeUserEmail: getStoredFreeUserEmail(),
  });

  useEffect(() => {
    if (!courseId) {
      const freeEmail = getStoredFreeUserEmail();
      setResult({
        hasAccess: false,
        isLoading: false,
        isExpired: false,
        accessType: null,
        accessLevel: freeEmail ? "free_user" : "none",
        freeUserEmail: freeEmail,
      });
      return;
    }

    let cancelled = false;

    const check = async () => {
      const freeEmail = getStoredFreeUserEmail();
      // 1. Get session
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email?.toLowerCase() ?? null;

      // 2. Admin bypass (session-cached)
      const cachedAdmin = sessionStorage.getItem("sa_is_admin");
      if (sessionEmail) {
        if (cachedAdmin === "true") {
          if (!cancelled) setResult({
            hasAccess: true, isLoading: false, isExpired: false,
            accessType: "full_pass", accessLevel: "admin", freeUserEmail: freeEmail,
          });
          return;
        }
        if (cachedAdmin === null) {
          let isAdmin = ADMIN_EMAILS.includes(sessionEmail);
          if (!isAdmin) {
            try {
              const { data: vaRow } = await supabase
                .from("va_accounts")
                .select("role")
                .eq("email", sessionEmail)
                .in("role", ["admin", "lead_va"])
                .limit(1);
              if (vaRow && vaRow.length > 0) isAdmin = true;
            } catch { /* ignore */ }
          }
          sessionStorage.setItem("sa_is_admin", String(isAdmin));
          if (isAdmin) {
            if (!cancelled) setResult({
              hasAccess: true, isLoading: false, isExpired: false,
              accessType: "full_pass", accessLevel: "admin", freeUserEmail: freeEmail,
            });
            return;
          }
        }
      }

      const emailForPurchase = sessionEmail ?? freeEmail;

      // 3. Trial pass (URL-based) — full access while active
      if (await getActiveTrialPass()) {
        if (!cancelled) setResult({
          hasAccess: true, isLoading: false, isExpired: false,
          accessType: "full_pass", accessLevel: "trial", freeUserEmail: freeEmail,
        });
        return;
      }

      // 4. Cached purchase lookup
      const cacheKey = `sa_access_${courseId}_${chapterId ?? "full"}_${emailForPurchase ?? "anon"}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          if (Date.now() - entry.ts < CACHE_TTL_MS) {
            if (!cancelled) {
              const level: AccessLevel = entry.hasAccess ? "paid" : (freeEmail ? "free_user" : "none");
              setResult({
                hasAccess: entry.hasAccess,
                isLoading: false,
                isExpired: entry.isExpired,
                accessType: entry.accessType,
                accessLevel: level,
                freeUserEmail: freeEmail,
              });
            }
            return;
          }
        }
      } catch { /* ignore parse errors */ }

      // 5. Query student_purchases (only if we have an email)
      if (!emailForPurchase) {
        if (!cancelled) setResult({
          hasAccess: false, isLoading: false, isExpired: false,
          accessType: null, accessLevel: freeEmail ? "free_user" : "none",
          freeUserEmail: freeEmail,
        });
        return;
      }

      try {
        let query = supabase
          .from("student_purchases")
          .select("purchase_type, expires_at")
          .eq("email", emailForPurchase)
          .eq("course_id", courseId);

        if (chapterId) {
          query = query.or(`chapter_id.eq.${chapterId},chapter_id.is.null`);
        } else {
          query = query.is("chapter_id", null);
        }

        const { data: purchases, error } = await query.limit(10);

        if (error) {
          console.error("useAccessControl query error:", error);
          if (!cancelled) setResult({
            hasAccess: false, isLoading: false, isExpired: false,
            accessType: null, accessLevel: freeEmail ? "free_user" : "none",
            freeUserEmail: freeEmail,
          });
          return;
        }

        if (!purchases || purchases.length === 0) {
          const noAccess: CacheEntry = { hasAccess: false, isExpired: false, accessType: null, ts: Date.now() };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(noAccess)); } catch {}
          if (!cancelled) setResult({
            hasAccess: false, isLoading: false, isExpired: false,
            accessType: null, accessLevel: freeEmail ? "free_user" : "none",
            freeUserEmail: freeEmail,
          });
          return;
        }

        const now = new Date();
        const activePurchase = purchases.find(p => !p.expires_at || new Date(p.expires_at) > now);

        if (activePurchase) {
          const accessType = activePurchase.purchase_type === "full_pass" ? "full_pass" as const : "chapter_pass" as const;
          const entry: CacheEntry = { hasAccess: true, isExpired: false, accessType, ts: Date.now() };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(entry)); } catch {}
          if (!cancelled) setResult({
            hasAccess: true, isLoading: false, isExpired: false,
            accessType, accessLevel: "paid", freeUserEmail: freeEmail,
          });
        } else {
          const entry: CacheEntry = { hasAccess: false, isExpired: true, accessType: null, ts: Date.now() };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(entry)); } catch {}
          if (!cancelled) setResult({
            hasAccess: false, isLoading: false, isExpired: true,
            accessType: null, accessLevel: freeEmail ? "free_user" : "none",
            freeUserEmail: freeEmail,
          });
        }
      } catch (err) {
        console.error("useAccessControl error:", err);
        if (!cancelled) setResult({
          hasAccess: false, isLoading: false, isExpired: false,
          accessType: null, accessLevel: freeEmail ? "free_user" : "none",
          freeUserEmail: freeEmail,
        });
      }
    };

    check();
    return () => { cancelled = true; };
  }, [courseId, chapterId]);

  return result;
}
