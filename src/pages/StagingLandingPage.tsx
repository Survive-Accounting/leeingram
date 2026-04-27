// PRIMARY LANDING PAGE — edit this file (rendered at "/" and "/staging")
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
import TestFlowToolbar from "@/components/TestFlowToolbar";
import { StyleExportToolbar } from "@/components/StyleExportToolbar";

import StagingCoursesSection from "@/components/landing/StagingCoursesSection";

import StagingEmailPromptModal, { type CelebrationData } from "@/components/landing/StagingEmailPromptModal";

import StagingGetStartedModal from "@/components/landing/StagingGetStartedModal";
import StagingFinalCtaSection from "@/components/landing/StagingFinalCtaSection";
import type { CtaCourse } from "@/components/landing/StagingCtaModal";
import { useEmailGate } from "@/contexts/EmailGateContext";

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
  const { requestAccess } = useEmailGate();
  // Founding-student / non-edu flow handled by StagingEmailPromptModal directly.
  const contactRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const { trackPageView, trackEvent } = useEventTracking();

  const [capturedEmail, setCapturedEmail] = useState<string>("");
  const [pendingCourse, setPendingCourse] = useState<CtaCourse | null>(null);
  const [pendingChapterNumber, setPendingChapterNumber] = useState<number | null>(null);
  const [pendingChapterName, setPendingChapterName] = useState<string | null>(null);
  const [pendingDestination, setPendingDestination] = useState<"preview" | "checkout">("preview");
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [emailPromptIntent, setEmailPromptIntent] = useState<"default" | "pricing">("default");
  const [emailPromptLoading, setEmailPromptLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [getStartedPreselectedSlug, setGetStartedPreselectedSlug] = useState<string | null>(null);
  const [coursesRevealed, setCoursesRevealed] = useState(false);

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

      // Build destination URL based on pendingDestination
      const buildPath = (campusSlug: string, n?: number) => {
        if (pendingDestination === "checkout") {
          const params = new URLSearchParams({
            campus: campusSlug,
            course: course.slug,
            email: trimmed,
          });
          if (n != null) params.set("n", String(n));
          return `/get-access?${params.toString()}`;
        }
        const chapterSuffix = pendingChapterNumber != null ? `/${pendingChapterNumber}` : "";
        return `/campus/${campusSlug}/${course.slug}${chapterSuffix}`;
      };

      // Ole Miss skips the founding-student modal entirely.
      if (data?.campus_slug === "ole-miss") {
        setEmailPromptOpen(false);
        navigate(buildPath("ole-miss", data?.student_number));
        return null;
      }

      // Checkout intent: skip in-modal celebration; show it on /get-access instead.
      if (pendingDestination === "checkout" && data?.campus_slug) {
        setEmailPromptOpen(false);
        navigate(buildPath(data.campus_slug, (data as CelebrationData)?.student_number));
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

  /** Card / CTA click handler — preview destination. */
  const handleCardClick = async (course: CtaCourse) => {
    setPendingCourse(course);
    setPendingChapterNumber(null);
    setPendingChapterName(null);
    setPendingDestination("preview");
    if (capturedEmail) {
      const data = await resolveEmail(capturedEmail, course);
      if (data) navigate(`/campus/${data.campus_slug}/${course.slug}`);
    } else {
      setEmailPromptIntent("default");
      setEmailPromptOpen(true);
    }
  };

  /** Get-access / Get-started CTA — checkout destination. */
  const handleGetAccessClick = async (course: CtaCourse) => {
    setPendingCourse(course);
    setPendingChapterNumber(null);
    setPendingChapterName(null);
    setPendingDestination("checkout");
    if (capturedEmail) {
      const data = await resolveEmail(capturedEmail, course);
      if (data) {
        const params = new URLSearchParams({
          campus: data.campus_slug,
          course: course.slug,
          email: capturedEmail,
        });
        if (data.student_number != null) params.set("n", String(data.student_number));
        navigate(`/get-access?${params.toString()}`);
      }
    } else {
      setEmailPromptIntent("pricing");
      setEmailPromptOpen(true);
    }
  };

  /** Chapter row click — preview destination. */
  const handleChapterClick = async (course: CtaCourse, chapterNumber: number, chapterName?: string) => {
    setPendingCourse(course);
    setPendingChapterNumber(chapterNumber);
    setPendingChapterName(chapterName ?? null);
    setPendingDestination("preview");
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
    if (pendingDestination === "checkout") {
      const params = new URLSearchParams({
        campus: data.campus_slug,
        course: pendingCourse.slug,
        email: capturedEmail,
      });
      if (data.student_number != null) params.set("n", String(data.student_number));
      navigate(`/get-access?${params.toString()}`);
      return;
    }
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
    <div data-export-page className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8FAFC" }}>
      <TestFlowToolbar />

      <div data-export-id="navbar" data-export-label="Navbar">
        <StagingNavbar
          transparentOnTop
          onCtaClick={() => requestAccess({ course: defaultCourse.slug })}
          onPricingClick={() => handleGetAccessClick(defaultCourse)}
          onCoursesClick={() => coursesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </div>

      <div data-export-id="hero" data-export-label="Hero">
        <StagingHero
          liveCourse={defaultCourse}
          futureCourses={[]}
          onLiveCourseClick={() => requestAccess({ course: defaultCourse.slug })}
          onNotifyClick={() => handleCardClick(defaultCourse)}
          onGetStartedClick={() => requestAccess({ course: defaultCourse.slug })}
        />
      </div>

      <div data-export-id="social-proof" data-export-label="Social Proof Strip">
        <SocialProofStrip />
      </div>

      <div data-export-id="testimonials" data-export-label="Testimonials">
        <StagingTestimonialsSection onCtaClick={() => requestAccess({ course: defaultCourse.slug })} />
      </div>

      <div ref={coursesRef} id="demo-section" data-export-id="courses" data-export-label="Courses Grid">
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

      {/* Gradient bridge: demo (gray) → final CTA (red) — extended for a softer fade */}
      <div
        aria-hidden="true"
        style={{
          height: 160,
          background:
            "linear-gradient(to bottom, #F3F4F6 0%, #F0D8DC 45%, #E07A85 75%, #D81221 100%)",
        }}
      />

      <div data-export-id="final-cta" data-export-label="Final CTA">
        <StagingFinalCtaSection
          onGetAccessClick={() => requestAccess({ course: defaultCourse.slug })}
          onTryDemoClick={() => coursesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </div>

      <div ref={contactRef} id="contact-form" data-export-id="contact" data-export-label="Contact Form">
        <ContactForm />
      </div>

      <div data-export-id="footer" data-export-label="Footer">
        <LandingFooter
          onScrollToCourses={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })}
          onScrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })}
          onPricingClick={() => handleCardClick(defaultCourse)}
        />
      </div>

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

// Floating glass-pill strip — beta framing (no fake user counts)
function SocialProofStrip() {
  const NAVY = "#14213D";
  return (
    <div
      className="relative px-4"
      style={{
        marginTop: -12,
        marginBottom: 8,
        zIndex: 5,
      }}
    >
      <style>{`
        @keyframes proofFloatIn {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .proof-line {
          animation: proofFloatIn 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .proof-line { animation: none; }
        }
      `}</style>

      <p
        className="proof-line mx-auto text-center"
        style={{
          maxWidth: 640,
          fontFamily: "Inter, sans-serif",
          fontSize: 15,
          lineHeight: 1.55,
          color: NAVY,
          fontWeight: 500,
          letterSpacing: "0.005em",
        }}
      >
        Built from thousands of hours of accounting tutoring. Now we’re turning that into a faster cram tool.
      </p>
    </div>
  );
}

