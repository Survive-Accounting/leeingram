import { useState } from "react";
import { LogIn } from "lucide-react";
import CourseCard from "@/components/landing/CourseCard";
import EmailCaptureModal from "@/components/landing/EmailCaptureModal";
import NotifyModal from "@/components/landing/NotifyModal";

const COURSES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Introductory Accounting 1",
    subtext: "Financial Principles",
    badge: "FALL 2026",
    badgeColor: "#6B7280",
    subtitle: "Available next semester",
    cta: "Request Early Access →",
    status: "future" as const,
    slug: "intro-accounting-1",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Introductory Accounting 2",
    subtext: "Managerial Principles",
    badge: "LAUNCHING APRIL 24",
    badgeColor: "#F97316",
    subtitle: "Coming before finals",
    cta: "Notify Me →",
    status: "upcoming" as const,
    slug: "intro-accounting-2",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Intermediate Accounting 1",
    badge: "FALL 2026",
    badgeColor: "#6B7280",
    subtitle: "Available next semester",
    cta: "Request Early Access →",
    status: "future" as const,
    slug: "intermediate-accounting-1",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Intermediate Accounting 2",
    badge: "LIVE",
    badgeColor: "#22C55E",
    subtitle: "Ch 13–22 · Finals prep · $125",
    cta: "Start Studying →",
    status: "live" as const,
    slug: "intermediate-accounting-2",
  },
];

type ModalState =
  | { type: "none" }
  | { type: "email"; course: typeof COURSES[0] }
  | { type: "notify"; course: typeof COURSES[0] };

export default function LandingPage() {
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  const handleCardClick = (course: typeof COURSES[0]) => {
    if (course.status === "live") {
      setModal({ type: "email", course });
    } else {
      setModal({ type: "notify", course });
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      {/* Hero */}
      <div className="relative overflow-hidden landing-hero" style={{ height: 300 }}>
        <style>{`
          @media (max-width: 640px) { .landing-hero { height: 220px !important; } }
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
            background: linear-gradient(to right, rgba(20,33,61,0.45) 0%, rgba(20,33,61,0.55) 25%, rgba(20,33,61,0.12) 55%, rgba(20,33,61,0.35) 100%);
            z-index: 1;
          }
        `}</style>

        {/* Admin link */}
        <div className="absolute top-4 right-4" style={{ zIndex: 10 }}>
          <a
            href="/admin"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors"
            style={{ color: "rgba(255,255,255,0.2)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)")}
          >
            <LogIn className="w-3.5 h-3.5" />
            Admin
          </a>
        </div>

        {/* Student login */}
        <div className="absolute top-4 left-4" style={{ zIndex: 10 }}>
          <a
            href="/login"
            className="text-[11px] uppercase tracking-widest transition-colors"
            style={{ color: "rgba(255,255,255,0.2)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)")}
          >
            Student Login
          </a>
        </div>

        <div className="relative h-full mx-auto max-w-[780px] px-4 sm:px-6 flex flex-col justify-center" style={{ zIndex: 2 }}>
          <h1
            className="text-[26px] sm:text-[34px] text-white leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
          >
            Your exam is right now.
            <br />
            Let's survive it.
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            Exam prep trusted by 1,000+ accounting students.
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
      <div className="relative z-10 flex-1 flex flex-col items-center px-4 py-8">
        <p className="text-[14px] font-medium mb-5" style={{ color: "#6B7280" }}>
          What course are you studying?
        </p>
        <div className="w-full max-w-[700px] grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COURSES.map((c) => (
            <CourseCard
              key={c.id}
              name={c.name}
              subtext={c.subtext}
              badge={c.badge}
              badgeColor={c.badgeColor}
              subtitle={c.subtitle}
              cta={c.cta}
              isLive={c.status === "live"}
              onClick={() => handleCardClick(c)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-6 space-y-0.5">
        <p className="text-[12px]" style={{ color: "#9CA3AF" }}>
          Made by Lee Ingram · Ole Miss Accounting Tutor since 2015
        </p>
        <p className="text-[12px]" style={{ color: "#B0B5BD" }}>
          Questions?{" "}
          <a href="mailto:lee@surviveaccounting.com" className="underline" style={{ color: "#9CA3AF" }}>
            lee@surviveaccounting.com
          </a>
        </p>
      </div>

      {/* Modals */}
      {modal.type === "email" && (
        <EmailCaptureModal
          open
          onClose={() => setModal({ type: "none" })}
          courseId={modal.course.id}
          courseSlug={modal.course.slug}
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
