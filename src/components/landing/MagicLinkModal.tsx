import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";
const RED = "#CE1126";

interface MagicLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export default function MagicLinkModal({ open, onClose }: MagicLinkModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
      setEmail("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: clean,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (otpErr) {
        // Most common: email not registered → no active study pass
        const msg = otpErr.message?.toLowerCase() || "";
        if (
          msg.includes("not found") ||
          msg.includes("invalid") ||
          msg.includes("signups not allowed")
        ) {
          setError(
            "We couldn't find an active Study Pass for that email.",
          );
        } else {
          setError("Something went wrong. Try again or email lee@surviveaccounting.com.");
        }
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again or email lee@surviveaccounting.com.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.55)", fontFamily: "Inter, sans-serif" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl p-7 relative"
        style={{
          background: "#fff",
          boxShadow: "0 24px 60px rgba(20,33,61,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-md p-1 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" style={{ color: "#64748B" }} />
        </button>

        <h2
          className="text-[24px] leading-tight"
          style={{
            color: NAVY,
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
          }}
        >
          Log in to Survive Accounting
        </h2>
        <p className="mt-1.5 text-[13px]" style={{ color: "#64748B" }}>
          Enter your email and we'll send you a secure login link.
        </p>

        {sent ? (
          <div className="mt-5 text-center py-3">
            <div className="text-3xl mb-2">📬</div>
            <p className="text-[15px] font-semibold" style={{ color: NAVY }}>
              Check your email for your secure login link.
            </p>
            <p className="mt-2 text-[12px]" style={{ color: "#94A3B8" }}>
              Sent to {email}. Check your spam folder if you don't see it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="you@university.edu"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#14213D]/20"
              style={{
                border: `1px solid ${error ? "#EF4444" : "#CBD5E1"}`,
                color: NAVY,
              }}
            />
            {error && (
              <p className="text-[12px] font-medium" style={{ color: RED }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: NAVY,
                boxShadow: "0 4px 14px rgba(20,33,61,0.25)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send login link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
