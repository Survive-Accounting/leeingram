import { useState } from "react";
import { Copy, Check, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";
const RED = "#CE1126";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface Props {
  userId: string;
  firstName: string;
  betaNumber: number;
  campusBetaNumber: number | null;
  campusName: string | null;
  onDismiss: () => void;
}

export default function WelcomeCard({
  userId,
  firstName,
  betaNumber,
  campusBetaNumber,
  campusName,
  onDismiss,
}: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://learn.surviveaccounting.com/?ref=${betaNumber}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const dismiss = async () => {
    onDismiss();
    try {
      await supabase
        .from("student_onboarding")
        .update({ welcomed_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch {
      // ignore
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, #14213D 0%, #1E3A66 60%, #14213D 100%)",
        boxShadow: "0 24px 60px rgba(20,33,61,0.25)",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Subtle red accent corner */}
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 blur-3xl"
        style={{ background: RED }}
      />

      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-white/70" />
      </button>

      <div className="relative">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.12)", color: "#FCA5A5" }}
        >
          <Sparkles className="h-3 w-3" /> Welcome to the Beta
        </div>

        <h2
          className="mt-3 text-[26px] sm:text-[34px] leading-tight"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          {firstName ? `You're in, ${firstName}.` : "You're in."}
        </h2>

        <p className="mt-3 text-[15px] sm:text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
          You're the{" "}
          <span style={{ color: "#fff", fontWeight: 700 }}>
            {ordinal(betaNumber)}
          </span>{" "}
          student to join the beta
          {campusBetaNumber && campusName && (
            <>
              {" "}— and the{" "}
              <span style={{ color: "#fff", fontWeight: 700 }}>
                {ordinal(campusBetaNumber)}
              </span>{" "}
              at {campusName}.
            </>
          )}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold transition-all hover:brightness-110"
            style={{
              background: "#fff",
              color: NAVY,
            }}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Link copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Invite friends · Copy share link
              </>
            )}
          </button>

          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            Every friend who joins moves your campus up the leaderboard.
          </span>
        </div>
      </div>
    </section>
  );
}
