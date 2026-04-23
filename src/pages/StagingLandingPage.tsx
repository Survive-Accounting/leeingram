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
import StagingFeatureCardsSection from "@/components/landing/StagingFeatureCardsSection";
import ClosingCtaSection from "@/components/landing/ClosingCtaSection";

import StagingEmailPromptModal, { type CelebrationData } from "@/components/landing/StagingEmailPromptModal";

import StagingGetStartedModal from "@/components/landing/StagingGetStartedModal";
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

export default function StagingLandingPage() {
  const navigate = useNavigate();
  const contactRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const { trackPageView, trackEvent } = useEventTracking();

  const [capturedEmail, setCapturedEmail] = useState<string>("");
  const [pendingCourse, setPendingCourse] = useState<CtaCourse | null>(null);
  const [pendingChapterNumber, setPendingChapterNumber] = useState<number | null>(null);
  const [pendingChapterName, setPendingChapterName] = useState<string | null>(null);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [emailPromptIntent, setEmailPromptIntent] = useState<"default" | "pricing">("default");
  const [emailPromptLoading, setEmailPromptLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [getStartedPreselectedSlug, setGetStartedPreselectedSlug] = useState<string | null>(null);

  useEffect(() => {
    trackPageView("staging_landing");
    const stored = sessionStorage.getItem("student_email");
    if (stored) setCapturedEmail(stored);
  }, [trackPageView]);

  /** Resolve email + course. Returns celebration data for in-modal display, or null if we navigated/skipped. */
  const resolveEmail = async (email: string, course: CtaCourse): Promise<CelebrationData | null> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return null;

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
      if (data?.is_test_mode) {
        sessionStorage.setItem("sa_test_mode", "true");
        sessionStorage.setItem("sa_email_override", data.email_override || "");
      }

      // Increment campus enrollment count + capture lead for .edu submissions.
      const universityDomain = trimmed.split("@")[1] || null;
      const universityName = (data?.campus_name as string | undefined) ?? null;
      let campusSignupNumber: number | null = (data?.student_number as number | undefined) ?? null;

      if (universityDomain) {
        try {
          const { data: existing } = await supabase
            .from("campus_enrollments")
            .select("enrollment_count")
            .eq("university_domain", universityDomain)
            .maybeSingle();
          const nextCount = (existing?.enrollment_count ?? 0) + 1;
          await supabase
            .from("campus_enrollments")
            .upsert(
              {
                university_domain: universityDomain,
                university_name: universityName,
                enrollment_count: nextCount,
              },
              { onConflict: "university_domain" },
            );
          campusSignupNumber = campusSignupNumber ?? nextCount;
        } catch {
          /* non-blocking */
        }
      }

      try {
        const intentTag = pendingChapterNumber != null
          ? `intent_chapter_${pendingChapterNumber}`
          : `intent_course_${course.slug}`;
        await supabase.from("landing_page_leads").insert({
          email: trimmed,
          email_type: "edu",
          university_name: universityName,
          university_domain: universityDomain,
          course_slug: course.slug,
          intent_tag: intentTag,
          campus_signup_number: campusSignupNumber,
          source: "landing_page",
        });
      } catch {
        /* non-blocking */
      }

      // Ole Miss skips the founding-student modal entirely — straight to preview.
      if (data?.campus_slug === "ole-miss") {
        setEmailPromptOpen(false);
        const chapterSuffix = pendingChapterNumber != null ? `/${pendingChapterNumber}` : "";
        navigate(`/campus/${data.campus_slug}/${course.slug}${chapterSuffix}`);
        return null;
      }

      return data as CelebrationData;
    } catch {
      toast.error("Something went wrong. Try again.");
      return null;
    } finally {
      setResolving(false);
    }
  };

  /** Card / CTA click handler. */
  const handleCardClick = async (course: CtaCourse) => {
    setPendingCourse(course);
    setPendingChapterNumber(null);
    setPendingChapterName(null);
    if (capturedEmail) {
      const data = await resolveEmail(capturedEmail, course);
      if (data) navigate(`/campus/${data.campus_slug}/${course.slug}`);
    } else {
      setEmailPromptIntent("default");
      setEmailPromptOpen(true);
    }
  };

  /** Chapter row click — same flow but routes to specific chapter. */
  const handleChapterClick = async (course: CtaCourse, chapterNumber: number, chapterName?: string) => {
    setPendingCourse(course);
    setPendingChapterNumber(chapterNumber);
    setPendingChapterName(chapterName ?? null);
    if (capturedEmail) {
      const data = await resolveEmail(capturedEmail, course);
      if (data) navigate(`/campus/${data.campus_slug}/${course.slug}/${chapterNumber}`);
    } else {
      setEmailPromptIntent("default");
      setEmailPromptOpen(true);
    }
  };

  const handleContinue = (data: CelebrationData) => {
    if (!pendingCourse) return;
    setEmailPromptOpen(false);
    if (pendingChapterNumber != null) {
      navigate(`/campus/${data.campus_slug}/${pendingCourse.slug}/${pendingChapterNumber}`);
    } else {
      navigate(`/campus/${data.campus_slug}/${pendingCourse.slug}`);
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

      {/* Spacer for staging banner */}
      <div style={{ height: 24 }} />

      <StagingNavbar
        onCtaClick={() => handleCardClick(defaultCourse)}
        onPricingClick={() => navigate("/get-access")}
      />

      <StagingHero
        liveCourse={defaultCourse}
        futureCourses={[]}
        onLiveCourseClick={() => handleCardClick(defaultCourse)}
        onNotifyClick={() => handleCardClick(defaultCourse)}
        onGetStartedClick={() => {
          setGetStartedPreselectedSlug(null);
          setGetStartedOpen(true);
        }}
      />

      <StagingTestimonialsSection onCtaClick={() => handleCardClick(defaultCourse)} />

      <StagingFeatureCardsSection
        onBrowseTools={() => handleCardClick(defaultCourse)}
        onBrowseProblems={() => handleCardClick(defaultCourse)}
        onRequestEarlyAccess={() => handleCardClick(defaultCourse)}
      />

      <div ref={coursesRef}>
        <StagingCoursesSection
          courses={COURSES}
          onCardClick={handleCardClick}
          onChapterClick={handleChapterClick}
          onGetStartedClick={(slug) => {
            setGetStartedPreselectedSlug(slug);
            setGetStartedOpen(true);
          }}
        />
      </div>

      <div ref={contactRef}>
        <ContactForm />
      </div>

      <LandingFooter
        onScrollToCourses={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
        onScrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <StagingEmailPromptModal
        open={emailPromptOpen}
        onClose={() => {
          setEmailPromptOpen(false);
          setEmailPromptIntent("default");
        }}
        onSubmit={(email) => (pendingCourse ? resolveEmail(email, pendingCourse) : Promise.resolve(null))}
        onContinue={handleContinue}
        courseName={pendingCourse?.name}
        chapterNumber={pendingChapterNumber}
        chapterName={pendingChapterName}
        loading={emailPromptLoading || resolving}
        intent={emailPromptIntent}
      />

      <StagingGetStartedModal
        open={getStartedOpen}
        onClose={() => setGetStartedOpen(false)}
        courses={COURSES}
        preselectedCourseSlug={getStartedPreselectedSlug}
        onSubmit={async (email, course) => {
          setPendingCourse(course);
          setPendingChapterNumber(null);
          const data = await resolveEmail(email, course);
          if (data) {
            setGetStartedOpen(false);
            navigate(`/campus/${data.campus_slug}/${course.slug}`);
          }
        }}
      />
    </div>
  );
}
