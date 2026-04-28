import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { sendMagicLink } from "@/lib/sendMagicLink";

const NAVY = "#14213D";
const RED = "#CE1126";

interface CheckEmailPanelProps {
  email: string;
  /** Optional — called when the user clicks "Use a different email". */
  onChangeEmail?: () => void;
  /** Label/click for the bottom dismiss button. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Whether to allow sending links to emails without a prior account. */
  allowNew?: boolean;
}

const COOLDOWN_MS = 30_000;

/**
 * Reused "Check your email" panel for the magic-link-sent state.
 *
 * Reframes the message around the fact that the user already has an account,
 * shows the email back, calls out the 15-minute expiry + same-device
 * requirement, and offers a throttled Resend button.
 */
export default function CheckEmailPanel({
  email,
  onChangeEmail,
  onDismiss,
  dismissLabel = "Done",
  allowNew = false,
}: CheckEmailPanelProps) {
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [resendErr, setResendErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!resentAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resentAt]);

  const remaining = resentAt ? Math.max(0, COOLDOWN_MS - (now - resentAt)) : 0;
  const canResend = !resending && remaining === 0;

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setResendErr(null);
    const res = await sendMagicLink({ email, allowNew });
    setResending(false);
    if (!res.ok) {
      setResendErr(res.error);
    } else {
      setResentAt(Date.now());
      setNow(Date.now());
    }
  };

  return (
    <div className="px-6 sm:px-8 pt-8 pb-8 text-center">
      <h2
        className="text-[22px] sm:text-[24px] leading-tight"
        style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
      >
        Welcome back!
      </h2>

      <p
        className="mt-3 text-[14px]"
        style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
      >
        You already have an account. We sent a login link to{" "}
        <span style={{ color: NAVY, fontWeight: 600 }}>{email}</span>.
      </p>

      <p
        className="mt-2 text-[12px]"
        style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
      >
        Expires in 15 minutes. Open it on this device to sign in.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend}
          className="w-full rounded-lg py-2.5 text-[13px] font-semibold transition-all hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            border: "1px solid #E5E7EB",
            color: NAVY,
            background: "white",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {resending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending…
            </>
          ) : remaining > 0 ? (
            `Resend in ${Math.ceil(remaining / 1000)}s`
          ) : resentAt ? (
            <>
              <CheckCircle2 className="w-4 h-4" style={{ color: "#16A34A" }} />
              Login link resent
            </>
          ) : (
            "Resend login link"
          )}
        </button>

        {resendErr && (
          <p className="text-[12px]" style={{ color: RED, fontFamily: "Inter, sans-serif" }}>
            {resendErr}
          </p>
        )}

        {onChangeEmail && (
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-[12px] font-medium hover:underline"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            Use a different email
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110"
          style={{ background: NAVY, fontFamily: "Inter, sans-serif" }}
        >
          {dismissLabel}
        </button>
      )}
    </div>
  );
}
