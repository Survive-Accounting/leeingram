import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sword, PenLine, MonitorPlay, ShieldCheck, X, Sparkles, ShoppingCart, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import { supabase } from "@/integrations/supabase/client";
import { useEmailGate } from "@/contexts/EmailGateContext";
import {
  getCampusProgression,
  resolveCourseSlug,
  formatCourseLabel,
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

const INCLUDES = [
  {
    icon: Sword,
    label: "Study Tools",
    body: "Flashcards, formulas, journal entries — built for late-night cramming.",
  },
  {
    icon: PenLine,
    label: "Practice Problems",
    body: "Mock textbook problems with AI-assisted explanations.",
  },
  {
    icon: MonitorPlay,
    label: "On-Demand Videos",
    body: "Send Lee a question — get a personalized video response.",
    isNew: true,
  },
];

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
  const courseLabel = formatCourseLabel(resolvedCourse);

  // Index of the resolved course in the campus progression.
  const startIdx = progression.courses.findIndex((c) => c.slug === resolvedCourseSlug);

  // How many ADDITIONAL courses are stacked on top of the base course.
  // 0 = just the resolved course; 1 = + next course; up to maxAdditional.
  const maxAdditional = Math.max(0, progression.courses.length - 1 - startIdx);
  const [extraCount, setExtraCount] = useState(0);
  const [lifetimeUpgrade, setLifetimeUpgrade] = useState(false);
  const [includesOpen, setIncludesOpen] = useState(false);

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

      {/* Two-column layout: checkout LEFT (first on mobile), includes RIGHT */}
      <section className="px-4 sm:px-6 pb-16 relative">
        <div className="max-w-[1100px] mx-auto relative grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10 items-start">
          {/* Soft tinted backdrop behind checkout column (desktop only) */}
          <div
            aria-hidden
            className="hidden md:block absolute inset-y-0 pointer-events-none rounded-2xl"
            style={{
              left: "-24px",
              width: "calc(60% + 12px)",
              background: "#F1F5F9",
              opacity: 0.7,
            }}
          />
          {/* Soft gradient divider between columns */}
          <div
            aria-hidden
            className="hidden md:block absolute inset-y-6 pointer-events-none"
            style={{
              left: "calc(60% + 4px)",
              width: 1,
              background:
                "linear-gradient(180deg, rgba(20,33,61,0) 0%, rgba(20,33,61,0.10) 50%, rgba(20,33,61,0) 100%)",
            }}
          />
          {/* LEFT — Checkout (visually dominant) */}
          <div
            className="md:col-span-3 order-1 rounded-2xl p-6 sm:p-8 relative z-10"
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

            {/* Single compact product block — price-led, minimal labels */}
            <div className="mb-4">
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
                    <div
                      className="mt-1.5 text-[13px] truncate"
                      style={{ color: "#64748B" }}
                    >
                      {selectedCourses.map(({ course }) => course.code ?? course.name).join(" → ")}
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

                {/* Removable extras (chips) — only shown when there's something removable */}
                {selectedCourses.some(({ idx }, arrIdx) => arrIdx === selectedCourses.length - 1 && idx > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {selectedCourses.map(({ course, idx }, arrIdx) => {
                      const isLast = arrIdx === selectedCourses.length - 1;
                      const isRemovable = isLast && idx > 0;
                      if (!isRemovable) return null;
                      return (
                        <span
                          key={course.slug}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold animate-fade-in"
                          style={{
                            background: "#fff",
                            border: "1px solid #CBD5E1",
                            color: NAVY,
                          }}
                        >
                          {course.code ?? course.name}
                          <button
                            type="button"
                            aria-label={`Remove ${course.code ?? course.name}`}
                            onClick={() => setExtraCount((c) => Math.max(0, c - 1))}
                            className="rounded-full hover:bg-slate-100 transition-colors p-0.5"
                            style={{ color: "#94A3B8" }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Add semester checkbox(es) */}
            {canAddAnother && (() => {
              const isFirstAdd = extraCount === 0;
              const label = isFirstAdd ? "Add next semester" : "Add another semester";
              const subtext = isFirstAdd
                ? "Continue your sequence"
                : "Keep your access going";
              return (
                <label
                  className="flex items-start gap-3 mb-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-slate-50"
                  style={{
                    border: "1px solid #E2E8F0",
                    background: "#fff",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => setExtraCount((c) => Math.min(c + 1, maxAdditional))}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#14213D]"
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: NAVY }}>
                      {label}
                      <span style={{ color: "#64748B", fontWeight: 500 }}> (+${EXTEND_PRICE})</span>
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "#94A3B8" }}>
                      {subtext}
                    </div>
                  </div>
                </label>
              );
            })()}

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

          {/* RIGHT — What's included (minimal collapsible) */}
          <div className="md:col-span-2 order-2 relative z-10 px-2 sm:px-4 pt-2">
            <div
              className="text-[14px]"
              style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
            >
              Includes tools for every chapter in your course
            </div>
            <button
              type="button"
              onClick={() => setIncludesOpen((o) => !o)}
              className="mt-2 text-[13px] inline-flex items-center gap-1 hover:underline"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              aria-expanded={includesOpen}
            >
              See what's included
              <span
                className="inline-block transition-transform duration-200"
                style={{ transform: includesOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                ↓
              </span>
            </button>

            <div
              className="grid transition-all duration-300 ease-out"
              style={{
                gridTemplateRows: includesOpen ? "1fr" : "0fr",
                opacity: includesOpen ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <ul className="mt-4 flex flex-col gap-3">
                  {INCLUDES.map(({ icon: Icon, label, body, isNew }) => (
                    <li key={label} className="flex gap-3">
                      <div
                        className="shrink-0 rounded-lg flex items-center justify-center"
                        style={{ width: 32, height: 32, background: "#F1F5F9" }}
                      >
                        <Icon size={16} color={NAVY} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                          >
                            {label}
                          </span>
                          {isNew && (
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: RED, color: "#fff" }}
                            >
                              New
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[12px] mt-0.5 leading-snug"
                          style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
                        >
                          {body}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className="mt-5 text-[11.5px] leading-relaxed"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              Built and maintained by Lee Ingram, Ole Miss accounting tutor since 2015.
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
