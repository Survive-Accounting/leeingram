import { supabase } from "@/integrations/supabase/client";
import { getStoredFingerprint } from "@/hooks/useDeviceFingerprint";

/**
 * Request a device-bound magic login link.
 *
 * Always sends through the `resend-login-link` edge function so the link is
 * issued via Resend (not the default Supabase email) AND tied to the
 * fingerprint of the device that requested it. The recipient must open the
 * link on the same device — `AuthCallback` re-issues a fresh link on
 * mismatch. Links expire in 15 minutes.
 */
export async function sendMagicLink(opts: {
  email: string;
  /** When true, send even if no `students`/`student_purchases` row exists. */
  allowNew?: boolean;
  /** Optional post-login redirect path. */
  next?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("resend-login-link", {
      body: {
        email,
        fingerprint: getStoredFingerprint(),
        userAgent: navigator.userAgent,
        next: opts.next ?? null,
        allow_new: !!opts.allowNew,
      },
    });
    if (error) {
      // Edge fn returns 404 with `error: "No account found..."` for unknown emails
      const msg =
        (data as any)?.error ||
        (error as any)?.context?.error ||
        error.message ||
        "Could not send login link. Try again.";
      return { ok: false, error: String(msg) };
    }
    return { ok: true, error: null };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Could not send login link." };
  }
}
