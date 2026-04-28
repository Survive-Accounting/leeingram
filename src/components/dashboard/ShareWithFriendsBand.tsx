import { useState } from "react";
import { Copy, Check, MessageCircle, Sparkles } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface Props {
  betaNumber: number | null;
  campusName: string | null;
  /** When true, renders a denser layout suitable for half-width column placement. */
  compact?: boolean;
}

export default function ShareWithFriendsBand({ betaNumber, campusName, compact = false }: Props) {
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
      className={`relative overflow-hidden rounded-2xl h-full ${compact ? "p-6 sm:p-7" : "p-6 sm:p-10"}`}
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

      <div className={`relative h-full flex flex-col ${compact ? "" : "max-w-2xl"}`}>
        <div
          className="inline-flex items-center self-start gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase"
          style={{
            background: "rgba(255,255,255,0.12)",
            color: "#FCA5A5",
            letterSpacing: "0.16em",
          }}
        >
          <Sparkles className="h-3 w-3" /> Help us, help you
        </div>

        <h2
          className={`mt-3 leading-[1.08] ${compact ? "text-[24px] sm:text-[28px]" : "text-[28px] sm:text-[38px]"}`}
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Make this beta epic — share it with a friend.
        </h2>

        <p
          className={`mt-2.5 leading-snug ${compact ? "text-[13.5px]" : "text-[14.5px] sm:text-[15.5px]"}`}
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          Every friend who joins helps us improve the tools before finals.
        </p>

        <div className={`flex flex-col gap-2.5 ${compact ? "mt-5" : "mt-6 sm:flex-row sm:gap-3"}`}>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[14px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: "#fff",
              color: NAVY,
              minWidth: compact ? undefined : 200,
            }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Link copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy link
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
              minWidth: compact ? undefined : 200,
            }}
          >
            <MessageCircle className="h-4 w-4" /> Text a friend
          </a>
        </div>

        <p
          className={`text-[12px] truncate ${compact ? "mt-4" : "mt-4"}`}
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
