import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      setError("Please use your .edu email address");
      return;
    }

    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: window.location.origin + "/auth/callback",
        },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch {
      setError("Something went wrong. Try again or contact Lee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F9FA" }}>
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ background: "#14213D", fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            SA
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#14213D" }}>
            Sign in to Survive Accounting
          </h1>
          <p className="text-[14px]" style={{ color: "#666" }}>
            We'll send a login link to your email — no password needed.
          </p>
        </div>

        {/* Message banners */}
        {message === "no_purchase" && (
          <div className="rounded-lg px-4 py-3 text-[13px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
            No active study pass found for this email. Purchase one below to get started.
          </div>
        )}
        {message === "invalid_link" && (
          <div className="rounded-lg px-4 py-3 text-[13px]" style={{ background: "#FEE2E2", color: "#991B1B" }}>
            This login link has expired or already been used. Request a new one below.
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6" style={{ borderColor: "#E5E7EB" }}>
          {sent ? (
            <div className="text-center space-y-3 py-2">
              <div className="text-3xl">📬</div>
              <h2 className="text-lg font-semibold" style={{ color: "#14213D" }}>
                Check your email
              </h2>
              <p className="text-[14px]" style={{ color: "#666" }}>
                We sent a login link to{" "}
                <span className="font-medium" style={{ color: "#14213D" }}>
                  {email}
                </span>
              </p>
              <p className="text-[13px]" style={{ color: "#999" }}>
                It may take a minute to arrive. Check your spam folder if you don't see it.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-[13px] font-medium hover:underline"
                style={{ color: "#CE1126" }}
              >
                Wrong email? Start over →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: "#14213D" }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="your@university.edu"
                  required
                  disabled={loading}
                  className="w-full rounded-lg px-4 text-[15px] outline-none transition-all focus:ring-2"
                  style={{
                    minHeight: 48,
                    background: "#F8F9FA",
                    border: `1px solid ${error ? "#EF4444" : "#E5E7EB"}`,
                    color: "#14213D",
                    focusRingColor: "#14213D",
                  }}
                />
                {error && (
                  <p className="text-[12px] font-medium" style={{ color: "#EF4444" }}>
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ minHeight: 56, background: "#14213D" }}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Send Login Link →"
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[13px]" style={{ color: "#999" }}>
          Purchased but no email yet?{" "}
          <a
            href="mailto:lee@surviveaccounting.com"
            className="font-medium hover:underline"
            style={{ color: "#CE1126" }}
          >
            Contact Lee →
          </a>
        </p>
      </div>
    </div>
  );
}
