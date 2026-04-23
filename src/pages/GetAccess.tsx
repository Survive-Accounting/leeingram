import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sword, PenLine, MonitorPlay, ShieldCheck, ChevronDown } from "lucide-react";
import StagingNavbar from "@/components/landing/StagingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
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


const PLANS = [
  {
    id: "semester",
    label: "Semester Pass",
    price: 99,
    anchor: 250,
    tag: "Most Popular",
    description: "Full access through end of semester. Best for finals prep.",
  },
  {
    id: "chapter",
    label: "Single Chapter",
    price: 30,
    anchor: null,
    tag: null,
    description: "Just need help with one chapter? Grab access to that one.",
  },
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
  const [plan, setPlan] = useState<"semester" | "chapter">("semester");
  const [email, setEmail] = useState(emailParam);

  const selectedPlan = PLANS.find((p) => p.id === plan)!;

  const handleCheckout = () => {
    // Hook up Stripe later; for now route to staging campus checkout flow.
    if (!email.trim()) return;
    sessionStorage.setItem("student_email", email.trim().toLowerCase());
    navigate(`/staging`);
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
              Get started
            </h2>

            {/* Step 1 — course */}
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              1. Your course
            </label>
            <div className="relative mb-5">
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value as CourseSlug)}
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

            {/* Step 2 — plan */}
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              2. Pick a plan
            </label>
            <div className="flex flex-col gap-2 mb-5">
              {PLANS.map((p) => {
                const active = plan === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id as "semester" | "chapter")}
                    className="text-left rounded-lg p-4 transition-all"
                    style={{
                      background: active ? "#F0F9FF" : "#fff",
                      border: `2px solid ${active ? NAVY : "#E2E8F0"}`,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ border: `2px solid ${active ? NAVY : "#CBD5E1"}` }}
                        >
                          {active && <div className="w-2 h-2 rounded-full" style={{ background: NAVY }} />}
                        </div>
                        <span className="text-[14px] font-semibold" style={{ color: NAVY }}>
                          {p.label}
                        </span>
                        {p.tag && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: RED, color: "#fff" }}
                          >
                            {p.tag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        {p.anchor && (
                          <span className="text-[12px] line-through" style={{ color: "#94A3B8" }}>
                            ${p.anchor}
                          </span>
                        )}
                        <span className="text-[16px] font-bold" style={{ color: NAVY }}>
                          ${p.price}
                        </span>
                      </div>
                    </div>
                    <div className="text-[12px] mt-1.5 pl-6" style={{ color: "#64748B" }}>
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>

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
            <button
              onClick={handleCheckout}
              disabled={!email.trim()}
              className="w-full rounded-xl py-4 text-[16px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                fontFamily: "Inter, sans-serif",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(206,17,38,0.35)",
              }}
            >
              Buy {selectedPlan.label} — ${selectedPlan.price} →
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px]" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              7-day money-back guarantee
            </div>
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
    </div>
  );
}
