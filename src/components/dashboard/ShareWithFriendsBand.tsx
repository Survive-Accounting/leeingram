import { useState } from "react";
import { Copy, Check, MessageCircle, Sparkles } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface Props {
  betaNumber: number | null;
  campusName: string | null;
}

export default function ShareWithFriendsBand({ betaNumber, campusName }: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = betaNumber
    ? `https://learn.surviveaccounting.com/?ref=${betaNumber}`
    : "https://learn.surviveaccounting.com/";

  const smsBody = encodeURIComponent(
    `Found a free beta study tool for accounting — actually built by a tutor (not random AI). Free through finals: ${shareUrl}`,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-6 sm:p-10"
      style={{
        background:
          "linear-gradient(135deg, #14213D 0%, #1E3A66 55%, #14213D 100%)",
        boxShadow: "0 24px 60px rgba(20,33,61,0.30)",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-30 blur-3xl"
        style={{ background: RED }}
      />
      <div
        aria-hidden
        className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full opacity-20 blur-3xl"
        style={{ background: "#3B82F6" }}
      />

      <div className="relative max-w-2xl">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.12)", color: "#FCA5A5" }}
        >
          <Sparkles className="h-3 w-3" /> Help us launch loud
        </div>

        <h2
          className="mt-3 text-[28px] sm:text-[38px] leading-[1.1]"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Make this beta epic — share it with a friend.
        </h2>

        <p
          className="mt-3 text-[14.5px] sm:text-[15.5px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          Every friend who joins makes the tools sharper for{" "}
          {campusName ? campusName : "your class"} — and bumps you up the
          leaderboard. The more feedback we get, the better this gets before
          your final.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[14px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: "#fff",
              color: NAVY,
              minWidth: 220,
            }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Link copied — paste anywhere
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy share link
              </>
            )}
          </button>

          <a
            href={`sms:?&body=${smsBody}`}
            className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[14px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              color: "#fff",
              boxShadow: "0 6px 18px rgba(206,17,38,0.35)",
              minWidth: 220,
            }}
          >
            <MessageCircle className="h-4 w-4" /> Text a friend now
          </a>
        </div>

        <p
          className="mt-4 text-[12px]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Your link:{" "}
          <span style={{ color: "rgba(255,255,255,0.85)", fontFamily: "monospace" }}>
            {shareUrl}
          </span>
        </p>
      </div>
    </section>
  );
}
