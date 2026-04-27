import React, { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ShieldCheck, X, Sparkles, ShoppingCart, ChevronDown } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { supabase } from "@/integrations/supabase/client";
import { useEmailGate } from "@/contexts/EmailGateContext";
import AliasTestingBanner from "@/components/AliasTestingBanner";

// Below-the-fold — lazy load to shrink initial bundle
const StagingTestimonialsSection = lazy(() => import("@/components/landing/StagingTestimonialsSection"));

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

const PRICE = 150;
const AUTO_RENEW_DISCOUNT_USD = 25; // Flat $25 off when auto-renew is enabled
const EXTEND_PRICE = 100;
const LIFETIME_UPGRADE_PRICE = 150;
const MAX_EXTRA_SEMESTERS = 3; // 4 total including base

// Demo promo codes — replace with server-validated codes later.
const VALID_PROMOS: Record<string, { type: "percent" | "flat"; value: number }> = {
  STUDY10: { type: "percent", value: 10 },
  WELCOME20: { type: "percent", value: 20 },
  FRIEND25: { type: "flat", value: 25 },
  SURVIVE50: { type: "flat", value: 50 },
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

function getFoundingTierCopy(n: number): string {
  if (n <= 1) return "As a thank you — you get free access.";
  if (n <= 5) return "As a thank you — you get access for $25.";
  if (n <= 10) return "As a thank you — you get access for $50.";
  if (n <= 25) return "You're in early — access is $100.";
  if (n <= 50) return "You're in early — access is $125.";
  if (n <= 100) return "Access is $150 for your campus.";
  if (n <= 200) return "Access is $175 for your campus.";
  return "Access is $250 for your campus.";
}

export default function GetAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const campusParam = searchParams.get("campus") || "";
  const courseParam = searchParams.get("course") || "";
  const studentNumberParam = searchParams.get("n");
  const studentNumber = studentNumberParam ? parseInt(studentNumberParam, 10) : null;
  const [campusName, setCampusName] = useState<string | null>(null);
  const [problemCount, setProblemCount] = useState<number | null>(null);

  useEffect(() => {
    if (!campusParam) {
      setCampusName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("campuses")
        .select("name")
        .eq("slug", campusParam)
        .maybeSingle();
      if (!cancelled) setCampusName(data?.name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [campusParam]);

  useEffect(() => {
    if (!courseParam) {
      setProblemCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("slug", courseParam)
        .maybeSingle();
      if (!course?.id || cancelled) return;
      const { count } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course.id);
      if (!cancelled && typeof count === "number") setProblemCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [courseParam]);

  const problemCountLabel = useMemo(() => {
    const n = problemCount ?? 0;
    if (n < 50) return "200+";
    // Round DOWN to nearest 25 below 200, nearest 50 above
    const step = n >= 200 ? 100 : n >= 100 ? 50 : 25;
    const rounded = Math.floor(n / step) * step;
    return `${rounded}+`;
  }, [problemCount]);

  const [extraCount, setExtraCount] = useState(0);
  const [lifetimeUpgrade, setLifetimeUpgrade] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [planAheadOpen, setPlanAheadOpen] = useState(false);

  const totalSemesters = 1 + extraCount;
  const allSemestersAdded = extraCount >= MAX_EXTRA_SEMESTERS;
  const showLifetime = extraCount >= 3;
  const showSavingsHint = extraCount >= 2;

  // Auto-renew gives a flat $25 off the base price (only when no extra semesters added)
  const autoRenewActive = autoRenew && extraCount === 0;
  const baseBeforeDiscount = PRICE + extraCount * EXTEND_PRICE;
  const autoRenewSavings = autoRenewActive ? AUTO_RENEW_DISCOUNT_USD : 0;
  const baseTotal = baseBeforeDiscount - autoRenewSavings;
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
  const [discountToasts, setDiscountToasts] = useState<Array<{ id: number; amount: number }>>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const prevSubtotalRef = React.useRef(subtotal);
  const skipNextToastRef = React.useRef(false);

  useEffect(() => {
    const prev = prevSubtotalRef.current;
    if (prev !== subtotal) {
      const delta = subtotal - prev;
      const skip = skipNextToastRef.current;
      skipNextToastRef.current = false;
      if (delta > 0 && !skip) {
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
  const [earlyBirdOptIn, setEarlyBirdOptIn] = useState(false);

  const handleClaimBeta = async () => {
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
      const { data, error } = await supabase.functions.invoke("claim-free-beta", {
        body: {
          email: cleanEmail,
          campus: campusParam || null,
          course: courseParam || null,
          earlyBirdOptIn,
          origin: window.location.origin,
        },
      });
      if (error) throw error;
      const magicLink = (data as { magicLink?: string | null } | null)?.magicLink || null;
      if (magicLink) {
        // Magic link → /auth/callback → /my-dashboard?free_beta=1 (signed in)
        window.location.href = magicLink;
      } else {
        // Fallback if magic link generation failed — go to dashboard (will prompt login)
        navigate("/my-dashboard?free_beta=1");
      }
    } catch (err) {
      console.error("[claim-free-beta]", err);
      setCheckoutError(
        "We couldn't set up your beta access. Please try again in a moment.",
      );
      setCheckoutLoading(false);
    }
  };

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
            campus: campusParam || "ole-miss",
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

      // Stripe Checkout sets X-Frame-Options: DENY, so we must navigate the
      // top-level window. Inside cross-origin iframes (Lovable preview, embeds)
      // assigning window.top.location throws SecurityError — in that case open
      // checkout in a new tab as a guaranteed fallback. On the live site the
      // top-level assignment succeeds and the user is redirected normally.
      const inIframe = window.top && window.top !== window.self;
      let navigated = false;

      if (inIframe) {
        try {
          // Try same-tab top-level navigation (works for same-origin embeds).
          (window.top as Window).location.href = url;
          navigated = true;
        } catch {
          // Cross-origin parent — fall through to new tab.
        }
      } else {
        window.location.href = url;
        navigated = true;
      }

      if (!navigated) {
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          // Popup blocked — last resort, try same-tab in current frame.
          window.location.href = url;
        }
        // Reset the button so the user isn't stuck on "Redirecting…" in the
        // original tab while completing checkout in the new one.
        setCheckoutLoading(false);
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

      {/* Alias-mode debug banner (lee+xxx@survivestudios.com only) */}
      {email && (
        <div className="px-4 sm:px-6 pt-3 flex justify-center">
          <AliasTestingBanner email={email} />
        </div>
      )}

      {/* Founding-student celebration banner (top of checkout) */}
      {studentNumber != null && campusName && campusParam !== "ole-miss" && (
        <section className="px-4 sm:px-6 pt-8">
          <div
            className="max-w-[560px] mx-auto rounded-2xl px-5 py-4 text-center"
            style={{
              background: "linear-gradient(135deg, #FFF8E7 0%, #FFEFC4 100%)",
              border: "1px solid #F4D58D",
              boxShadow: "0 8px 24px rgba(206,17,38,0.08)",
            }}
          >
            <div className="text-2xl mb-1" aria-hidden="true">🎉</div>
            <div
              className="text-[18px] sm:text-[20px] leading-tight"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              You're student #{studentNumber} from {campusName}!
            </div>
            <div
              className="mt-1 text-[13px] sm:text-[14px]"
              style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
            >
              {getFoundingTierCopy(studentNumber)}
            </div>
          </div>
        </section>
      )}

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-12 md:pt-20 pb-8 text-center relative">
        <h1
          className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Your exam is coming up.
        </h1>
        <p
          className="mt-4 max-w-[640px] mx-auto text-[16px] sm:text-[18px]"
          style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
        >
          Join the free beta and get access through your Spring &rsquo;26 final exams.
        </p>
        <p
          className="mt-2 max-w-[640px] mx-auto text-[13px]"
          style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
        >
          Regular semester access will be $250 after beta.
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

            {/* Header row — Free Beta + Price Badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider mb-2"
                  style={{
                    background: "#FEF2F2",
                    color: RED,
                    border: "1px solid #FECACA",
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.06em",
                  }}
                >
                  FREE BETA
                </span>
                <h2
                  className="text-[24px] sm:text-[28px] leading-tight"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
                >
                  Create Your Free Beta Pass
                </h2>
              </div>

              {/* Price badge inside card, top-right */}
              <div className="flex flex-col items-end shrink-0">
                <div
                  className="relative rounded-2xl px-5 py-3.5 flex flex-col items-center justify-center"
                  style={{
                    background: "#F0F6FF",
                    border: `1px solid ${NAVY}`,
                    boxShadow: "0 12px 28px rgba(20,33,61,0.16), 0 4px 10px rgba(20,33,61,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                    minWidth: 132,
                    transform: "translateY(-3px)",
                  }}
                >
                  <div
                    className="font-bold leading-none price-shimmer"
                    style={{
                      fontSize: 44,
                      letterSpacing: "-0.03em",
                      fontFamily: "Inter, sans-serif",
                      color: NAVY,
                    }}
                    ref={(el) => {
                      if (!el) return;
                      el.classList.remove("shimmer-done");
                      const t = setTimeout(() => el.classList.add("shimmer-done"), 1750);
                      (el as any)._shimmerTimeout && clearTimeout((el as any)._shimmerTimeout);
                      (el as any)._shimmerTimeout = t;
                    }}
                  >
                    $0
                  </div>
                  <div
                    className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-center"
                    style={{ color: RED, fontFamily: "Inter, sans-serif", letterSpacing: "0.08em" }}
                  >
                    Free Beta Access
                  </div>
                </div>
                <div
                  className="mt-2 text-[11px]"
                  style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
                >
                  Regularly{" "}
                  <span style={{ textDecoration: "line-through" }}>$250</span>
                  {" "}/ semester
                </div>
              </div>
            </div>

            {/* Product section */}
            <div className="mt-2" style={{ fontFamily: "Inter, sans-serif" }}>
              <div
                className="text-[16px] font-semibold leading-tight"
                style={{ color: NAVY }}
              >
                Survive Study Pass
              </div>
              {email.trim() && (
                <p
                  className="mt-0.5 text-[12px] leading-tight"
                  style={{ color: "#94A3B8" }}
                >
                  Email: <span style={{ color: "#64748B" }}>{email.trim()}</span>
                </p>
              )}
              <p
                className="mt-1 text-[11px] leading-tight"
                style={{ color: "#B4BFCC" }}
              >
                🔒 One account per student
              </p>
            </div>

            {/* Access Period — compact inline upsell */}
            <div
              className="mt-7 pt-5 border-t"
              style={{ fontFamily: "Inter, sans-serif", borderColor: "#EEF1F5" }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: "#94A3B8" }}
              >
                Access
              </div>
              <div
                className="mt-1 text-[15px] font-semibold leading-tight"
                style={{ color: NAVY }}
              >
                Full access through your Spring '26 exams
              </div>
              <div
                className="mt-1 text-[12px] leading-snug"
                style={{ color: "#64748B" }}
              >
                Use it as much as you want until your exams are over.
              </div>
              <label className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoRenew(checked);
                    if (checked && extraCount === 0) {
                      const id = Date.now() + Math.random();
                      const amount = AUTO_RENEW_DISCOUNT_USD;
                      setDiscountToasts((t) => [...t, { id, amount }]);
                      setPulseKey((k) => k + 1);
                      setTimeout(() => {
                        setDiscountToasts((t) => t.filter((x) => x.id !== id));
                      }, 800);
                    } else if (!checked && extraCount === 0) {
                      // Suppress the +$ toast when restoring price after uncheck
                      skipNextToastRef.current = true;
                    }
                  }}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#14213D]"
                />
                <span className="text-[13px] leading-none" style={{ color: "#475569" }}>
                  Continue next semester{" "}
                  <span style={{ color: "#16A34A", fontWeight: 600 }}>
                    (save ${AUTO_RENEW_DISCOUNT_USD})
                  </span>
                </span>
              </label>
              {autoRenew && (
                <p
                  className="mt-1 text-[11px] leading-tight"
                  style={{ color: "#94A3B8" }}
                >
                  We'll remind you before your next term begins.
                </p>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="mt-5 w-full rounded-xl py-4 text-[17px] font-bold tracking-tight text-white transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                fontFamily: "Inter, sans-serif",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 32px rgba(206,17,38,0.42), 0 4px 10px rgba(206,17,38,0.25)",
              }}
            >
              {checkoutLoading ? (
                <>
                  <svg
                    className="w-[18px] h-[18px] animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Redirecting to secure checkout...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-[18px] h-[18px]" />
                  Get Access <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            {checkoutError && (
              <div
                className="mt-2 text-[12px] text-center"
                style={{ color: RED, fontFamily: "Inter, sans-serif" }}
              >
                Hmm, something went wrong on our end. Please try again, or{" "}
                <a
                  href="mailto:lee@surviveaccounting.com?subject=Checkout%20issue%20on%20Survive%20Study%20Pass"
                  className="underline font-semibold hover:no-underline"
                  style={{ color: RED }}
                >
                  contact lee@surviveaccounting.com
                </a>{" "}
                for help.
              </div>
            )}

            {/* Trust block */}
            <div
              className="mt-4 flex items-center justify-center gap-1.5 text-[12px]"
              style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              7-day refund guarantee • Instant access
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <StagingTestimonialsSection onCtaClick={() => navigate("/staging")} />
      </Suspense>

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />
    </div>
  );
}
