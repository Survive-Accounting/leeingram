import { useState, useRef, useEffect } from "react";
import CourseCard from "@/components/landing/CourseCard";
import EmailCaptureModal from "@/components/landing/EmailCaptureModal";
import NotifyModal from "@/components/landing/NotifyModal";
import SiteNavbar from "@/components/landing/SiteNavbar";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ContactForm from "@/components/landing/ContactForm";
import LandingFooter from "@/components/landing/LandingFooter";
import { useEventTracking } from "@/hooks/useEventTracking";

const COURSES = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Intro Accounting 2",
    subtext: "Managerial Principles",
    availability: "Coming April 27th",
    cta: "Notify Me →",
    status: "upcoming" as const,
    slug: "intro-accounting-2",
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Intro Accounting 1",
    subtext: "Financial Principles",
    availability: "Available Fall 2026",
    cta: "Notify Me →",
    status: "future" as const,
    slug: "intro-accounting-1",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Intermediate Accounting 1",
    availability: "Available Fall 2026",
    cta: "Notify Me →",
    status: "future" as const,
    slug: "intermediate-accounting-1",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Intermediate Accounting 2",
    availability: "",
    cta: "Start Studying →",
    status: "live" as const,
    slug: "intermediate-accounting-2",
  },
];

type ModalState =
  | { type: "none" }
  | { type: "email"; course: typeof COURSES[0]; redirectTo?: string }
  | { type: "notify"; course: typeof COURSES[0] };

export default function LandingPage() {
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const coursesRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const { trackEvent, trackPageView } = useEventTracking();

  useEffect(() => { trackPageView('landing'); }, [trackPageView]);

  const handleCardClick = (course: typeof COURSES[0]) => {
    if (course.status === "live") {
      trackEvent('course_selected', { course_name: course.name, course_slug: course.slug });
      setModal({ type: "email", course });
    } else {
      trackEvent('waitlist_signup', { course_name: course.name });
      setModal({ type: "notify", course });
    }
  };

  const handlePricingClick = () => {
    const ia2 = COURSES.find((c) => c.slug === "intermediate-accounting-2")!;
    setModal({ type: "email", course: ia2, redirectTo: "pricing" });
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      <SiteNavbar onCoursesClick={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })} />

      {/* Hero */}
      <div className="relative overflow-hidden landing-hero" style={{ height: 340 }}>
        <style>{`
          @media (max-width: 640px) { .landing-hero { height: 260px !important; } }
          .landing-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url('https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg');
            background-size: cover;
            background-position: 60% 40%;
            background-repeat: no-repeat;
            transform: scaleX(-1);
            z-index: 0;
          }
          .landing-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to right, rgba(20,33,61,0.35) 0%, rgba(20,33,61,0.5) 30%, rgba(20,33,61,0.65) 50%, rgba(20,33,61,0.5) 70%, rgba(20,33,61,0.35) 100%);
            z-index: 1;
          }
        `}</style>

        <div className="relative h-full mx-auto max-w-[900px] px-4 sm:px-6 flex flex-col items-center justify-center text-center" style={{ zIndex: 2 }}>
          <h1
            className="text-[28px] sm:text-[40px] md:text-[46px] text-white leading-[1.2] tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)" }}
          >
            Your exam is coming up.<br />
            <span style={{ color: "#CE1126", fontStyle: "italic" }}>Let's do more than survive it.</span>
          </h1>
          <p className="mt-3 text-[14px] sm:text-[15px] tracking-wide" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
            Online exam prep by Lee Ingram · Trusted by 1,000+ students
          </p>
        </div>
      </div>

      {/* Wave divider */}
      <div style={{ background: "#F8F8FA", marginTop: "-2px", overflow: "hidden", lineHeight: 0 }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "60px" }}>
          <path d="M0,30 C240,60 480,55 720,35 C960,15 1200,50 1440,30 L1440,0 L0,0 Z" fill="#14213D" />
        </svg>
      </div>

      {/* Course selector */}
      <div ref={coursesRef} className="relative z-10 flex-1 flex flex-col items-center px-4 py-10" style={{ scrollMarginTop: "80px" }}>
        <h2
          className="text-[28px] sm:text-[34px] text-center mb-8"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#14213D", fontWeight: 400 }}
        >
          What course are you studying?
        </h2>

        {/* Hero card — Live course */}
        {(() => {
          const live = COURSES.find(c => c.status === "live")!;
          return (
            <button
              onClick={() => handleCardClick(live)}
              className="w-full max-w-xl text-left rounded-xl p-5 sm:p-6 mb-8 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: "#fff",
                borderLeft: "4px solid #22C55E",
                boxShadow: "0 2px 16px rgba(20,33,61,0.08), 0 0 0 1px rgba(229,231,235,0.6)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white mb-2" style={{ background: "#22C55E" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                  <h3 className="text-[20px] sm:text-[22px] font-bold mb-1" style={{ color: "#14213D" }}>
                    {live.name}
                  </h3>
                  <p className="text-[13px]" style={{ color: "#6B7280" }}>
                    Ch 13–22 · Finals prep
                  </p>
                </div>
                <div className="sm:w-[170px] shrink-0">
                  <span
                    className="block rounded-lg px-5 py-3 text-[14px] font-bold text-center text-white transition-all hover:brightness-110"
                    style={{ background: "#CE1126" }}
                  >
                    Start Studying →
                  </span>
                </div>
              </div>
            </button>
          );
        })()}

        {/* Separator + coming soon */}
        <div className="w-full max-w-xl flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
          <p className="text-[15px] sm:text-[16px] font-medium whitespace-nowrap" style={{ color: "#9CA3AF" }}>
            More courses coming soon
          </p>
          <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
        </div>
        <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COURSES.filter(c => c.status !== "live").map((c) => (
            <CourseCard
              key={c.id}
              name={c.name}
              subtext={c.subtext}
              availability={c.availability}
              cta={c.cta}
              onClick={() => handleCardClick(c)}
            />
          ))}
        </div>
      </div>

      <TestimonialsSection />

      <div ref={contactRef}>
        <ContactForm />
      </div>

      <LandingFooter
        onScrollToCourses={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
        onScrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      {modal.type === "email" && (
        <EmailCaptureModal
          open
          onClose={() => setModal({ type: "none" })}
          courseId={modal.course.id}
          courseSlug={modal.course.slug}
          redirectTo={modal.redirectTo}
        />
      )}
      {modal.type === "notify" && (
        <NotifyModal
          open
          onClose={() => setModal({ type: "none" })}
          courseName={modal.course.name}
          courseId={modal.course.id}
        />
      )}
    </div>
  );
}
