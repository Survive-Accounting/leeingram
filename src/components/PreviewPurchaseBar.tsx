import { Button } from "@/components/ui/button";

const STRIPE_PAYMENT_LINK = "#stripe-payment-link";

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
      className="fixed bottom-0 left-0 right-0 z-50 px-6 flex items-center"
      style={{
        background: "#14213D",
        height: "76px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm text-white/40 line-through">$250</p>
            <p className="text-2xl font-bold text-white">$99</p>
          </div>
          <p className="text-xs sm:text-sm text-white/60 truncate">
            Spring 2026 Beta · Access through May 31
          </p>
        </div>

        <a href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <Button
            className="px-5 sm:px-6 py-3 text-[14px] sm:text-[15px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "#CE1126", minHeight: 56, height: "auto" }}
          >
            Get Full Access — $99 →
          </Button>
        </a>
      </div>
    </div>
  );
}
