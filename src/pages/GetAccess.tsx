import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sword, PenLine, MonitorPlay, ShieldCheck } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
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

/**
 * Semester access windows: renew Jan 1 (→ Jun 30) and Jul 1 (→ Dec 31).
 * Base pass covers the current semester; auto-renew extends through the
 * next one.
 */
function getAccessWindow(extend: boolean): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  // Current semester end
  let endYear = year;
  let endMonth = month < 6 ? 5 : 11; // June (5) or December (11)
  let endDay = month < 6 ? 30 : 31;

  if (extend) {
    if (endMonth === 5) {
      endMonth = 11;
      endDay = 31;
    } else {
      endMonth = 5;
      endDay = 30;
      endYear += 1;
    }
  }

  const monthName = new Date(endYear, endMonth, 1).toLocaleString("en-US", { month: "long" });
  return `${monthName} ${endDay}, ${endYear}`;
}

const INCLUDES = [
  {
    icon: Sword,
    label: "Survival Tools",
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

  // Next course in the campus progression (used for auto-renew label)
  const currentIdx = progression.courses.findIndex((c) => c.slug === resolvedCourseSlug);
  const nextCourse = currentIdx >= 0 ? progression.courses[currentIdx + 1] : undefined;
  const nextCourseLabel = nextCourse?.code ?? nextCourse?.name ?? null;

  const [autoRenew, setAutoRenew] = useState(false);
  const totalPrice = autoRenew ? PRICE * 2 : PRICE;
  const accessThrough = getAccessWindow(autoRenew);

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
      const { data, error } = await supabase.functions.invoke(
        "create-get-access-checkout",
        {
          body: {
            email: cleanEmail,
            campus: progression.campusSlug,
            selectedCourse: resolvedCourseSlug,
            selectedPlan: "study_pass",
            amount: totalPrice,
            includedCourses: [resolvedCourse.code ?? resolvedCourse.name],
            autoRenew,
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
          Get study tools that help you study smarter instead.
        </p>
      </section>

      {/* Two-column layout: checkout LEFT (first on mobile), includes RIGHT */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10 items-start">
          {/* LEFT — Checkout (visually dominant) */}
          <div
            className="md:col-span-3 order-1 rounded-2xl p-6 sm:p-8"
            style={{
              background: "#fff",
              boxShadow: "0 16px 48px rgba(20,33,61,0.12), 0 2px 6px rgba(20,33,61,0.06)",
              border: "1px solid rgba(20,33,61,0.08)",
            }}
          >
            <h2
              className="text-[24px] sm:text-[28px] mb-6"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Get Full Access
            </h2>

            {/* Section 1 — Course Selected */}
            <div className="mb-5">
              <div
                className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                Course Selected
              </div>
              <div
                className="rounded-lg px-4 py-3 text-[14px] font-semibold"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  color: NAVY,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {courseLabel}
              </div>
            </div>

            {/* Section 2 — Product */}
            <div className="mb-5">
              <div
                className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                Product
              </div>
              <div
                className="rounded-lg px-4 py-3 transition-all duration-300"
                style={{
                  background: autoRenew ? "#ECFDF5" : "#F0F9FF",
                  border: `1px solid ${autoRenew ? "#A7F3D0" : "#BAE6FD"}`,
                  fontFamily: "Inter, sans-serif",
                  boxShadow: autoRenew ? "0 0 0 3px rgba(16,185,129,0.10)" : "none",
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[15px] font-semibold" style={{ color: NAVY }}>
                    Survive Study Pass
                  </div>
                  <div className="text-[18px] font-bold transition-all duration-300" style={{ color: NAVY }}>
                    ${totalPrice}
                  </div>
                </div>
                <div
                  key={accessThrough}
                  className="mt-1 animate-fade-in"
                >
                  <span
                    className="text-[13px] font-medium"
                    style={{
                      color: autoRenew ? "#047857" : "#1E293B",
                      background: autoRenew ? "rgba(16,185,129,0.12)" : "transparent",
                      padding: autoRenew ? "1px 6px" : "0",
                      borderRadius: 4,
                      transition: "all 200ms ease-out",
                    }}
                  >
                    Access through {accessThrough}
                  </span>
                </div>
                {autoRenew && nextCourseLabel && (
                  <div
                    className="text-[12px] mt-1 animate-fade-in"
                    style={{ color: "#047857", fontWeight: 500 }}
                  >
                    Includes next course ({nextCourseLabel})
                  </div>
                )}
              </div>
            </div>

            {/* Section 3 — Auto-renew checkbox */}
            <label
              className="flex items-start gap-3 mb-6 p-3 rounded-lg cursor-pointer transition-all duration-200"
              style={{
                border: `1px solid ${autoRenew ? "#A7F3D0" : "#E2E8F0"}`,
                background: autoRenew ? "#F0FDF4" : "#fff",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#14213D]"
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: NAVY }}>
                  Stay covered next semester (+${PRICE})
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>
                  {nextCourseLabel
                    ? `Extends your access and includes ${nextCourseLabel}. Cancel anytime.`
                    : "Extends your access through the next semester. Cancel anytime."}
                </div>
              </div>
            </label>

            {/* Captured email — non-editable */}
            {email.trim() && (
              <p
                className="mb-3 text-[12px]"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                Purchasing for: <span style={{ color: "#64748B" }}>{email.trim()}</span>
              </p>
            )}

            {/* Section 4 — CTA */}
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full rounded-xl py-4 text-[16px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                fontFamily: "Inter, sans-serif",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(206,17,38,0.35)",
              }}
            >
              {checkoutLoading
                ? "Redirecting to secure checkout..."
                : `Get Access — $${totalPrice}`}
            </button>

            {checkoutError && (
              <div
                className="mt-2 text-[12px] text-center"
                style={{ color: RED, fontFamily: "Inter, sans-serif" }}
              >
                {checkoutError}
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

            <p
              className="mt-3 text-center text-[11px] leading-snug"
              style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
            >
              Individual access only. Account activity is monitored.
            </p>
          </div>

          {/* RIGHT — What's included (secondary) */}
          <div
            className="md:col-span-2 order-2 rounded-2xl p-6 sm:p-7"
            style={{
              background: "#fff",
              boxShadow: "0 8px 24px rgba(20,33,61,0.06), 0 1px 3px rgba(20,33,61,0.04)",
              border: "1px solid rgba(20,33,61,0.06)",
            }}
          >
            <h3
              className="text-[18px] sm:text-[20px] mb-4"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              What's included
            </h3>
            <ul className="flex flex-col gap-4">
              {INCLUDES.map(({ icon: Icon, label, body, isNew }) => (
                <li key={label} className="flex gap-3">
                  <div
                    className="shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 36, height: 36, background: "#F1F5F9" }}
                  >
                    <Icon size={18} color={NAVY} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[14px] font-semibold"
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
                      className="text-[12.5px] mt-0.5 leading-snug"
                      style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
                    >
                      {body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div
              className="mt-5 pt-4 border-t text-[11.5px] leading-relaxed"
              style={{
                borderColor: "rgba(20,33,61,0.08)",
                color: "#64748B",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Built and maintained by Lee Ingram, Ole Miss accounting tutor since 2015.
            </div>
          </div>
        </div>
      </section>

      <LandingFooter
        onScrollToCourses={() => navigate("/staging")}
        onScrollToContact={() => navigate("/staging")}
      />
    </div>
  );
}
