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

interface AccessControlResult {
  hasAccess: boolean;
  isLoading: boolean;
  isExpired: boolean;
  accessType: "full_pass" | "chapter_pass" | null;
}

interface CacheEntry {
  hasAccess: boolean;
  isExpired: boolean;
  accessType: "full_pass" | "chapter_pass" | null;
  ts: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useAccessControl({ courseId, chapterId }: UseAccessControlParams): AccessControlResult {
  const [result, setResult] = useState<AccessControlResult>({
    hasAccess: false,
    isLoading: true,
    isExpired: false,
    accessType: null,
  });

  useEffect(() => {
    if (!courseId) {
      setResult({ hasAccess: false, isLoading: false, isExpired: false, accessType: null });
      return;
    }

    let cancelled = false;

    const check = async () => {
      // 1. Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        if (!cancelled) setResult({ hasAccess: false, isLoading: false, isExpired: false, accessType: null });
        return;
      }

      const email = session.user.email.toLowerCase();
      const cacheKey = `sa_access_${courseId}_${chapterId ?? "full"}`;

      // 2. Check sessionStorage cache
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          if (Date.now() - entry.ts < CACHE_TTL_MS) {
            if (!cancelled) {
              setResult({
                hasAccess: entry.hasAccess,
                isLoading: false,
                isExpired: entry.isExpired,
                accessType: entry.accessType,
              });
            }
            return;
          }
        }
      } catch { /* ignore parse errors */ }

      // 3. Query student_purchases
      try {
        // First check for any matching purchase (including expired)
        let query = supabase
          .from("student_purchases")
          .select("purchase_type, expires_at")
          .eq("email", email)
          .eq("course_id", courseId);

        if (chapterId) {
          // Chapter pass for this specific chapter OR full pass (chapter_id IS NULL)
          query = query.or(`chapter_id.eq.${chapterId},chapter_id.is.null`);
        } else {
          query = query.is("chapter_id", null);
        }

        const { data: purchases, error } = await query.limit(10);

        if (error) {
          console.error("useAccessControl query error:", error);
          if (!cancelled) setResult({ hasAccess: false, isLoading: false, isExpired: false, accessType: null });
          return;
        }

        if (!purchases || purchases.length === 0) {
          const noAccess: CacheEntry = { hasAccess: false, isExpired: false, accessType: null, ts: Date.now() };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(noAccess)); } catch {}
          if (!cancelled) setResult({ hasAccess: false, isLoading: false, isExpired: false, accessType: null });
          return;
        }

        const now = new Date();
        // Find an active (non-expired) purchase
        const activePurchase = purchases.find(p => !p.expires_at || new Date(p.expires_at) > now);

        if (activePurchase) {
          const accessType = activePurchase.purchase_type === "full_pass" ? "full_pass" as const : "chapter_pass" as const;
          const entry: CacheEntry = { hasAccess: true, isExpired: false, accessType, ts: Date.now() };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(entry)); } catch {}
          if (!cancelled) setResult({ hasAccess: true, isLoading: false, isExpired: false, accessType });
        } else {
          // All purchases are expired
          const entry: CacheEntry = { hasAccess: false, isExpired: true, accessType: null, ts: Date.now() };
          try { sessionStorage.setItem(cacheKey, JSON.stringify(entry)); } catch {}
          if (!cancelled) setResult({ hasAccess: false, isLoading: false, isExpired: true, accessType: null });
        }
      } catch (err) {
        console.error("useAccessControl error:", err);
        if (!cancelled) setResult({ hasAccess: false, isLoading: false, isExpired: false, accessType: null });
      }
    };

    check();
    return () => { cancelled = true; };
  }, [courseId, chapterId]);

  return result;
}
