import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { getStoredFingerprint, getDeviceName } from "@/hooks/useDeviceFingerprint";
import { sendMagicLink } from "@/lib/sendMagicLink";

const registerDevice = async (studentId: string, email: string) => {
  try {
    const fingerprint = getStoredFingerprint();
    const deviceName = getDeviceName();

    const { data: existing } = await (supabase as any)
      .from("student_devices")
      .select("id, login_count")
      .eq("student_id", studentId)
      .eq("device_fingerprint", fingerprint)
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from("student_devices")
        .update({
          last_login_at: new Date().toISOString(),
          login_count: (existing.login_count || 1) + 1,
          is_active: true,
        })
        .eq("id", existing.id);
    } else {
      await (supabase as any)
        .from("student_devices")
        .insert({
          student_id: studentId,
          email,
          device_fingerprint: fingerprint,
          device_name: deviceName,
        });

      // Check device count — flag if 5+
      const { count } = await (supabase as any)
        .from("student_devices")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("is_active", true);

      if (count && count >= 5) {
        await (supabase as any)
          .from("student_devices")
          .update({
            is_flagged: true,
            flag_reason: "Device limit reached (5+ devices)",
          })
          .eq("student_id", studentId)
          .eq("device_fingerprint", fingerprint);
      }
    }
  } catch (err) {
    console.error("Device registration error:", err);
  }
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          navigate("/login?message=invalid_link", { replace: true });
          return;
        }

        const email = session.user.email;
        if (!email) {
          navigate("/login?message=invalid_link", { replace: true });
          return;
        }

        const url = new URL(window.location.href);
        const nextParam = url.searchParams.get("next");
        const nonce = url.searchParams.get("n");
        const cleanEmail = email.toLowerCase();

        // ── Device-binding check ─────────────────────────────────────────
        // If the link carries a nonce, verify it was opened on the same
        // device that requested it. Links without a nonce (legacy emails,
        // password reset flows, etc.) are allowed through.
        if (nonce) {
          try {
            const { data: vdata } = await supabase.functions.invoke(
              "verify-magic-link",
              { body: { nonce, fingerprint: getStoredFingerprint() } },
            );
            const outcome = (vdata as any)?.outcome;

            if (outcome === "device_mismatch") {
              // Sign out, fire a fresh link to *this* device, send to login
              await supabase.auth.signOut();
              void sendMagicLink({ email: cleanEmail, allowNew: true });
              navigate(
                `/login?message=device_mismatch&resent=1&email=${encodeURIComponent(cleanEmail)}`,
                { replace: true },
              );
              return;
            }
            if (outcome === "expired" || outcome === "consumed") {
              await supabase.auth.signOut();
              navigate(
                `/login?message=link_expired&email=${encodeURIComponent(cleanEmail)}`,
                { replace: true },
              );
              return;
            }
            // outcome === "ok" or "not_found" → fall through and allow.
            // ("not_found" covers backwards compat for stale/legacy nonces.)
          } catch (vErr) {
            console.error("verify-magic-link failed", vErr);
            // Fail-open so a transient network error doesn't lock the user out.
          }
        }

        // Instant redirect — gating happens on the destination via useAccessControl.
        navigate(nextParam || "/my-dashboard", { replace: true });

        // Fire-and-forget LW enrollment (returns 202 immediately)
        void supabase.functions
          .invoke("enroll-lw-background", { body: { email: cleanEmail } })
          .catch(() => { /* noop */ });

        // Fire-and-forget side effects (no await before navigate above).
        void (async () => {
          try {
            const { data: student } = await supabase
              .from("students")
              .select("id")
              .eq("email", cleanEmail)
              .maybeSingle();
            if (student) registerDevice(student.id, cleanEmail);
          } catch { /* noop */ }

          try {
            await supabase.from("profiles").upsert(
              {
                user_id: session.user.id,
                email: cleanEmail,
                last_login_at: new Date().toISOString(),
                last_user_agent: navigator.userAgent,
              },
              { onConflict: "user_id" },
            );
          } catch { /* noop */ }
        })();
      } catch {
        setStatus("error");
      }
    };

    handleCallback();
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F9FA" }}>
        <div className="text-center space-y-3">
          <p className="text-[15px] font-medium" style={{ color: "#14213D" }}>
            Something went wrong verifying your login.
          </p>
          <a
            href="/login"
            className="text-[14px] font-medium hover:underline"
            style={{ color: "#CE1126" }}
          >
            Try again →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FA" }}>
      <div className="flex items-center gap-2" style={{ color: "#666" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-[14px]">Verifying your login...</span>
      </div>
    </div>
  );
}
