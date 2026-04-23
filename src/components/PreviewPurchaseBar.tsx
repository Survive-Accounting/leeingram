import { Button } from "@/components/ui/button";
import { DevShortcut } from "@/components/DevShortcut";

const STRIPE_PAYMENT_LINK = "#stripe-payment-link";
const GOLD = "#d4a017";

interface PreviewPurchaseBarProps {
  /** Retained for API compatibility; copy is now fixed. */
  priceCents?: number;
  campusSlug?: string;
  courseSlug?: string;
  email?: string;
}

export default function PreviewPurchaseBar(_props: PreviewPurchaseBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-6 flex items-center"
      style={{
        background: "#14213D",
        minHeight: "92px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <style>{`
        @keyframes ppbShimmer {
          0%   { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        @keyframes ppbGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(212,160,23,0.35), 0 4px 14px rgba(212,160,23,0.25); }
          50%      { box-shadow: 0 0 18px rgba(212,160,23,0.65), 0 4px 18px rgba(212,160,23,0.45); }
        }
        .ppb-cta {
          position: relative;
          overflow: hidden;
          animation: ppbGlow 2s ease-in-out infinite;
        }
        .ppb-cta::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
          transform: translateX(-120%) skewX(-20deg);
          animation: ppbShimmer 0.8s ease-out 1s 1 forwards;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .ppb-cta { animation: none; }
          .ppb-cta::after { animation: none; opacity: 0; }
        }
      `}</style>

      <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex flex-col">
          <div className="flex items-baseline gap-2 leading-none">
            <span className="text-sm text-white/45 line-through">$250</span>
            <span className="text-2xl sm:text-3xl font-bold text-white">$99</span>
          </div>
          <span className="text-[12px] sm:text-[13px] font-medium text-white/85 mt-1">
            Spring 2026 Beta
          </span>
          <span className="text-[11px] sm:text-[12px] text-white/55">
            Access through May 31
          </span>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          <a href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer">
            <Button
              className="ppb-cta px-4 sm:px-6 py-3 text-[13px] sm:text-[15px] font-bold text-white transition-all hover:brightness-105"
              style={{ background: GOLD, minHeight: 56, height: "auto", border: "none" }}
            >
              ⚡ Get Full Access — $99 →
            </Button>
          </a>
          <DevShortcut label="[DEV] Skip to dashboard →" to="/my-dashboard" />
        </div>
      </div>
    </div>
  );
}
