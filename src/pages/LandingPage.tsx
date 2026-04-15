import { useState, useRef } from "react";
import CourseCard from "@/components/landing/CourseCard";
import EmailCaptureModal from "@/components/landing/EmailCaptureModal";
import NotifyModal from "@/components/landing/NotifyModal";
import LandingHeader from "@/components/landing/LandingHeader";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ContactForm from "@/components/landing/ContactForm";
import LandingFooter from "@/components/landing/LandingFooter";
import SmartEmailModal from "@/components/landing/SmartEmailModal";

const COURSES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Introductory Accounting 1",
    subtext: "Financial Principles",
    badge: "FALL 2026",
    badgeColor: "#6B7280",
    subtitle: "Available next semester",
    cta: "Notify Me →",
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
    cta: "Notify Me →",
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
  | { type: "email"; course: typeof COURSES[0]; redirectTo?: string }
  | { type: "notify"; course: typeof COURSES[0] }
  | { type: "smart" };

export default function LandingPage() {
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const coursesRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const handleCardClick = (course: typeof COURSES[0]) => {
    if (course.status === "live") {
      setModal({ type: "email", course });
    } else {
      setModal({ type: "notify", course });
    }
  };

  const handlePricingClick = () => {
    const ia2 = COURSES.find((c) => c.slug === "intermediate-accounting-2")!;
    setModal({ type: "email", course: ia2, redirectTo: "pricing" });
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      {/* Header */}
      <LandingHeader
        onPricingClick={handlePricingClick}
        onCoursesClick={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

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
            className="text-[30px] sm:text-[42px] md:text-[48px] text-white leading-[1.15] tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)" }}
          >
            Your exam is coming up.<br />
            <span style={{ color: "#CE1126" }}>Let's survive it.</span>
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
      <div ref={coursesRef} className="relative z-10 flex-1 flex flex-col items-center px-4 py-8">
        <p className="text-[17px] sm:text-[19px] font-semibold mb-6" style={{ color: "#374151", fontFamily: "Inter, sans-serif" }}>
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

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Contact Form */}
      <div ref={contactRef}>
        <ContactForm />
      </div>

      {/* Footer */}
      <LandingFooter
        onScrollToCourses={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
        onScrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      {/* Modals */}
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
      {modal.type === "smart" && (
        <SmartEmailModal
          open
          onClose={() => setModal({ type: "none" })}
        />
      )}
    </div>
  );
}
