import { useState } from "react";
import { ShoppingCart, X, Check } from "lucide-react";
import { DevShortcut } from "@/components/DevShortcut";

const STRIPE_PAYMENT_LINK = "#stripe-payment-link";
const NAVY = "#14213D";

interface PreviewPurchaseBarProps {
  /** Retained for API compatibility; copy is fixed. */
  priceCents?: number;
  campusSlug?: string;
  courseSlug?: string;
  email?: string;
}

function CheckboxChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center rounded-[3px]"
        style={{
          width: 13,
          height: 13,
          background: "#fff",
          border: "1px solid rgba(255,255,255,0.4)",
        }}
      >
        <Check size={10} strokeWidth={3} style={{ color: NAVY }} />
      </span>
      <span className="text-[12px] text-white/85">{label}</span>
    </span>
  );
}

export default function PreviewPurchaseBar(_props: PreviewPurchaseBarProps) {
  const [refundOpen, setRefundOpen] = useState(false);

  const ctaButton = (compact = false) => (
    <a href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer">
      <button
        className={`inline-flex items-center gap-2 rounded-lg font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] ${
          compact ? "px-4 py-2.5 text-[13px]" : "px-6 py-3 text-[15px]"
        }`}
        style={{
          background: NAVY,
          border: "1px solid rgba(255,255,255,0.15)",
          minHeight: compact ? undefined : 48,
        }}
      >
        <ShoppingCart size={compact ? 14 : 16} className="text-white" />
        Buy Full Access —{" "}
        <span className="line-through opacity-50 font-normal">$250</span>{" "}
        <span>$99</span>
      </button>
    </a>
  );

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-6"
        style={{
          background: "#0F1A33",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.25)",
        }}
      >
        <div className="max-w-[1200px] mx-auto w-full py-3">
          {/* DESKTOP LAYOUT */}
          <div className="hidden md:flex items-center justify-between gap-6">
            {/* LEFT */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-4">
                <CheckboxChip label="Spring 2026" />
                <CheckboxChip label="Summer 2026" />
              </div>
              <span className="text-[12px] text-white/55 font-light leading-tight mt-1">
                Active through Aug 1 · Renews after, cancel anytime
              </span>
            </div>

            {/* CENTER */}
            <div className="flex flex-col items-center gap-1.5">
              {ctaButton(false)}
              <button
                onClick={() => setRefundOpen(true)}
                className="text-[12px] text-white/60 underline underline-offset-2 hover:text-white/90 transition-colors"
              >
                7-day refund guarantee
              </button>
            </div>

            {/* RIGHT (intentionally blank for future use) */}
            <div className="shrink-0" style={{ minWidth: 120 }} />
          </div>

          {/* MOBILE LAYOUT */}
          <div className="flex md:hidden items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <CheckboxChip label="Spring 2026" />
                <CheckboxChip label="Summer 2026" />
              </div>
              <span className="text-[11px] text-white/55 leading-tight mt-1">
                Active through Aug 1
              </span>
              <span className="text-[11px] text-white/55 leading-tight">
                Renews after, cancel anytime
              </span>
              <button
                onClick={() => setRefundOpen(true)}
                className="text-[11px] text-white/60 underline underline-offset-2 hover:text-white/90 transition-colors mt-1 self-start"
              >
                7-day refund guarantee
              </button>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              {ctaButton(true)}
            </div>
          </div>

          <div className="flex justify-center mt-1">
            <DevShortcut label="[DEV] Skip to dashboard →" to="/my-dashboard" />
          </div>
        </div>
      </div>

      {/* REFUND MODAL */}
      {refundOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setRefundOpen(false)}
        >
          <div
            className="relative bg-white rounded-2xl max-w-[480px] w-full p-7 sm:p-8"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setRefundOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <h2
              className="text-[22px] sm:text-[24px] font-bold mb-4"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
            >
              7-Day Refund Guarantee
            </h2>

            <div className="space-y-3 text-[14px] leading-relaxed" style={{ color: "#374151" }}>
              <p>
                If Survive Accounting doesn't help you study more effectively within 7 days of
                purchase, we'll refund you in full — no questions asked.
              </p>
              <p>
                To request a refund, email{" "}
                <a
                  href="mailto:lee@surviveaccounting.com"
                  className="underline"
                  style={{ color: NAVY }}
                >
                  lee@surviveaccounting.com
                </a>{" "}
                within 7 days of your purchase date. Refunds are processed within 3-5 business days
                back to your original payment method.
              </p>
              <p>
                We built this for students. If it's not working for you, we don't want your money.
              </p>
            </div>

            <p className="italic text-[13px] text-gray-500 mt-5">— Lee</p>
          </div>
        </div>
      )}
    </>
  );
}
