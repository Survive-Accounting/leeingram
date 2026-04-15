// Staging clone of LandingPage.tsx — experiment here, then push changes live
import { useState, useRef, useEffect } from "react";
import SiteNavbar from "@/components/landing/SiteNavbar";
import StagingTestimonialsSection from "@/components/landing/StagingTestimonialsSection";
import ContactForm from "@/components/landing/ContactForm";
import LandingFooter from "@/components/landing/LandingFooter";
import { useEventTracking } from "@/hooks/useEventTracking";
import StagingHero from "@/components/landing/StagingHero";
import ThisIsForYouSection from "@/components/landing/ThisIsForYouSection";
import OutcomesSection from "@/components/landing/OutcomesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import CourseExplorerSection from "@/components/landing/CourseExplorerSection";
import StagingCtaModal, { type CtaModalIntent, type CtaCourse } from "@/components/landing/StagingCtaModal";

const COURSES: CtaCourse[] = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Intermediate Accounting 2",
    availability: "",
    cta: "Start Studying →",
    status: "live" as const,
    slug: "intermediate-accounting-2",
  },
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
];

export default function StagingLandingPage() {
  const [intent, setIntent] = useState<CtaModalIntent>({ type: "none" });
  const contactRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const { trackPageView } = useEventTracking();

  useEffect(() => { trackPageView('staging_landing'); }, [trackPageView]);

  const liveCourse = COURSES.find(c => c.status === "live")!;
  const futureCourses = COURSES.filter(c => c.status !== "live");

  /** Open modal with a specific course pre-selected */
  const openWithCourse = (course: CtaCourse) => {
    if (course.status === "live") {
      setIntent({ type: "enroll", course });
    } else {
      setIntent({ type: "notify", course });
    }
  };

  /** Open modal at course selection step (no course context) */
  const openCourseSelect = () => {
    setIntent({ type: "select-course" });
  };

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
        onLiveCourseClick={() => openWithCourse(liveCourse)}
        onNotifyClick={(c) => openWithCourse(c)}
      />

      <ThisIsForYouSection onCtaClick={() => openWithCourse(liveCourse)} />

      <OutcomesSection onCtaClick={() => openWithCourse(liveCourse)} />

      <HowItWorksSection onCtaClick={() => openCourseSelect()} />

      <StagingTestimonialsSection onCtaClick={() => openWithCourse(liveCourse)} />

      <div ref={contactRef}>
        <ContactForm />
      </div>

      <LandingFooter
        onScrollToCourses={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
        onScrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <StagingCtaModal
        intent={intent}
        onClose={() => setIntent({ type: "none" })}
        courses={COURSES}
        onIntentChange={setIntent}
      />
    </div>
  );
}
