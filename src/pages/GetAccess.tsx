import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ShieldCheck, X, Sparkles, ShoppingCart, ChevronDown } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import StagingTestimonialsSection from "@/components/landing/StagingTestimonialsSection";
import { supabase } from "@/integrations/supabase/client";
import { useEmailGate } from "@/contexts/EmailGateContext";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

const PRICE = 150;
const AUTO_RENEW_DISCOUNT = 50;
const EXTEND_PRICE = 100;
const LIFETIME_UPGRADE_PRICE = 150;
const MAX_EXTRA_SEMESTERS = 3; // 4 total including base

// Demo promo codes — replace with server-validated codes later.
const VALID_PROMOS: Record<string, { type: "percent" | "flat"; value: number }> = {
  STUDY10: { type: "percent", value: 10 },
  WELCOME20: { type: "percent", value: 20 },
  FRIEND25: { type: "flat", value: 25 },
};

function getShortSeasonLabel(stepsAhead: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let isFirstHalf = now.getMonth() < 6;

  for (let i = 0; i < stepsAhead; i++) {
    if (isFirstHalf) {
      isFirstHalf = false;
    } else {
      isFirstHalf = true;
      year += 1;
    }
  }
  const yy = String(year).slice(-2);
  return `${isFirstHalf ? "Spring" : "Fall"} \u2019${yy}`;
}

export default function GetAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [extraCount, setExtraCount] = useState(0);
  const [lifetimeUpgrade, setLifetimeUpgrade] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [planAheadOpen, setPlanAheadOpen] = useState(false);

  const totalSemesters = 1 + extraCount;
  const allSemestersAdded = extraCount >= MAX_EXTRA_SEMESTERS;
  const showLifetime = extraCount >= 3;
  const showSavingsHint = extraCount >= 2;

  // Auto-renew gives a $50 discount on the base price (only when no extra semesters added)
  const autoRenewActive = autoRenew && extraCount === 0;
  const baseTotal = PRICE + extraCount * EXTEND_PRICE - (autoRenewActive ? AUTO_RENEW_DISCOUNT : 0);
  const subtotal = baseTotal + (showLifetime && lifetimeUpgrade ? LIFETIME_UPGRADE_PRICE : 0);

  // Promo state
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);

  // Recompute discount whenever subtotal or applied promo changes
  useEffect(() => {
    if (!appliedPromo) return;
    const def = VALID_PROMOS[appliedPromo.code];
    if (!def) return;
    const newDiscount = def.type === "percent"
      ? Math.round((subtotal * def.value) / 100)
      : Math.min(def.value, subtotal);
    if (newDiscount !== appliedPromo.discount) {
      setAppliedPromo({ code: appliedPromo.code, discount: newDiscount });
    }
  }, [subtotal, appliedPromo]);

  const totalPrice = Math.max(0, subtotal - (appliedPromo?.discount || 0));

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const def = VALID_PROMOS[code];
    if (!def) {
      setPromoError("Invalid code");
      return;
    }
    const discount = def.type === "percent"
      ? Math.round((subtotal * def.value) / 100)
      : Math.min(def.value, subtotal);
    setAppliedPromo({ code, discount });
    setPromoError(null);
    setPromoInput("");
    setPromoOpen(false);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
  };

  // Floating toast — only positive deltas (additions)
  const [priceToasts, setPriceToasts] = useState<Array<{ id: number; delta: number }>>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const prevSubtotalRef = React.useRef(subtotal);

  useEffect(() => {
    const prev = prevSubtotalRef.current;
    if (prev !== subtotal) {
      const delta = subtotal - prev;
      if (delta > 0) {
        const id = Date.now() + Math.random();
        setPriceToasts((t) => [...t, { id, delta }]);
        const timeout = setTimeout(() => {
          setPriceToasts((t) => t.filter((x) => x.id !== id));
        }, 1100);
        prevSubtotalRef.current = subtotal;
        setPulseKey((k) => k + 1);
        return () => clearTimeout(timeout);
      }
      prevSubtotalRef.current = subtotal;
      setPulseKey((k) => k + 1);
    }
  }, [subtotal]);

  useEffect(() => {
    if (!showLifetime && lifetimeUpgrade) setLifetimeUpgrade(false);
  }, [showLifetime, lifetimeUpgrade]);

  const selectedSemesters = useMemo(
    () => Array.from({ length: totalSemesters }, (_, i) => ({
      idx: i,
      label: getShortSeasonLabel(i),
    })),
    [totalSemesters],
  );

  const initialEmail = useMemo(() => {
    if (typeof window === "undefined") return emailParam;
    if (emailParam) {
      try {
        localStorage.setItem("student_email", emailParam);
        sessionStorage.setItem("student_email", emailParam);
      } catch { /* ignore */ }
      return emailParam;
    }
    try {
      return (
        localStorage.getItem("student_email") ||
        sessionStorage.getItem("student_email") ||
        ""
      );
    } catch {
      return "";
    }
  }, [emailParam]);

  const [email, setEmail] = useState(initialEmail);
  useEffect(() => {
    if (initialEmail && initialEmail !== email) setEmail(initialEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail]);

  const { requestAccess } = useEmailGate();

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      requestAccess({});
      return;
    }
    try {
      localStorage.setItem("student_email", cleanEmail);
      sessionStorage.setItem("student_email", cleanEmail);
    } catch { /* ignore */ }

    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-get-access-checkout",
        {
          body: {
            email: cleanEmail,
            campus: "ole-miss",
            selectedPlan: "study_pass",
            amount: totalPrice,
            includedSemesters: selectedSemesters.map((s) => s.label),
            autoRenew: autoRenewActive || extraCount > 0,
            extraSemesters: extraCount,
            lifetimeUpgrade: showLifetime && lifetimeUpgrade,
            promoCode: appliedPromo?.code || null,
            origin: window.location.origin,
          },
        },
      );
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Checkout URL missing from response");
      // Break out of any parent iframe (e.g., Lovable preview) so Stripe Checkout
      // can render — Stripe sets X-Frame-Options: DENY and will appear stuck inside an iframe.
      if (window.top && window.top !== window.self) {
        window.top.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      console.error("[get-access checkout]", err);
      setCheckoutError(
        "We couldn't start checkout. Please try again in a moment.",
      );
      setCheckoutLoading(false);
    }
  };

  const nextSemesterLabel = !allSemestersAdded
    ? getShortSeasonLabel(totalSemesters)
    : null;

  const hasDiscount = !!appliedPromo && appliedPromo.discount > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <StagingNavbar
        onCtaClick={() => navigate("/staging")}
        onPricingClick={() => {}}
      />

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-12 md:pt-20 pb-8 text-center relative">
        <h1
          className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Your next exam is coming up.
        </h1>
        <p
          className="mt-4 max-w-[640px] mx-auto text-[16px] sm:text-[18px]"
          style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
        >
          Get ahead of the curve with a Study Pass.
        </p>
      </section>

      {/* Single-column centered checkout */}
      <section className="px-4 sm:px-6 pb-16 relative">
        <div className="max-w-[560px] mx-auto relative">
          <div
            className="rounded-2xl p-5 sm:p-6 relative z-10"
            style={{
              background: "#fff",
              boxShadow: "0 24px 60px rgba(20,33,61,0.10), 0 2px 8px rgba(20,33,61,0.04)",
              border: "1px solid #E0E7F0",
            }}
          >
            <style>{`
              @keyframes pricePulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
              }
              @keyframes priceToast {
                0% { opacity: 0; transform: translate(-50%, 0); }
                15% { opacity: 1; }
                100% { opacity: 0; transform: translate(-50%, -36px); }
              }
              @keyframes priceToastFade {
                0%, 100% { opacity: 0; }
                30%, 70% { opacity: 1; }
              }
              @keyframes priceShimmerOnce {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
              .price-shimmer {
                background-image: linear-gradient(100deg, ${NAVY} 0%, ${NAVY} 42%, rgba(255,255,255,0.5) 50%, ${NAVY} 58%, ${NAVY} 100%);
                background-size: 200% 100%;
                background-position: 200% 0;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                color: transparent;
                animation: priceShimmerOnce 1.4s ease-out 0.3s 1 forwards;
              }
              .price-shimmer-discount {
                background-image: linear-gradient(100deg, #16A34A 0%, #16A34A 42%, rgba(255,255,255,0.5) 50%, #16A34A 58%, #16A34A 100%);
                background-size: 200% 100%;
                background-position: 200% 0;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                color: transparent;
                animation: priceShimmerOnce 1.4s ease-out 0.3s 1 forwards;
              }
              .price-shimmer.shimmer-done, .price-shimmer-discount.shimmer-done {
                animation: none;
                -webkit-text-fill-color: currentColor;
                color: ${NAVY};
                background-image: none;
              }
              .price-shimmer-discount.shimmer-done {
                color: #16A34A;
              }
              @media (prefers-reduced-motion: reduce) {
                .price-shimmer, .price-shimmer-discount { animation: none; -webkit-text-fill-color: currentColor; color: ${NAVY}; background-image: none; }
                .price-shimmer-discount { color: #16A34A; }
              }
            `}</style>

            {/* Header row — Secure Checkout + Price Badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2
                  className="text-[24px] sm:text-[28px] leading-tight"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
                >
                  Secure Checkout
                </h2>
                <p
                  className="mt-1 text-[12px] flex items-center gap-1"
                  style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                >
                  Powered by{" "}
                  <span
                    className="font-semibold"
                    style={{
                      color: "#635BFF",
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Stripe
                  </span>
                </p>
              </div>

              {/* Price badge inside card, top-right */}
              <div className="flex flex-col items-end shrink-0">
                <div
                  key={`pulse-${pulseKey}`}
                  className="relative rounded-2xl px-4 py-2.5 flex flex-col items-center justify-center animate-[pricePulse_400ms_ease-out] motion-reduce:animate-none"
                  style={{
                    background: "#F0F6FF",
                    border: `1px solid ${NAVY}`,
                    boxShadow: "0 8px 20px rgba(20,33,61,0.12), 0 2px 6px rgba(20,33,61,0.05)",
                    minWidth: 124,
                    transform: "translateY(-3px)",
                  }}
                >
                  {hasDiscount && (
                    <div
                      className="text-[12px] line-through leading-none mb-0.5"
                      style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                    >
                      ${subtotal}
                    </div>
                  )}
                  <div
                    key={`shimmer-${totalPrice}`}
                    className={`font-bold leading-none shimmer-done ${hasDiscount ? "price-shimmer-discount" : "price-shimmer"}`}
                    style={{
                      fontSize: 44,
                      letterSpacing: "-0.03em",
                      fontFamily: "Inter, sans-serif",
                    }}
                    ref={(el) => {
                      if (!el) return;
                      // Remove shimmer-done so animation runs, then re-add after it completes
                      el.classList.remove("shimmer-done");
                      const t = setTimeout(() => el.classList.add("shimmer-done"), 1750);
                      // store timeout on element for cleanup
                      (el as any)._shimmerTimeout && clearTimeout((el as any)._shimmerTimeout);
                      (el as any)._shimmerTimeout = t;
                    }}
                  >
                    ${totalPrice}
                  </div>
                  <div
                    className="mt-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
                  >
                    one-time payment
                  </div>

                  {/* Floating positive delta toasts only */}
                  {priceToasts.map((t) => (
                    <span
                      key={t.id}
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 text-[15px] font-bold animate-[priceToast_1100ms_ease-out_forwards] motion-reduce:animate-[priceToastFade_900ms_ease-out_forwards]"
                      style={{
                        color: "#16A34A",
                        fontFamily: "Inter, sans-serif",
                        textShadow: "0 1px 3px rgba(255,255,255,0.9)",
                      }}
                    >
                      +${t.delta}
                    </span>
                  ))}
                </div>

                {/* Promo code area under badge */}
                <div className="mt-2 flex flex-col items-end" style={{ minWidth: 120 }}>
                  {hasDiscount ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "#16A34A", fontFamily: "Inter, sans-serif" }}
                      >
                        {appliedPromo!.code} applied
                      </span>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-[10px] underline hover:no-underline"
                        style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : promoOpen ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value); setPromoError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleApplyPromo(); }}
                          placeholder="Code"
                          className="rounded-md px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-[#14213D]/20"
                          style={{
                            border: "1px solid #CBD5E1",
                            width: 90,
                            fontFamily: "Inter, sans-serif",
                            color: NAVY,
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110"
                          style={{ background: NAVY, fontFamily: "Inter, sans-serif" }}
                        >
                          Apply
                        </button>
                      </div>
                      {promoError && (
                        <span
                          className="text-[10px]"
                          style={{ color: RED, fontFamily: "Inter, sans-serif" }}
                        >
                          {promoError}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPromoOpen(true)}
                      className="text-[11px] underline hover:no-underline"
                      style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                    >
                      Promo code?
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Product section */}
            <div className="mt-2" style={{ fontFamily: "Inter, sans-serif" }}>
              <div
                className="text-[16px] font-semibold"
                style={{ color: NAVY }}
              >
                Survive Study Pass
              </div>
              {email.trim() && (
                <p
                  className="mt-0.5 text-[12px]"
                  style={{ color: "#94A3B8" }}
                >
                  Email: <span style={{ color: "#64748B" }}>{email.trim()}</span>
                </p>
              )}
              <p
                className="mt-0.5 text-[12px]"
                style={{ color: "#94A3B8" }}
              >
                🔒 One account per student
              </p>
            </div>

            {/* Access Period — compact inline upsell */}
            <div className="mt-5" style={{ fontFamily: "Inter, sans-serif" }}>
              <div
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "#64748B" }}
              >
                Access Period
              </div>
              <div className="mt-0.5 flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-1.5">
                <div
                  className="text-[16px] font-semibold"
                  style={{ color: NAVY }}
                >
                  {selectedSemesters.map((s) => s.label).join(" · ")}
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#14213D]"
                  />
                  <span className="text-[13px]" style={{ color: NAVY }}>
                    Continue next semester —{" "}
                    <span style={{ color: "#16A34A", fontWeight: 600 }}>
                      save ${AUTO_RENEW_DISCOUNT}
                    </span>
                  </span>
                </label>
              </div>
              {autoRenew && (
                <p
                  className="mt-1 text-[11px] sm:pl-0"
                  style={{ color: "#94A3B8" }}
                >
                  We'll remind you before billing
                </p>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="mt-4 w-full rounded-xl py-3.5 text-[16px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                fontFamily: "Inter, sans-serif",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(206,17,38,0.35)",
              }}
            >
              {checkoutLoading ? (
                "Redirecting to secure checkout..."
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Buy Access <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            {checkoutError && (
              <div
                className="mt-2 text-[12px] text-center"
                style={{ color: RED, fontFamily: "Inter, sans-serif" }}
              >
                {checkoutError}
              </div>
            )}

            {/* Trust block */}
            <div
              className="mt-4 flex flex-col items-center gap-1.5 text-[12px]"
              style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                7-day refund guarantee
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Instant access after purchase
              </div>
            </div>
          </div>
        </div>
      </section>

      <StagingTestimonialsSection onCtaClick={() => navigate("/staging")} />

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />
    </div>
  );
}
