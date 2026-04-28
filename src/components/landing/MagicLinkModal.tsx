import { useEffect, useState } from "react";
import { X, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendMagicLink } from "@/lib/sendMagicLink";

const NAVY = "#14213D";
const RED = "#CE1126";

interface MagicLinkModalProps {
  open: boolean;
  onClose: () => void;
}

type Provider = "gmail" | "outlook" | "apple";

function detectProvider(email: string): Provider | null {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail";
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com"
  )
    return "outlook";
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com")
    return "apple";
  return null;
}

const PROVIDER_LINKS: Record<Provider, { label: string; url: string }> = {
  gmail: {
    label: "Open Gmail",
    url: "https://mail.google.com/mail/u/0/#inbox",
  },
  outlook: {
    label: "Open Outlook",
    url: "https://outlook.live.com/mail/0/inbox",
  },
  apple: {
    label: "Open Apple Mail",
    url: "https://www.icloud.com/mail",
  },
};

export default function MagicLinkModal({ open, onClose }: MagicLinkModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
      setEmail("");
      setSupportOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const sendLink = async (target: string) => {
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: target,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    return otpErr;
  };

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
      const otpErr = await sendLink(clean);
      if (otpErr) {
        const msg = otpErr.message?.toLowerCase() || "";
        if (
          msg.includes("not found") ||
          msg.includes("invalid") ||
          msg.includes("signups not allowed")
        ) {
          setError("We couldn't find an active Study Pass for that email.");
        } else {
          setError("Something went wrong. Try again or email lee@surviveaccounting.com.");
        }
        return;
      }
      setEmail(clean);
      setSent(true);
    } catch {
      setError("Something went wrong. Try again or email lee@surviveaccounting.com.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      const otpErr = await sendLink(email);
      if (otpErr) {
        toast.error("Couldn't resend. Try again in a minute.");
      } else {
        toast.success("New login link sent.");
      }
    } catch {
      toast.error("Couldn't resend. Try again in a minute.");
    } finally {
      setResending(false);
    }
  };

  const provider = sent ? detectProvider(email) : null;
  const orderedProviders: Provider[] = provider
    ? [provider, ...(["gmail", "outlook", "apple"] as Provider[]).filter((p) => p !== provider)]
    : (["gmail", "outlook", "apple"] as Provider[]);

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

        {sent ? (
          <div className="text-center pt-2">
            <div className="text-5xl mb-3 leading-none">📬</div>
            <h3
              className="text-[22px]"
              style={{
                color: NAVY,
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              Check your email
            </h3>
            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: "#64748B" }}
            >
              We sent a secure login link to your study tools at{" "}
              <span style={{ color: NAVY, fontWeight: 600 }}>{email}</span>.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {orderedProviders.map((p, idx) => {
                const isPrimary = idx === 0 && provider !== null;
                const { label, url } = PROVIDER_LINKS[p];
                return (
                  <a
                    key={p}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg py-2.5 text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2"
                    style={
                      isPrimary
                        ? {
                            background: NAVY,
                            color: "#fff",
                            border: `1px solid ${NAVY}`,
                          }
                        : {
                            background: "#fff",
                            color: NAVY,
                            border: `1px solid #CBD5E1`,
                          }
                    }
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {label}
                  </a>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl py-3 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
              style={{
                background: NAVY,
                boxShadow: "0 4px 14px rgba(20,33,61,0.25)",
              }}
            >
              Got it
            </button>

            <p className="mt-3 text-[12px]" style={{ color: "#94A3B8" }}>
              Didn't see it?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="underline font-medium disabled:opacity-60"
                style={{ color: NAVY }}
              >
                {resending ? "Resending…" : "Resend email"}
              </button>{" "}
              or{" "}
              <button
                type="button"
                onClick={() => setSupportOpen(true)}
                className="underline font-medium"
                style={{ color: NAVY }}
              >
                contact Lee
              </button>
              .
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {supportOpen && (
        <SupportModal
          prefilledEmail={email}
          onClose={() => setSupportOpen(false)}
        />
      )}
    </div>
  );
}

function SupportModal({
  prefilledEmail,
  onClose,
}: {
  prefilledEmail: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefilledEmail);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      const trimmed = {
        name: name.trim(),
        email: email.trim(),
        subject: "Login help",
        message: message.trim(),
      };
      const { error } = await (supabase as any)
        .from("contact_messages")
        .insert(trimmed);
      if (error) throw error;
      supabase.functions
        .invoke("send-contact-notification", { body: trimmed })
        .catch(() => {});
      toast.success("Message sent — Lee will reach out shortly.");
      onClose();
    } catch {
      toast.error("Couldn't send. Email lee@surviveaccounting.com directly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.65)", fontFamily: "Inter, sans-serif" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl p-7 relative"
        style={{
          background: "#fff",
          boxShadow: "0 24px 60px rgba(20,33,61,0.30)",
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
          className="text-[22px] leading-tight"
          style={{
            color: NAVY,
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
          }}
        >
          Need help logging in?
        </h2>
        <p className="mt-1.5 text-[13px]" style={{ color: "#64748B" }}>
          Send Lee a quick note and he'll get back to you.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={sending}
            autoFocus
            className="w-full rounded-lg px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#14213D]/20"
            style={{ border: `1px solid #CBD5E1`, color: NAVY }}
          />
          <input
            type="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            className="w-full rounded-lg px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#14213D]/20"
            style={{ border: `1px solid #CBD5E1`, color: NAVY }}
          />
          <textarea
            placeholder="What's going on?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sending}
            rows={4}
            className="w-full rounded-lg px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#14213D]/20 resize-none"
            style={{ border: `1px solid #CBD5E1`, color: NAVY }}
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl py-3 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: NAVY,
              boxShadow: "0 4px 14px rgba(20,33,61,0.25)",
            }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send message"}
          </button>
        </form>
      </div>
    </div>
  );
}
