// Greek Orgs landing — clone of StagingLandingPage with Greek-org counter line
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StagingNavbar from "@/components/landing/StagingNavbar";
import StagingTestimonialsSection from "@/components/landing/StagingTestimonialsSection";
import ContactForm from "@/components/landing/ContactForm";
import LandingFooter from "@/components/landing/LandingFooter";
import { useEventTracking, setStoredEmail } from "@/hooks/useEventTracking";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StagingCoursesSection from "@/components/landing/StagingCoursesSection";
import ClosingCtaSection from "@/components/landing/ClosingCtaSection";
import StagingWaitlistModal from "@/components/landing/StagingWaitlistModal";
import StagingEmailPromptModal, { type CelebrationData } from "@/components/landing/StagingEmailPromptModal";
import StagingStickyBar from "@/components/landing/StagingStickyBar";
import type { CtaCourse } from "@/components/landing/StagingCtaModal";

const RED = "#CE1126";
const NAVY = "#14213D";
const HERO_IMAGE = "https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg";

const GREEK_ORG_PARTNER_COUNT = 3; // placeholder — wire to greek_org_purchases later

const COURSES: CtaCourse[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Intro Accounting 1", subtext: "Financial Principles", availability: "", cta: "Start Studying →", status: "live", slug: "intro-accounting-1" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Intro Accounting 2", subtext: "Managerial Principles", availability: "", cta: "Start Studying →", status: "live", slug: "intro-accounting-2" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Intermediate Accounting 1", availability: "", cta: "Start Studying →", status: "live", slug: "intermediate-accounting-1" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Intermediate Accounting 2", availability: "", cta: "Start Studying →", status: "live", slug: "intermediate-accounting-2" },
];

const OLE_MISS_DOMAINS = ["olemiss.edu", "go.olemiss.edu"];
function isTestOleMissEmail(email: string): boolean {
  return /^lee\+[^@]+@survivestudios\.com$/.test(email.trim().toLowerCase());
}
function isOleMissEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  if (isTestOleMissEmail(lower)) return true;
  const domain = lower.split("@")[1] || "";
  return OLE_MISS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

// Inline hero — identical to StagingHero except the counter line speaks to Greek orgs.
function GreekHero({ onGetStartedClick }: { onGetStartedClick?: () => void }) {
  return (
    <section className="relative w-full overflow-hidden staging-hero">
      <style>{`
        .staging-hero { min-height: 480px; }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 32px; padding-bottom: 40px; }
        }
        .staging-hero::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url('${HERO_IMAGE}');
          background-size: cover; background-position: 60% 40%;
          background-repeat: no-repeat; transform: scaleX(-1); z-index: 0;
        }
        .staging-hero::after {
          content: ''; position: absolute; inset: 0;
          background: ${NAVY}; opacity: 0.65; z-index: 1;
        }
      `}</style>

      <div className="relative z-[3] mx-auto max-w-[1100px] px-4 sm:px-6 py-12 md:py-20">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="w-full md:w-[42%] flex justify-center md:justify-start">
            <img
              src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg"
              alt="Lee Ingram"
              className="w-full max-w-[300px] md:max-w-none rounded-lg shadow-xl"
              style={{ borderRadius: 8 }}
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-white leading-[1.15] tracking-tight text-[28px] sm:text-[36px] md:text-[44px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Your exam is coming.
              <br />
              Let's get you ready.
            </h1>

            <p
              className="mt-5 text-[15px] md:text-[16px] leading-relaxed mx-auto md:mx-0 max-w-[520px]"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif" }}
            >
              I'm Lee Ingram. Ole Miss accounting alum & tutor. I built this out of a love for helping students master their accounting course — not just survive it.
            </p>

            <TooltipProvider delayDuration={150}>
              <div style={{ marginTop: 16, marginBottom: 24 }} className="mx-auto md:mx-0 max-w-[560px] text-center md:text-left">
                <p
                  className="text-[20px] md:text-[24px] leading-snug"
                  style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
                >
                  {GREEK_ORG_PARTNER_COUNT.toLocaleString()}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <sup className="cursor-help" style={{ color: "rgba(255,255,255,0.9)" }}>*</sup>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      * Updates as Greek orgs join. Placeholder until launch.
                    </TooltipContent>
                  </Tooltip>
                  {" "}Greek organizations have partnered with Survive Accounting.{" "}
                  <span style={{ color: RED, fontWeight: 700 }}>Is yours next?</span>
                </p>
              </div>
            </TooltipProvider>

            {onGetStartedClick && (
              <button
                onClick={onGetStartedClick}
                className="mt-2 rounded-lg px-6 py-3 text-[14px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 2px 8px rgba(206,17,38,0.25)" }}
              >
                Get Started →
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GreekLandingPage() {
  const navigate = useNavigate();
  const contactRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const { trackPageView, trackEvent } = useEventTracking();

  const [capturedEmail, setCapturedEmail] = useState<string>("");
  const [pendingCourse, setPendingCourse] = useState<CtaCourse | null>(null);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistInitialEmail, setWaitlistInitialEmail] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    trackPageView("greek_landing");
    const stored = sessionStorage.getItem("student_email");
    if (stored) setCapturedEmail(stored);
  }, [trackPageView]);

  const resolveEmail = async (email: string, course: CtaCourse): Promise<CelebrationData | null> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return null;

    if (!isOleMissEmail(trimmed)) {
      trackEvent("non_ole_miss_email_blocked", {
        email_domain: trimmed.split("@")[1] || "",
        course_slug: course.slug,
      });
      setEmailPromptOpen(false);
      setWaitlistInitialEmail(trimmed);
      setWaitlistOpen(true);
      return null;
    }

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
      return data as CelebrationData;
    } catch {
      toast.error("Something went wrong. Try again.");
      return null;
    } finally {
      setResolving(false);
    }
  };

  const handleCardClick = async (course: CtaCourse) => {
    setPendingCourse(course);
    if (capturedEmail) {
      const data = await resolveEmail(capturedEmail, course);
      if (data) navigate(`/campus/${data.campus_slug}/${course.slug}`);
    } else {
      setEmailPromptOpen(true);
    }
  };

  const handleContinue = (data: CelebrationData) => {
    if (!pendingCourse) return;
    setEmailPromptOpen(false);
    navigate(`/campus/${data.campus_slug}/${pendingCourse.slug}`);
  };

  const defaultCourse =
    COURSES.find((c) => c.slug === "intermediate-accounting-2") || COURSES[0];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      <div style={{ height: 16 }} />

      <StagingNavbar onCtaClick={() => handleCardClick(defaultCourse)} />

      <GreekHero onGetStartedClick={() => coursesRef.current?.scrollIntoView({ behavior: "smooth" })} />

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

      <div className="md:hidden" style={{ height: 110 }} />

      <StagingStickyBar
        onCtaClick={() => handleCardClick(defaultCourse)}
        hidden={emailPromptOpen || waitlistOpen}
      />

      <StagingEmailPromptModal
        open={emailPromptOpen}
        onClose={() => setEmailPromptOpen(false)}
        onSubmit={(email) => (pendingCourse ? resolveEmail(email, pendingCourse) : Promise.resolve(null))}
        onContinue={handleContinue}
        courseName={pendingCourse?.name}
        loading={resolving}
      />

      <StagingWaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        initialEmail={waitlistInitialEmail}
      />
    </div>
  );
}
