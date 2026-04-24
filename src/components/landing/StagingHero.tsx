import { useState } from "react";
// (icon imports removed — no longer used)
import leeHeadshot from "@/assets/lee-headshot-original.png";
import { AboutLeeModal } from "@/components/AboutLeeModal";
import AnimatedArrow from "@/components/landing/AnimatedArrow";

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
  const [imgLoaded, setImgLoaded] = useState(false);

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
      style={{ background: "#002147" }}
    >
      {/* Stripe-style angled color ribbons */}
      <div
        aria-hidden="true"
        className="staging-hero-ribbons pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 2 }}
      >
        <div className="ribbon ribbon-1" />
        <div className="ribbon ribbon-2" />
        <div className="ribbon ribbon-3" />
        <div className="ribbon ribbon-4" />
      </div>

      <style>{`
        .staging-hero {
          min-height: 88vh;
          display: flex;
          align-items: center;
        }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 48px; padding-bottom: 72px; display: block; }
        }

        /* ── Stripe-style angled color ribbons ─────────────────── */
        .ribbon {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          will-change: transform;
          mix-blend-mode: screen;
          opacity: 0.85;
        }
        .ribbon-1 {
          width: 900px;
          height: 700px;
          top: -150px;
          left: -200px;
          background: radial-gradient(ellipse at center, #FF1A2E 0%, rgba(255,26,46,0) 65%);
          transform: rotate(-35deg);
          animation: ribbonDrift1 18s ease-in-out infinite alternate;
        }
        .ribbon-2 {
          width: 800px;
          height: 600px;
          top: 10%;
          right: -150px;
          background: radial-gradient(ellipse at center, #2E5BAA 0%, rgba(46,91,170,0) 65%);
          transform: rotate(-20deg);
          animation: ribbonDrift2 22s ease-in-out infinite alternate;
        }
        .ribbon-3 {
          width: 700px;
          height: 500px;
          bottom: -100px;
          left: 20%;
          background: radial-gradient(ellipse at center, #C41E3A 0%, rgba(196,30,58,0) 65%);
          transform: rotate(-50deg);
          animation: ribbonDrift3 16s ease-in-out infinite alternate;
        }
        .ribbon-4 {
          width: 600px;
          height: 800px;
          bottom: 5%;
          right: 10%;
          background: radial-gradient(ellipse at center, rgba(255,240,200,0.5) 0%, rgba(255,240,200,0) 65%);
          opacity: 0.9;
          animation: ribbonDrift4 20s ease-in-out infinite alternate;
        }
        @keyframes ribbonDrift1 {
          0%   { transform: rotate(-35deg) translate(0px, 0px); }
          100% { transform: rotate(-30deg) translate(-30px, -20px); }
        }
        @keyframes ribbonDrift2 {
          0%   { transform: rotate(-20deg) translate(0px, 0px); }
          100% { transform: rotate(-25deg) translate(-20px, -40px); }
        }
        @keyframes ribbonDrift3 {
          0%   { transform: rotate(-50deg) translate(0px, 0px); }
          100% { transform: rotate(-45deg) translate(-40px, -10px); }
        }
        @keyframes ribbonDrift4 {
          0%   { transform: translate(0px, 0px); }
          100% { transform: translate(-20px, 30px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ribbon { animation: none !important; }
        }
        @media (max-width: 768px) {
          .ribbon-1 { width: 500px; height: 400px; }
          .ribbon-2 { width: 450px; height: 350px; }
          .ribbon-3 { width: 400px; height: 300px; }
          .ribbon-4 { width: 350px; height: 450px; }
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
              className="rounded-full overflow-hidden relative"
              style={{
                width: 120,
                height: 120,
                border: "3px solid #FFFFFF",
                boxShadow:
                  "0 8px 24px rgba(20,33,61,0.18), 0 0 0 1px rgba(20,33,61,0.06)",
                background: "linear-gradient(135deg, #DDE7F5 0%, #C8D6EC 100%)",
              }}
            >
              <img
                src={leeHeadshot}
                alt="Lee Ingram"
                loading="eager"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
                className="w-full h-full object-cover hero-anim-headshot-img"
                style={{
                  objectPosition: "center 15%",
                  opacity: imgLoaded ? undefined : 0,
                }}
              />
            </div>
          </button>

          {/* Identity — entire line is the About link */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="hero-anim-eyebrow mb-8 text-[13px] font-semibold transition-colors"
            style={{
              color: "rgba(255,255,255,0.85)",
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            Built by{" "}
            <span className="underline decoration-[1px] underline-offset-[3px] decoration-[rgba(255,255,255,0.4)] group-hover:decoration-[rgba(255,255,255,0.9)]">
              Lee Ingram
            </span>
          </button>

          {/* Headline */}
          <h1
            className="leading-[1.08] tracking-tight text-[40px] md:text-[64px] hero-anim-headline"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
              color: "#FFFFFF",
              maxWidth: 820,
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}
          >
            Accounting study tools that get you unstuck — fast.
          </h1>

          {/* Subtext */}
          <p
            className="mt-5 hero-anim-sub"
            style={{
              color: "rgba(255,255,255,0.78)",
              fontFamily: "Inter, sans-serif",
              fontSize: "17px",
              lineHeight: 1.55,
              maxWidth: 600,
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}
          >
            AI-powered exam prep for Intro &amp; Intermediate Accounting — built from 10+ years of tutoring. Designed for what actually shows up on exams.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-5">
            <button
              onClick={onGetStartedClick}
              className="group hero-anim-btn rounded-xl px-9 py-4 text-[16px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center justify-center"
              style={{
                background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                fontFamily: "Inter, sans-serif",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 28px rgba(206,17,38,0.35)",
                letterSpacing: "0.01em",
              }}
            >
              Get Started <AnimatedArrow />
            </button>

            <button
              onClick={handleSeeHowItWorks}
              className="hero-anim-link text-[13px] font-medium transition-colors hover:underline underline-offset-4"
              style={{
                color: "rgba(255,255,255,0.7)",
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
