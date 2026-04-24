import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ShieldCheck, X, Sparkles, ShoppingCart } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import StagingTestimonialsSection from "@/components/landing/StagingTestimonialsSection";
import { supabase } from "@/integrations/supabase/client";
import { useEmailGate } from "@/contexts/EmailGateContext";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

const PRICE = 99;
const EXTEND_PRICE = 50;
const LIFETIME_UPGRADE_PRICE = 100;
const MAX_EXTRA_SEMESTERS = 3; // 4 total including base

/**
 * Returns a short season+year label for the Nth semester from now.
 * stepsAhead = 0 → current semester (e.g., "Spring '26")
 */
function getShortSeasonLabel(stepsAhead: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let isFirstHalf = now.getMonth() < 6; // Spring if true, else Fall

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

  const totalSemesters = 1 + extraCount;
  const allSemestersAdded = extraCount >= MAX_EXTRA_SEMESTERS;
  const showLifetime = allSemestersAdded;

  const baseTotal = PRICE + extraCount * EXTEND_PRICE;
  const totalPrice = baseTotal + (showLifetime && lifetimeUpgrade ? LIFETIME_UPGRADE_PRICE : 0);
  const addedAmount = totalPrice - PRICE;

  // Reset lifetime if user removes a semester and it's no longer offered.
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

  // Resolve email: URL param → localStorage → sessionStorage.
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
            autoRenew: extraCount > 0,
            extraSemesters: extraCount,
            lifetimeUpgrade: showLifetime && lifetimeUpgrade,
            origin: window.location.origin,
          },
        },
      );
      if (error) throw error;
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error("Checkout URL missing from response");
      window.location.href = url;
    } catch (err) {
      console.error("[get-access checkout]", err);
      setCheckoutError(
        "We couldn't start checkout. Please try again in a moment.",
      );
      setCheckoutLoading(false);
    }
  };

  // Next semester to offer (the one immediately after the last selected).
  const nextSemesterLabel = !allSemestersAdded
    ? getShortSeasonLabel(totalSemesters)
    : null;

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
          Get study tools for your entire accounting course.
        </p>
      </section>

      {/* Single-column centered checkout */}
      <section className="px-4 sm:px-6 pb-16 relative">
        <div className="max-w-[560px] mx-auto relative">
          <div
            className="rounded-2xl p-6 sm:p-8 relative z-10"
            style={{
              background: "#fff",
              boxShadow: "0 24px 60px rgba(20,33,61,0.10), 0 2px 8px rgba(20,33,61,0.04)",
              border: "1px solid #E0E7F0",
            }}
          >
            <h2
              className="text-[24px] sm:text-[28px]"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Secure Checkout
            </h2>

            {email.trim() && (
              <p
                className="mt-1 text-[12px]"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                Purchasing for: <span style={{ color: "#64748B" }}>{email.trim()}</span>
              </p>
            )}
            <p
              className="mt-1 mb-6 text-[12px]"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              🔒 One account per student
            </p>

            {/* 1. Survive Study Pass — semester selection */}
            <div
              className="mb-5 rounded-lg p-4"
              style={{
                border: "1px solid #E2E8F0",
                background: "#fff",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <div className="text-[15px] font-semibold" style={{ color: NAVY }}>
                Survive Study Pass
              </div>
              <div
                className="mt-3 text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "#64748B" }}
              >
                Access Period
              </div>

              {/* Pills row — min-height keeps layout stable as pills wrap */}
              <div
                className="mt-2 flex flex-wrap items-center gap-1.5"
                style={{ minHeight: 36 }}
              >
                {selectedSemesters.map(({ idx, label }) => {
                  const isBase = idx === 0;
                  const isLastAdded = idx === extraCount && extraCount > 0;
                  return (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold animate-fade-in"
                      style={{
                        background: isBase ? "rgba(20,33,61,0.06)" : "#fff",
                        border: "1px solid #CBD5E1",
                        color: NAVY,
                      }}
                    >
                      {label}
                      {isLastAdded && (
                        <button
                          type="button"
                          aria-label={`Remove ${label}`}
                          onClick={() => setExtraCount((c) => Math.max(0, c - 1))}
                          className="rounded-full hover:bg-slate-100 transition-colors p-0.5"
                          style={{ color: "#94A3B8" }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              {/* Add-semester slot — becomes Lifetime upsell once all 4 semesters are added */}
              <div className="mt-3" style={{ minHeight: 40 }}>
                {nextSemesterLabel ? (
                  <button
                    type="button"
                    onClick={() => setExtraCount((c) => Math.min(c + 1, MAX_EXTRA_SEMESTERS))}
                    className="w-full rounded-lg py-2 text-[13px] font-semibold transition-colors hover:bg-slate-50 animate-fade-in"
                    style={{
                      border: "1px dashed #CBD5E1",
                      color: NAVY,
                      background: "#fff",
                    }}
                  >
                    + Add {nextSemesterLabel}{" "}
                    <span style={{ color: "#94A3B8", fontWeight: 500 }}>(+${EXTEND_PRICE})</span>
                  </button>
                ) : (
                  <label
                    className="flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all duration-200 animate-fade-in hover:brightness-[0.99]"
                    style={{
                      border: lifetimeUpgrade ? `2px solid ${NAVY}` : "2px solid #BFDBFE",
                      background: lifetimeUpgrade ? "#DBEAFE" : "#EFF6FF",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={lifetimeUpgrade}
                      onChange={(e) => setLifetimeUpgrade(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#14213D]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: NAVY }}>
                        <Sparkles className="w-3.5 h-3.5" />
                        Upgrade to Lifetime Access
                        <span style={{ color: "#1E40AF", fontWeight: 600 }}> (+${LIFETIME_UPGRADE_PRICE})</span>
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: "#475569" }}>
                        Never pay again. Includes all future semesters.
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* 2. Pricing — directly above CTA */}
            <div
              className="mb-3 flex flex-col items-center text-center"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <div
                className="font-bold leading-none"
                style={{ color: NAVY, fontSize: 40, letterSpacing: "-0.02em" }}
              >
                ${totalPrice}
                <span className="ml-1.5 text-[14px] font-medium" style={{ color: "#64748B", letterSpacing: 0 }}>
                  total
                </span>
              </div>
              <div className="mt-1.5 text-[12px]" style={{ color: "#94A3B8" }}>
                One-time payment
              </div>
              {/* Reserve fixed space so CTA never shifts */}
              <div style={{ minHeight: 18 }} className="mt-1">
                {addedAmount > 0 && (
                  <div
                    key={`added-${addedAmount}`}
                    className="text-[12px] font-semibold animate-fade-in"
                    style={{ color: "#16A34A" }}
                  >
                    +${addedAmount} added
                  </div>
                )}
              </div>
            </div>

            {/* 3. CTA */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full rounded-xl py-4 text-[16px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  Buy Study Pass <span aria-hidden="true">→</span>
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

            {/* 5. Trust block — only two lines */}
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

      {/* Testimonials below the checkout — same widget as home page */}
      <StagingTestimonialsSection onCtaClick={() => navigate("/staging")} />

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />
    </div>
  );
}
