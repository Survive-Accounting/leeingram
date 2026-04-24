import { useState } from "react";
// (icon imports removed — no longer used)
import leeHeadshot from "@/assets/lee-headshot-original.png";
import { AboutLeeModal } from "@/components/AboutLeeModal";

const RED = "#CE1126";
const NAVY = "#14213D";

interface Course {
  id: string;
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  status: "live" | "upcoming" | "future";
  slug: string;
}

interface StagingHeroProps {
  liveCourse: Course;
  futureCourses: Course[];
  onLiveCourseClick: () => void;
  onNotifyClick: (course: Course) => void;
  onGetStartedClick?: () => void;
}

export default function StagingHero({ onGetStartedClick }: StagingHeroProps) {
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleSeeHowItWorks = () => {
    const el = document.getElementById("exam-coming-up");
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden staging-hero isolate"
      style={{
        background: [
          "radial-gradient(circle at 50% 35%, rgba(191,219,254,0.45), transparent 45%)",
          "radial-gradient(circle at 50% 72%, rgba(220,38,38,0.08), transparent 35%)",
          "linear-gradient(180deg, #EEF6FF 0%, #F8FAFC 55%, #FFFFFF 100%)",
        ].join(", "),
      }}
    >
      <style>{`
        .staging-hero {
          min-height: 88vh;
          display: flex;
          align-items: center;
        }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 48px; padding-bottom: 72px; display: block; }
        }

        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes heroBtnIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes headshotIn {
          from { opacity: 0; transform: scale(0.92) translateY(0); filter: blur(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0);    filter: blur(0); }
        }
        @keyframes headshotFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        .hero-anim-headshot-img {
          opacity: 0;
          animation: headshotIn 1.2s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;
          transition: opacity 0.5s ease;
        }
        .hero-anim-headshot-img.is-loaded ~ .headshot-skeleton { opacity: 0; }
        .hero-anim-headshot { animation: headshotFloat 6s ease-in-out 1.5s infinite; }
        .hero-anim-eyebrow  { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.18s forwards; }
        .hero-anim-headline { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.32s forwards; }
        .hero-anim-sub      { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s forwards; }
        .hero-anim-btn      { opacity: 0; animation: heroBtnIn  0.55s cubic-bezier(0.34,1.56,0.64,1) 0.7s forwards; }
        .hero-anim-link     { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.95s forwards; }

        @media (prefers-reduced-motion: reduce) {
          .hero-anim-headshot, .hero-anim-eyebrow, .hero-anim-headline, .hero-anim-sub, .hero-anim-btn, .hero-anim-link {
            opacity: 1 !important;
            animation: none !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-[760px] px-4 sm:px-6 py-10 md:py-24 w-full">
        <div className="flex flex-col items-center text-center">
          {/* Headshot — opens About modal */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About Lee Ingram"
            className="hero-anim-headshot mb-5 rounded-full transition-transform hover:-translate-y-0.5 hover:scale-[1.03]"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div
              className="rounded-full overflow-hidden"
              style={{
                width: 120,
                height: 120,
                border: "3px solid #FFFFFF",
                boxShadow:
                  "0 8px 24px rgba(20,33,61,0.18), 0 0 0 1px rgba(20,33,61,0.06)",
                background: "#fff",
              }}
            >
              <img
                src={leeHeadshot}
                alt="Lee Ingram"
                className="w-full h-full object-cover"
                style={{ objectPosition: "center 15%" }}
              />
            </div>
          </button>

          {/* Identity — entire line is the About link */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="hero-anim-eyebrow mb-8 text-[13px] font-semibold transition-colors"
            style={{
              color: NAVY,
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            Built by{" "}
            <span className="underline decoration-[1px] underline-offset-[3px] decoration-[rgba(20,33,61,0.25)] group-hover:decoration-[rgba(20,33,61,0.7)]">
              Lee Ingram
            </span>
          </button>

          {/* Headline */}
          <h1
            className="leading-[1.08] tracking-tight text-[36px] sm:text-[48px] md:text-[58px] hero-anim-headline"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
              color: NAVY,
              maxWidth: 720,
            }}
          >
            Accounting study tools that get you unstuck — fast.
          </h1>

          {/* Subtext */}
          <p
            className="mt-5 hero-anim-sub"
            style={{
              color: "#334155",
              fontFamily: "Inter, sans-serif",
              fontSize: "17px",
              lineHeight: 1.55,
              maxWidth: 600,
            }}
          >
            Study tools for Intro &amp; Intermediate Accounting covering every chapter.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-5">
            <button
              onClick={onGetStartedClick}
              className="hero-anim-btn rounded-xl px-9 py-4 text-[16px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                fontFamily: "Inter, sans-serif",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 28px rgba(206,17,38,0.35)",
                letterSpacing: "0.01em",
              }}
            >
              Start Studying
            </button>

            <button
              onClick={handleSeeHowItWorks}
              className="hero-anim-link text-[13px] font-medium transition-colors hover:underline underline-offset-4"
              style={{
                color: "rgba(20,33,61,0.72)",
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              See how it works ↓
            </button>
          </div>
        </div>
      </div>

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </section>
  );
}
