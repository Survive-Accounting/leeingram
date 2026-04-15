// Staging clone of LandingPage.tsx — experiment here, then push changes live
import { useState, useRef, useEffect } from "react";
import EmailCaptureModal from "@/components/landing/EmailCaptureModal";
import NotifyModal from "@/components/landing/NotifyModal";
import SiteNavbar from "@/components/landing/SiteNavbar";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ContactForm from "@/components/landing/ContactForm";
import LandingFooter from "@/components/landing/LandingFooter";
import { useEventTracking } from "@/hooks/useEventTracking";
import StagingHero from "@/components/landing/StagingHero";

const COURSES = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Intro Accounting 2",
    subtext: "Managerial Principles",
    availability: "Launching April 27th",
    cta: "Get early access →",
    status: "upcoming" as const,
    slug: "intro-accounting-2",
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Intro Accounting 1",
    subtext: "Financial Principles",
    availability: "Fall 2026",
    cta: "Get early access →",
    status: "future" as const,
    slug: "intro-accounting-1",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Intermediate Accounting 1",
    availability: "Fall 2026",
    cta: "Get early access →",
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

export default function StagingLandingPage() {
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const contactRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const { trackEvent, trackPageView } = useEventTracking();

  useEffect(() => { trackPageView('staging_landing'); }, [trackPageView]);

  const handleCardClick = (course: typeof COURSES[0]) => {
    if (course.status === "live") {
      trackEvent('course_selected', { course_name: course.name, course_slug: course.slug });
      setModal({ type: "email", course });
    } else {
      trackEvent('waitlist_signup', { course_name: course.name });
      setModal({ type: "notify", course });
    }
  };

  const handleNotifyClick = (course: typeof COURSES[0]) => {
    trackEvent('waitlist_signup', { course_name: course.name });
    setModal({ type: "notify", course });
  };

  const liveCourse = COURSES.find(c => c.status === "live")!;
  const futureCourses = COURSES.filter(c => c.status !== "live");

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      {/* STAGING BANNER */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black text-center text-xs font-bold py-1 tracking-wide">
        ⚠️ STAGING — Changes here won't affect the live homepage
      </div>
      <div style={{ height: 28 }} />

      <SiteNavbar />

      <StagingHero
        liveCourse={liveCourse}
        futureCourses={futureCourses}
        onLiveCourseClick={() => handleCardClick(liveCourse)}
        onNotifyClick={handleNotifyClick}
      />

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
