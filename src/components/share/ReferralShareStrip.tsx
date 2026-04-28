import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useReferralCode } from "@/hooks/useReferralCode";

const NAVY = "#14213D";
const SHARE_BASE = "https://learn.surviveaccounting.com";

interface ReferralShareStripProps {
  userId: string | null | undefined;
  /** Visual variant — 'dark' for navy backgrounds, 'light' for white modals. */
  variant?: "dark" | "light";
  /** Optional override copy; defaults to the headline below. */
  headline?: string;
  className?: string;
}

/**
 * Subtle "Share 2 free passes with friends" CTA with one-click copy.
 * Generates / fetches the user's referral code lazily.
 */
export function ReferralShareStrip({
  userId,
  variant = "dark",
  headline = "Share 2 free passes with friends",
  className = "",
}: ReferralShareStripProps) {
  const { code, loading } = useReferralCode(userId);
  const [copied, setCopied] = useState(false);

  if (!userId) return null;

  const link = code ? `${SHARE_BASE}/?ref=${code}` : "";

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied — your friend gets free access when they join");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy manually.");
    }
  };

  const isDark = variant === "dark";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 ${className}`}
      style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
        border: isDark
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid #E5E7EB",
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-[12.5px] font-semibold leading-tight"
          style={{ color: isDark ? "#FFFFFF" : NAVY }}
        >
          {headline}
        </div>
        <div
          className="text-[11px] mt-0.5 truncate font-mono"
          style={{
            color: isDark ? "rgba(255,255,255,0.5)" : "#94A3B8",
          }}
        >
          {loading ? "Generating your link…" : link || "—"}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!link || loading}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50"
        style={{
          background: isDark ? "#FFFFFF" : NAVY,
          color: isDark ? NAVY : "#FFFFFF",
        }}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copy link
          </>
        )}
      </button>
    </div>
  );
}
