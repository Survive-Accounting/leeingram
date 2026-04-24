import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ShieldCheck, X, Sparkles, ShoppingCart, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import { supabase } from "@/integrations/supabase/client";
import { useEmailGate } from "@/contexts/EmailGateContext";
import {
  getCampusProgression,
  resolveCourseSlug,
  type CourseSlug,
} from "@/lib/campusProgressions";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

const PRICE = 99;
const EXTEND_PRICE = 50;
const LIFETIME_UPGRADE_PRICE = 100;

/**
 * Returns a season+year label for the Nth semester from now.
 * stepsAhead = 0 → current semester (e.g., "Spring 2026")
 */
function getSeasonLabel(stepsAhead: number): string {
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
  return `${isFirstHalf ? "Spring" : "Fall"} ${year}`;
}

/**
 * Returns the access end date for the Nth semester from now.
 * Semesters run Jan 1 → Jun 30 and Jul 1 → Dec 31.
 * stepsAhead = 0 → current semester end, 1 → next semester end, etc.
 * Format: "Jun 30, 2026"
 */
function getAccessEndDate(stepsAhead: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let isFirstHalf = now.getMonth() < 6; // true → ends Jun 30 of `year`

  for (let i = 0; i < stepsAhead; i++) {
    if (isFirstHalf) {
      isFirstHalf = false; // now ends Dec 31 same year
    } else {
      isFirstHalf = true;
      year += 1; // wraps to Jun 30 next year
    }
  }

  const endMonth = isFirstHalf ? 5 : 11;
  const endDay = isFirstHalf ? 30 : 31;
  const monthName = new Date(2000, endMonth, 1).toLocaleString("en-US", { month: "short" });
  return `${monthName} ${endDay}, ${year}`;
}


export default function GetAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const campusParam = (searchParams.get("campus") || "").toLowerCase();
  const courseParam = (searchParams.get("course") || "").toLowerCase();
  const emailParam = searchParams.get("email") || "";

  const effectiveCampus = campusParam || "ole-miss";
  const progression = useMemo(() => getCampusProgression(effectiveCampus), [effectiveCampus]);
  const isOleMiss = progression.campusSlug === "ole-miss";

  const resolvedCourseSlug = useMemo<CourseSlug>(
    () => resolveCourseSlug(progression, courseParam),
    [progression, courseParam],
  );

  const campusName = progression.campusName;
  const resolvedCourse = progression.courses.find((c) => c.slug === resolvedCourseSlug)!;
  const courseCode = resolvedCourse.code;
  

  // Index of the resolved course in the campus progression.
  const urlStartIdx = progression.courses.findIndex((c) => c.slug === resolvedCourseSlug);
  const [startIdxOverride, setStartIdxOverride] = useState<number | null>(null);
  const startIdx = startIdxOverride ?? urlStartIdx;

  // How many ADDITIONAL courses are stacked on top of the base course.
  // 0 = just the resolved course; 1 = + next course; up to maxAdditional.
  const maxAdditional = Math.max(0, progression.courses.length - 1 - startIdx);
  const [extraCount, setExtraCount] = useState(0);
  const [lifetimeUpgrade, setLifetimeUpgrade] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const effectiveCourseSlug = progression.courses[startIdx]?.slug ?? resolvedCourseSlug;
  const effectiveCourseCode = progression.courses[startIdx]?.code ?? courseCode;
  

  // The full list of selected courses (base + extras).
  const selectedCourses = useMemo(() => {
    const list = [];
    for (let i = 0; i <= extraCount; i++) {
      const course = progression.courses[startIdx + i];
      if (course) list.push({ course, idx: i });
    }
    return list;
  }, [progression.courses, startIdx, extraCount]);

  // All 4 semesters selected (base + 3 extras when starting at idx 0)?
  const allSemestersAdded = extraCount >= maxAdditional && maxAdditional >= 3;
  const showLifetime = allSemestersAdded;

  const baseTotal = PRICE + extraCount * EXTEND_PRICE;
  const totalPrice = baseTotal + (showLifetime && lifetimeUpgrade ? LIFETIME_UPGRADE_PRICE : 0);
  const addedAmount = totalPrice - PRICE;
  const canAddAnother = extraCount < maxAdditional;

  // Reset lifetime if user removes a semester and it's no longer offered.
  useEffect(() => {
    if (!showLifetime && lifetimeUpgrade) setLifetimeUpgrade(false);
  }, [showLifetime, lifetimeUpgrade]);

  // Access period label
  const accessPeriodLabel = extraCount === 0
    ? getSeasonLabel(0)
    : `${getSeasonLabel(0)} → ${getSeasonLabel(extraCount)}`;

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
      requestAccess({ course: resolvedCourseSlug });
      return;
    }
    try {
      localStorage.setItem("student_email", cleanEmail);
      sessionStorage.setItem("student_email", cleanEmail);
    } catch { /* ignore */ }

    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const includedCourses = selectedCourses.map(
        ({ course }) => course.code ?? course.name,
      );
      const { data, error } = await supabase.functions.invoke(
        "create-get-access-checkout",
        {
          body: {
            email: cleanEmail,
            campus: progression.campusSlug,
            selectedCourse: resolvedCourseSlug,
            selectedPlan: "study_pass",
            amount: totalPrice,
            includedCourses,
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_GRADIENT }}>
      <StagingNavbar
        onCtaClick={() => navigate("/staging")}
        onPricingClick={() => {}}
      />

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-12 md:pt-20 pb-8 text-center relative">
        {isOleMiss && (
          <div
            aria-hidden
            className="absolute top-0 left-1/2 -translate-x-1/2 h-1 rounded-b-full"
            style={{
              width: 120,
              background: `linear-gradient(90deg, #A6CCE2 0%, ${NAVY} 50%, ${RED} 100%)`,
              opacity: 0.85,
            }}
          />
        )}

        <div
          className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-[12px] font-semibold uppercase tracking-wider"
          style={{
            background: isOleMiss ? "rgba(166,204,226,0.22)" : "rgba(20,33,61,0.06)",
            color: NAVY,
            fontFamily: "Inter, sans-serif",
            border: isOleMiss ? "1px solid rgba(20,33,61,0.18)" : "1px dashed rgba(20,33,61,0.25)",
          }}
        >
          For {campusName}{courseCode ? ` ${courseCode}` : ""} students
        </div>

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
          Get study tools for your entire course—one payment, full semester access.
        </p>
      </section>

      {/* Single-column centered checkout */}
      <section className="px-4 sm:px-6 pb-16 relative">
        <div className="max-w-[640px] mx-auto relative">
          <div
            className="rounded-2xl p-6 sm:p-8 relative z-10"
            style={{
              background: "#fff",
              boxShadow: "0 16px 48px rgba(20,33,61,0.12), 0 2px 6px rgba(20,33,61,0.06)",
              border: "1px solid rgba(20,33,61,0.08)",
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

            {/* Single compact product block — price-led */}
            <div className="mb-5">
              <div
                className="rounded-lg px-5 py-4"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold" style={{ color: NAVY }}>
                      Semester Study Pass
                    </div>
                    <div className="mt-1 text-[12px]" style={{ color: "#94A3B8" }}>
                      {accessPeriodLabel}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                    <div
                      className="font-bold leading-none"
                      style={{ color: NAVY, fontSize: 36, letterSpacing: "-0.02em" }}
                    >
                      ${totalPrice}
                      <span className="ml-1 text-[13px] font-medium" style={{ color: "#64748B", letterSpacing: 0 }}>
                        total
                      </span>
                    </div>
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
              </div>
            </div>

            {/* Courses Included — grouped by sequence with pills */}
            <div
              className="mb-4 rounded-lg p-4"
              style={{
                border: "1px solid #E2E8F0",
                background: "#fff",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-[13px] font-semibold" style={{ color: NAVY }}>
                  Courses Included
                </div>
                {extraCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setExtraCount(0)}
                    className="text-[12px] hover:underline"
                    style={{ color: "#64748B" }}
                  >
                    Reset sequence
                  </button>
                )}
              </div>

              {(() => {
                const introSlugs = new Set(["intro-accounting-1", "intro-accounting-2"]);
                const intermediateSlugs = new Set(["intermediate-accounting-1", "intermediate-accounting-2"]);
                const introSelected = selectedCourses.filter(({ course }) => introSlugs.has(course.slug));
                const intermediateSelected = selectedCourses.filter(({ course }) => intermediateSlugs.has(course.slug));

                const renderRow = (
                  title: string,
                  rowItems: typeof selectedCourses,
                ) => {
                  if (rowItems.length === 0) return null;
                  return (
                    <div className="mb-2 last:mb-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#94A3B8" }}>
                        {title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rowItems.map(({ course, idx }) => {
                          const isBase = idx === 0;
                          const isLastAdded = idx === extraCount && extraCount > 0;
                          return (
                            <span
                              key={course.slug}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold animate-fade-in"
                              style={{
                                background: isBase ? "rgba(20,33,61,0.06)" : "#fff",
                                border: "1px solid #CBD5E1",
                                color: NAVY,
                              }}
                            >
                              {course.code ?? course.name}
                              {isLastAdded && (
                                <button
                                  type="button"
                                  aria-label={`Remove ${course.code ?? course.name}`}
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
                    </div>
                  );
                };

                return (
                  <>
                    {renderRow("Intro Sequence", introSelected)}
                    {renderRow("Intermediate Sequence", intermediateSelected)}
                  </>
                );
              })()}

              {canAddAnother && (
                <button
                  type="button"
                  onClick={() => setExtraCount((c) => Math.min(c + 1, maxAdditional))}
                  className="mt-3 w-full rounded-lg py-2 text-[13px] font-semibold transition-colors hover:bg-slate-50"
                  style={{
                    border: "1px dashed #CBD5E1",
                    color: NAVY,
                    background: "#fff",
                  }}
                >
                  + Add next course <span style={{ color: "#94A3B8", fontWeight: 500 }}>(+${EXTEND_PRICE})</span>
                </button>
              )}
            </div>

            {/* Lifetime upgrade — only when all semesters selected */}
            {showLifetime && (
              <label
                className="flex items-start gap-3 mb-3 p-3 rounded-lg cursor-pointer transition-all duration-200 animate-fade-in"
                style={{
                  border: lifetimeUpgrade ? `1px solid ${NAVY}` : "1px solid #E2E8F0",
                  background: lifetimeUpgrade ? "rgba(20,33,61,0.04)" : "#fff",
                  fontFamily: "Inter, sans-serif",
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
                    <span style={{ color: "#64748B", fontWeight: 500 }}> (+${LIFETIME_UPGRADE_PRICE})</span>
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "#94A3B8" }}>
                    Includes all future updates
                  </div>
                </div>
              </label>
            )}

            <div className="mb-3" />


            {/* Section 4 — CTA */}
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

            {/* Access period — moved BELOW the CTA */}
            <div
              key={`access-below-${extraCount}`}
              className="mt-4 flex items-center justify-center gap-1.5 text-[13px] animate-fade-in"
              style={{ color: "#334155", fontFamily: "Inter, sans-serif" }}
            >
              <span style={{ color: "#94A3B8" }}>Access:</span>
              <span className="font-semibold">{accessPeriodLabel}</span>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="Access period info">
                      <Info className="w-3 h-3" style={{ color: "#94A3B8" }} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-[12px]">
                    Always includes final exam week.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {showLifetime && lifetimeUpgrade && (
              <div
                className="mt-1 text-center text-[12px] animate-fade-in"
                style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
              >
                Includes all future updates
              </div>
            )}

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
      <TestimonialsSection />

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />
    </div>
  );
}
