// Staging clone of LandingPage.tsx — experiment here, then push changes live
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StagingNavbar from "@/components/landing/StagingNavbar";
import StagingTestimonialsSection from "@/components/landing/StagingTestimonialsSection";
import ContactForm from "@/components/landing/ContactForm";
import LandingFooter from "@/components/landing/LandingFooter";
import { useEventTracking, setStoredEmail } from "@/hooks/useEventTracking";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StagingHero from "@/components/landing/StagingHero";
import StagingCoursesSection from "@/components/landing/StagingCoursesSection";
import ClosingCtaSection from "@/components/landing/ClosingCtaSection";
import StagingWaitlistModal from "@/components/landing/StagingWaitlistModal";
import StagingEmailPromptModal from "@/components/landing/StagingEmailPromptModal";
import type { CtaCourse } from "@/components/landing/StagingCtaModal";

const COURSES: CtaCourse[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Intro Accounting 1",
    subtext: "Financial Principles",
    availability: "",
    cta: "Start Studying →",
    status: "live",
    slug: "intro-accounting-1",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Intro Accounting 2",
    subtext: "Managerial Principles",
    availability: "",
    cta: "Start Studying →",
    status: "live",
    slug: "intro-accounting-2",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Intermediate Accounting 1",
    availability: "",
    cta: "Start Studying →",
    status: "live",
    slug: "intermediate-accounting-1",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Intermediate Accounting 2",
    availability: "",
    cta: "Start Studying →",
    status: "live",
    slug: "intermediate-accounting-2",
  },
];

const OLE_MISS_DOMAINS = ["olemiss.edu", "go.olemiss.edu"];

// Test bypass: lee+anything@survivestudios.com is treated as Ole Miss for QA / checkout testing.
function isTestOleMissEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return /^lee\+[^@]+@survivestudios\.com$/.test(lower);
}

function isOleMissEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  if (isTestOleMissEmail(lower)) return true;
  const domain = lower.split("@")[1] || "";
  return OLE_MISS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export default function StagingLandingPage() {
  const navigate = useNavigate();
  const contactRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const { trackPageView, trackEvent } = useEventTracking();

  const [capturedEmail, setCapturedEmail] = useState<string>("");
  const [pendingCourse, setPendingCourse] = useState<CtaCourse | null>(null);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [emailPromptLoading, setEmailPromptLoading] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistInitialEmail, setWaitlistInitialEmail] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    trackPageView("staging_landing");
    const stored = sessionStorage.getItem("student_email");
    if (stored) setCapturedEmail(stored);
  }, [trackPageView]);

  /** Route an email + course through the gating logic. */
  const routeEmailToCourse = async (email: string, course: CtaCourse) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    if (!isOleMissEmail(trimmed)) {
      // Non-Ole Miss → waitlist
      trackEvent("non_ole_miss_email_blocked", {
        email_domain: trimmed.split("@")[1] || "",
        course_slug: course.slug,
      });
      setWaitlistInitialEmail(trimmed);
      setWaitlistOpen(true);
      return;
    }

    // Ole Miss → resolve campus and proceed to chapter selector inline (campus page)
    setResolving(true);
    try {
      sessionStorage.setItem("student_email", trimmed);
      setStoredEmail(trimmed);
      setCapturedEmail(trimmed);
      trackEvent("email_captured", {
        course_slug: course.slug,
        email_domain: trimmed.split("@")[1] || "",
      });

      const { data, error } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: course.slug },
      });
      if (error) throw error;
      const slug = data?.campus_slug || "ole-miss";
      if (data?.is_test_mode) {
        sessionStorage.setItem("sa_test_mode", "true");
        sessionStorage.setItem("sa_email_override", data.email_override || "");
      }
      navigate(`/campus/${slug}/${course.slug}`);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setResolving(false);
    }
  };

  /** Card / CTA click handler. Prompts for email if needed, then gates by domain. */
  const handleCardClick = async (course: CtaCourse) => {
    setPendingCourse(course);
    if (capturedEmail) {
      await routeEmailToCourse(capturedEmail, course);
    } else {
      setEmailPromptOpen(true);
    }
  };

  const handleEmailPromptSubmit = async (email: string) => {
    if (!pendingCourse) {
      setEmailPromptOpen(false);
      return;
    }
    setEmailPromptLoading(true);
    try {
      // Close the prompt first so it doesn't stack on top of waitlist/transition
      setEmailPromptOpen(false);
      await routeEmailToCourse(email, pendingCourse);
    } finally {
      setEmailPromptLoading(false);
    }
  };

  // Pick a default course for navbar/hero/closing CTAs (IA2 — original live flagship)
  const defaultCourse =
    COURSES.find((c) => c.slug === "intermediate-accounting-2") || COURSES[0];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      {/* STAGING BANNER */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black text-center text-xs font-bold py-1 tracking-wide">
        ⚠️ STAGING — Changes here won't affect the live homepage
      </div>

      {/* Floating navbar spacer */}
      <div style={{ height: 80 }} />

      <StagingNavbar onCtaClick={() => handleCardClick(defaultCourse)} />

      <StagingHero
        liveCourse={defaultCourse}
        futureCourses={[]}
        onLiveCourseClick={() => handleCardClick(defaultCourse)}
        onNotifyClick={() => handleCardClick(defaultCourse)}
        onGetStartedClick={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <StagingTestimonialsSection onCtaClick={() => handleCardClick(defaultCourse)} />

      <div ref={coursesRef}>
        <StagingCoursesSection
          courses={COURSES}
          onCardClick={handleCardClick}
          onExpansionClick={() => {
            setWaitlistInitialEmail("");
            setWaitlistOpen(true);
          }}
        />
      </div>

      <ClosingCtaSection onCtaClick={() => handleCardClick(defaultCourse)} />

      <div ref={contactRef}>
        <ContactForm />
      </div>

      <LandingFooter
        onScrollToCourses={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
        onScrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <StagingEmailPromptModal
        open={emailPromptOpen}
        onClose={() => setEmailPromptOpen(false)}
        onSubmit={handleEmailPromptSubmit}
        courseName={pendingCourse?.name}
        loading={emailPromptLoading || resolving}
      />

      <StagingWaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        initialEmail={waitlistInitialEmail}
      />
    </div>
  );
}
