import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight client-side referral tracking for the Solutions Viewer share flow.
 *
 * Identity model:
 * - "referrer_id" today = the student's email (we have no auth user id yet — magic-link auth is pending).
 *   When student auth ships, we can swap to auth.uid() without changing the schema.
 * - "visitor_id" = an anonymous, per-browser uuid stored in localStorage.
 */

const REF_KEY = "sa_referrer_id"; // who sent me the link
const VISITOR_KEY = "sa_visitor_id"; // stable anonymous id for this browser
const STUDENT_EMAIL_KEY = "v2_student_email";

/** Get or create a stable per-browser anonymous visitor id. */
export function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

/** Returns the email of the signed-in student (best-effort), used as the referrer id today. */
export function getCurrentReferrerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STUDENT_EMAIL_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Build the share URL for a problem, including ?ref=<referrer_id> when available.
 * Falls back to the plain page URL if there is no current referrer id.
 */
export function buildShareUrl(): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const referrerId = getCurrentReferrerId();
  if (referrerId) {
    url.searchParams.set("ref", referrerId);
  } else {
    url.searchParams.delete("ref");
  }
  return url.toString();
}

/**
 * Captures a `?ref=` query param on page load and persists it in localStorage
 * so it can be attached to a future signup or purchase. Also logs a
 * `visit` row to problem_referrals so we can see which links drive traffic.
 *
 * Safe to call on every viewer mount — it no-ops when there is no ref.
 */
export async function captureRefFromUrl(opts: {
  problemId?: string | null;
  problemCode?: string | null;
} = {}) {
  if (typeof window === "undefined") return;
  let ref: string | null = null;
  try {
    const params = new URLSearchParams(window.location.search);
    ref = params.get("ref");
  } catch {
    return;
  }
  if (!ref) return;

  // Don't credit a self-referral (signed-in student viewing their own link).
  const me = getCurrentReferrerId();
  if (me && me.toLowerCase() === ref.toLowerCase()) return;

  // Persist for later attribution (signup / purchase).
  try {
    localStorage.setItem(REF_KEY, ref);
  } catch {
    // ignore
  }

  // Log the visit (best-effort, non-blocking).
  try {
    await supabase.from("problem_referrals").insert({
      referrer_id: ref,
      problem_id: opts.problemId ?? null,
      problem_code: opts.problemCode ?? null,
      visitor_id: getOrCreateVisitorId(),
      event_type: "visit",
      referrer_url: typeof document !== "undefined" ? document.referrer || null : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // ignore
  }
}

/** Logs a share_click for the current referrer + problem. */
export async function logShareClick(opts: {
  problemId?: string | null;
  problemCode?: string | null;
}) {
  const referrerId = getCurrentReferrerId();
  // No identified referrer → nothing to attribute.
  if (!referrerId) return;
  try {
    await supabase.from("problem_referrals").insert({
      referrer_id: referrerId,
      problem_id: opts.problemId ?? null,
      problem_code: opts.problemCode ?? null,
      visitor_id: getOrCreateVisitorId(),
      event_type: "share_click",
      referrer_url: typeof document !== "undefined" ? document.referrer || null : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // ignore
  }
}

/** Returns the stored referrer captured on landing (if any). */
export function getStoredReferrerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

/**
 * Call this on signup / purchase to mark all open referrals from this visitor
 * as converted and attach the visitor_email. Idempotent.
 */
export async function attachReferrerOnConversion(visitorEmail: string) {
  const ref = getStoredReferrerId();
  const visitorId = getOrCreateVisitorId();
  if (!ref || !visitorId) return;

  try {
    await supabase
      .from("problem_referrals")
      .update({
        converted: true,
        converted_at: new Date().toISOString(),
        visitor_email: visitorEmail.trim().toLowerCase(),
      })
      .eq("referrer_id", ref)
      .eq("visitor_id", visitorId)
      .eq("converted", false);
  } catch {
    // ignore
  }
}

export function clearStoredReferrer() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    // ignore
  }
}
