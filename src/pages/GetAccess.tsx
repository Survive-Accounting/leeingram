import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sword, PenLine, MonitorPlay, ShieldCheck, ChevronDown, Sparkles, Infinity as InfinityIcon } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { supabase } from "@/integrations/supabase/client";
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


/**
 * Progressive access tiers — fixed pricing, dynamic course labels.
 *
 * `coursesAhead` = how many additional courses (after the current one)
 * are bundled into the tier. The tier is only available if the campus
 * progression has enough remaining courses.
 */
type TierId = "current" | "next1" | "next2" | "full" | "lifetime";

const LIFETIME_PRICE = 850;

interface AccessTier {
  id: TierId;
  title: string;
  price: number;
  coursesAhead: number;
  badge?: string;
}

const ACCESS_TIERS: AccessTier[] = [
  { id: "current", title: "Current Course",  price: 150, coursesAhead: 0 },
  { id: "next1",   title: "Next Course",     price: 250, coursesAhead: 1 },
  { id: "next2",   title: "Stay Covered",    price: 325, coursesAhead: 2 },
  { id: "full",    title: "Full Sequence",   price: 475, coursesAhead: 3, badge: "Best value" },
];

const INCLUDES = [
  { icon: Sword, label: "Survival Tools", body: "Flashcards, formulas, journal entries — built for late-night cramming." },
  { icon: PenLine, label: "Practice Problems", body: "Hundreds of problems with Lee's step-by-step explanations." },
  { icon: MonitorPlay, label: "On-Demand Videos", body: "Lee's full video library, 24/7 — request what's not there." },
  { icon: ShieldCheck, label: "7-Day Guarantee", body: "If it doesn't help you study smarter, get a full refund." },
];

export default function GetAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const campusParam = (searchParams.get("campus") || "").toLowerCase();
  const courseParam = (searchParams.get("course") || "").toLowerCase();
  const emailParam = searchParams.get("email") || "";

  // Default to Ole Miss when no (or unknown) campus is provided.
  // The progression module decides which course list + codes to use.
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

  const [course, setCourse] = useState<CourseSlug>(resolvedCourseSlug);
  const [tier, setTier] = useState<TierId>("current");
  const [email, setEmail] = useState(emailParam);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowStickyBar(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * Build per-tier display data given the currently selected course.
   * Tiers that would extend beyond the campus progression are dropped.
   */
  const tiers = useMemo(() => {
    const courses = progression.courses;
    const startIdx = courses.findIndex((c) => c.slug === course);
    const remaining = startIdx === -1 ? 0 : courses.length - startIdx - 1;

    return ACCESS_TIERS.filter((t) => t.coursesAhead <= remaining).map((t) => {
      const span = courses.slice(startIdx, startIdx + 1 + t.coursesAhead);
      const labels = span.map((c) => c.code ?? c.name);
      const subtext =
        t.id === "current"
          ? "Access through August 31"
          : t.id === "full"
          ? "All accounting courses"
          : t.coursesAhead === 1
          ? `${labels[0]} + ${labels[1]}`
          : labels.join(" → ");
      return { ...t, subtext };
    });
  }, [progression, course]);

  // Fall back to the first available tier if the previously selected one
  // is no longer valid (e.g. user picked the last course in the sequence).
  const selectedTier = tiers.find((t) => t.id === tier) ?? tiers[0];

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!email.trim()) return;
    const cleanEmail = email.trim().toLowerCase();
    sessionStorage.setItem("student_email", cleanEmail);

    const startIdx = progression.courses.findIndex((c) => c.slug === course);
    const includedCourses =
      tier === "lifetime"
        ? progression.courses.map((c) => c.code ?? c.name)
        : selectedTier
        ? progression.courses
            .slice(startIdx, startIdx + 1 + selectedTier.coursesAhead)
            .map((c) => c.code ?? c.name)
        : [];
    const amount = tier === "lifetime" ? LIFETIME_PRICE : selectedTier?.price;
    if (!amount) return;

    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-get-access-checkout",
        {
          body: {
            email: cleanEmail,
            campus: progression.campusSlug,
            selectedCourse: course,
            selectedPlan: tier,
            amount,
            includedCourses,
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
      <section className="px-4 sm:px-6 pt-12 md:pt-20 pb-10 text-center relative">
        {/* Subtle Ole Miss powder-blue accent bar */}
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
          For {campusName} {courseCode ?? "ACCY 201"} students
        </div>

        <h1
          className="text-[34px] sm:text-[44px] md:text-[54px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Get full access. Survive your exam.
        </h1>
        <p
          className="mt-4 max-w-[640px] mx-auto text-[16px] sm:text-[18px]"
          style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
        >
          Pick your course, pick your plan, and start studying smarter in under a minute.
        </p>
      </section>

      {/* Two-column layout */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-start">
          {/* LEFT — What's included */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "#fff",
              boxShadow: "0 12px 40px rgba(20,33,61,0.08), 0 2px 6px rgba(20,33,61,0.05)",
              border: "1px solid rgba(20,33,61,0.06)",
            }}
          >
            <h2
              className="text-[22px] sm:text-[26px] mb-5"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              What's included
            </h2>
            <ul className="flex flex-col gap-4">
              {INCLUDES.map(({ icon: Icon, label, body }) => (
                <li key={label} className="flex gap-3">
                  <div
                    className="shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 40, height: 40, background: "#F1F5F9" }}
                  >
                    <Icon size={20} color={NAVY} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
                      {label}
                    </div>
                    <div className="text-[13px] mt-0.5" style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}>
                      {body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div
              className="mt-6 pt-5 border-t text-[12px] leading-relaxed"
              style={{ borderColor: "rgba(20,33,61,0.08)", color: "#64748B", fontFamily: "Inter, sans-serif" }}
            >
              Built and maintained by Lee Ingram, Ole Miss accounting tutor since 2015. Every solution, video, and tool is hand-checked for quality.
            </div>
          </div>

          {/* RIGHT — Guided purchase widget */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "#fff",
              boxShadow: "0 16px 48px rgba(20,33,61,0.12), 0 2px 6px rgba(20,33,61,0.06)",
              border: "1px solid rgba(20,33,61,0.08)",
            }}
          >
            <h2
              className="text-[22px] sm:text-[26px] mb-5"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Choose your plan
            </h2>

            {/* Step 1 — course */}
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              1. Your current course
            </label>
            <div className="relative mb-5">
              <select
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value as CourseSlug);
                  setTier("current");
                }}
                className="w-full appearance-none rounded-lg px-4 py-3 text-[14px] outline-none focus:ring-2"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  color: NAVY,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {progression.courses.map((c) => (
                  <option key={c.slug} value={c.slug}>{formatCourseLabel(c)}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: NAVY }} />
            </div>

            {/* Step 2 — access tier */}
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              2. How long do you want access?
            </label>
            <div role="radiogroup" className="flex flex-col gap-2 mb-5">
              {tiers.map((t) => {
                const active = (selectedTier?.id ?? "current") === t.id;
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTier(t.id)}
                    className="text-left rounded-lg p-4 transition-all"
                    style={{
                      background: active ? "#F0F9FF" : "#fff",
                      border: `2px solid ${active ? NAVY : "#E2E8F0"}`,
                      fontFamily: "Inter, sans-serif",
                      boxShadow: active ? "0 4px 12px rgba(20,33,61,0.08)" : "none",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ border: `2px solid ${active ? NAVY : "#CBD5E1"}` }}
                        >
                          {active && <div className="w-2 h-2 rounded-full" style={{ background: NAVY }} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold" style={{ color: NAVY }}>
                              {t.title}
                            </span>
                            {t.badge && (
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: RED, color: "#fff" }}
                              >
                                {t.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] mt-1" style={{ color: "#64748B" }}>
                            {t.subtext}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[16px] font-bold leading-none" style={{ color: NAVY }}>
                          ${t.price}
                        </div>
                        {t.coursesAhead > 0 && (
                          <div className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
                            total
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Lifetime upsell — appears after big-tier selection */}
            {(tier === "next2" || tier === "full" || tier === "lifetime") && (
              <button
                type="button"
                onClick={() => setTier("lifetime")}
                aria-pressed={tier === "lifetime"}
                className="w-full text-left rounded-xl p-5 mb-5 transition-all hover:-translate-y-0.5"
                style={{
                  background:
                    tier === "lifetime"
                      ? `linear-gradient(135deg, ${NAVY} 0%, #1E3A66 100%)`
                      : `linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)`,
                  border: `2px solid ${tier === "lifetime" ? "#D4AF37" : "#F59E0B"}`,
                  boxShadow:
                    tier === "lifetime"
                      ? "0 12px 32px rgba(20,33,61,0.25), 0 0 0 4px rgba(212,175,55,0.15)"
                      : "0 8px 24px rgba(245,158,11,0.18)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles
                      className="w-4 h-4 shrink-0"
                      style={{ color: tier === "lifetime" ? "#FFD700" : "#B45309" }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{ color: tier === "lifetime" ? "#FFD700" : "#B45309" }}
                    >
                      Premium · Lifetime
                    </span>
                  </div>
                  <div
                    className="text-[18px] font-bold leading-none shrink-0"
                    style={{ color: tier === "lifetime" ? "#fff" : NAVY }}
                  >
                    ${LIFETIME_PRICE}
                  </div>
                </div>
                <div
                  className="text-[15px] font-semibold mb-2"
                  style={{ color: tier === "lifetime" ? "#fff" : NAVY }}
                >
                  Upgrade to Lifetime Access
                </div>
                <ul className="flex flex-col gap-1 text-[12px]">
                  {["All courses", "All future updates", "One-time payment"].map((line) => (
                    <li
                      key={line}
                      className="flex items-center gap-1.5"
                      style={{ color: tier === "lifetime" ? "rgba(255,255,255,0.85)" : "#475569" }}
                    >
                      <InfinityIcon className="w-3 h-3 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </button>
            )}

            {/* Dynamic summary box */}
            {(() => {
              const startIdx = progression.courses.findIndex((c) => c.slug === course);

              if (tier === "lifetime") {
                return (
                  <div
                    className="rounded-lg p-4 mb-5"
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <div className="flex flex-col gap-2.5 text-[13px]">
                      <div className="flex gap-2">
                        <span className="font-semibold shrink-0" style={{ color: "#64748B", minWidth: 60 }}>You get:</span>
                        <span style={{ color: NAVY }}>Every course, forever</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold shrink-0" style={{ color: "#64748B", minWidth: 60 }}>Total:</span>
                        <span className="font-bold" style={{ color: NAVY }}>${LIFETIME_PRICE}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold shrink-0" style={{ color: "#64748B", minWidth: 60 }}>Access:</span>
                        <span style={{ color: NAVY }}>Lifetime — including all future updates</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (!selectedTier) return null;
              const includedCourses = progression.courses
                .slice(startIdx, startIdx + 1 + selectedTier.coursesAhead)
                .map((c) => c.code ?? c.name);
              const isFull =
                selectedTier.coursesAhead >= progression.courses.length - 1 - startIdx &&
                selectedTier.coursesAhead > 0;
              const accessPhrase =
                selectedTier.coursesAhead === 0
                  ? "Through August 31"
                  : isFull
                  ? "Covers your full accounting progression"
                  : `Covers your next ${selectedTier.coursesAhead === 1 ? "course" : `${selectedTier.coursesAhead} courses`}`;

              return (
                <div
                  className="rounded-lg p-4 mb-5"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <div className="flex flex-col gap-2.5 text-[13px]">
                    <div className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: "#64748B", minWidth: 60 }}>You get:</span>
                      <span style={{ color: NAVY }}>{includedCourses.join(", ")}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: "#64748B", minWidth: 60 }}>Total:</span>
                      <span className="font-bold" style={{ color: NAVY }}>${selectedTier.price}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-semibold shrink-0" style={{ color: "#64748B", minWidth: 60 }}>Access:</span>
                      <span style={{ color: NAVY }}>{accessPhrase}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Step 3 — email */}
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              3. Your email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@university.edu"
              className="w-full rounded-lg px-4 py-3 text-[14px] outline-none focus:ring-2 mb-5"
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: NAVY,
                fontFamily: "Inter, sans-serif",
              }}
            />

            {/* CTA */}
            {(() => {
              const ctaPrice = tier === "lifetime" ? LIFETIME_PRICE : selectedTier?.price;
              const ctaLabel =
                tier === "lifetime"
                  ? `Get Lifetime Access — $${LIFETIME_PRICE} →`
                  : ctaPrice
                  ? `Get Access — $${ctaPrice} →`
                  : "Get Access →";
              return (
                <button
                  onClick={handleCheckout}
                  disabled={
                    checkoutLoading ||
                    !email.trim() ||
                    (!selectedTier && tier !== "lifetime")
                  }
                  className="w-full rounded-xl py-4 text-[16px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                    fontFamily: "Inter, sans-serif",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(206,17,38,0.35)",
                  }}
                >
                  {checkoutLoading ? "Redirecting to secure checkout..." : ctaLabel}
                </button>
              );
            })()}

            {checkoutError && (
              <div
                className="mt-2 text-[12px] text-center"
                style={{ color: RED, fontFamily: "Inter, sans-serif" }}
              >
                {checkoutError}
              </div>
            )}

            <div className="mt-3 flex flex-col items-center gap-1.5 text-[12px]" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                7-day refund guarantee
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Instant access after purchase
              </div>
            </div>

            <p
              className="mt-3 text-center text-[11px] leading-snug"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              Individual access only. Account activity is monitored to prevent sharing.
            </p>
          </div>
        </div>
      </section>

      {/* Supporting / preview content */}
      <section className="px-4 sm:px-6 pb-20" style={{ background: "transparent" }}>
        <div className="max-w-[1100px] mx-auto">
          <h2
            className="text-center text-[24px] sm:text-[30px] mb-8"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Want to see it first?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Browse Survival Tools", body: "Try the flashcards, journal entry builder, and formula recall — free preview.", to: "/staging" },
              { label: "Browse Practice Problems", body: "See how Lee's solutions actually walk you through the work.", to: "/staging" },
              { label: "Common questions", body: "How access works, refunds, and what's in the library.", to: "/staging" },
            ].map((c) => (
              <button
                key={c.label}
                onClick={() => navigate(c.to)}
                className="text-left rounded-xl p-5 transition-all hover:-translate-y-0.5"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(20,33,61,0.08)",
                  boxShadow: "0 4px 16px rgba(20,33,61,0.06)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: NAVY }}>
                  <Check className="w-4 h-4" />
                  {c.label}
                </div>
                <div className="text-[12px] mt-1.5" style={{ color: "#64748B" }}>
                  {c.body}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />

      {/* Sticky bottom bar — appears after scroll */}
      {(() => {
        const stickyPrice = tier === "lifetime" ? LIFETIME_PRICE : selectedTier?.price;
        const stickyName =
          tier === "lifetime"
            ? "Lifetime Access"
            : selectedTier?.title ?? "Get Access";
        if (!stickyPrice) return null;
        return (
          <div
            className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
              showStickyBar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            }`}
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(12px)",
              borderTop: "1px solid rgba(20,33,61,0.1)",
              boxShadow: "0 -8px 24px rgba(20,33,61,0.08)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="text-[13px] sm:text-[14px] font-semibold truncate" style={{ color: NAVY }}>
                  {stickyName}
                </span>
                <span className="text-[14px] sm:text-[16px] font-bold shrink-0" style={{ color: NAVY }}>
                  ${stickyPrice}
                </span>
              </div>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-lg px-4 sm:px-5 py-2.5 text-[13px] sm:text-[14px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] shrink-0"
                style={{
                  background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                  boxShadow: "0 4px 12px rgba(206,17,38,0.3)",
                }}
              >
                Get Access →
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
