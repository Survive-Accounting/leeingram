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
    // Scroll to the demo / courses section.
    const el =
      document.getElementById("demo-section") ||
      document.getElementById("courses-section") ||
      document.getElementById("exam-coming-up");
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden staging-hero isolate"
      style={{ background: "#0A2A57" }}
    >
      {/* Stripe-style angled color ribbons */}
      <div
        aria-hidden="true"
        className="staging-hero-ribbons"
      >
        <div className="ribbon ribbon-1" />
        <div className="ribbon ribbon-2" />
        <div className="ribbon ribbon-3" />
        <div className="ribbon ribbon-4" />
        <div className="ribbon ribbon-5" />
        <div className="ribbon ribbon-6" />
        <div className="ribbon ribbon-7" />
      </div>

      {/* Bottom fade — softens hero → next section */}
      <div className="staging-hero-overlay-bottom" aria-hidden="true" />

      <style>{`
        .staging-hero {
          min-height: 88vh;
          display: flex;
          align-items: center;
        }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 48px; padding-bottom: 72px; display: block; }
        }

        .staging-hero-overlay-bottom {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 220px;
          background: linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.4) 50%, #FFFFFF 100%);
          z-index: 5;
          pointer-events: none;
        }

        /* ── Stripe-style angled color ribbons ─────────────────── */
        .staging-hero-ribbons {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          overflow: hidden;
        }
        .ribbon {
          position: absolute;
          pointer-events: none;
          will-change: transform;
          transform-origin: bottom right;
          mix-blend-mode: screen;
        }
        .ribbon-1 {
          width: 1400px;
          height: 280px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,40,70,0) 10%, rgba(255,50,80,0.95) 50%, rgba(255,90,70,0.75) 80%, transparent 100%);
          bottom: -80px;
          right: -200px;
          transform: rotate(-42deg);
          filter: blur(45px);
          animation: ribbonSweep1 14s ease-in-out infinite alternate;
        }
        .ribbon-2 {
          width: 1200px;
          height: 220px;
          background: linear-gradient(90deg, transparent 0%, rgba(220,40,90,0) 15%, rgba(230,50,110,0.85) 55%, rgba(255,80,140,0.6) 80%, transparent 100%);
          bottom: -40px;
          right: -180px;
          transform: rotate(-32deg);
          filter: blur(55px);
          animation: ribbonSweep2 18s ease-in-out infinite alternate;
        }
        .ribbon-3 {
          width: 1100px;
          height: 200px;
          background: linear-gradient(90deg, transparent 0%, rgba(180,10,30,0) 15%, rgba(180,10,30,0.55) 50%, rgba(150,10,25,0.35) 80%, transparent 100%);
          bottom: 60px;
          right: -160px;
          transform: rotate(-22deg);
          filter: blur(60px);
          animation: ribbonSweep3 22s ease-in-out infinite alternate;
        }
        .ribbon-4 {
          width: 1000px;
          height: 180px;
          background: linear-gradient(90deg, transparent 0%, rgba(206,17,38,0) 20%, rgba(206,17,38,0.5) 55%, rgba(180,10,30,0.3) 80%, transparent 100%);
          bottom: 160px;
          right: -140px;
          transform: rotate(-12deg);
          filter: blur(65px);
          animation: ribbonSweep4 26s ease-in-out infinite alternate;
        }
        .ribbon-5 {
          width: 900px;
          height: 160px;
          background: linear-gradient(90deg, transparent 0%, rgba(80,160,255,0) 20%, rgba(100,180,255,0.7) 55%, rgba(140,210,255,0.5) 80%, transparent 100%);
          top: 40px;
          right: -120px;
          transform: rotate(8deg);
          filter: blur(70px);
          animation: ribbonSweep5 30s ease-in-out infinite alternate;
        }
        /* Powder blue sweeps from the LEFT — modern, fresh accent */
        .ribbon-6 {
          width: 1300px;
          height: 240px;
          background: linear-gradient(90deg, transparent 0%, rgba(170,220,255,0) 15%, rgba(170,220,255,0.75) 55%, rgba(120,200,255,0.55) 80%, transparent 100%);
          top: 20%;
          left: -300px;
          transform-origin: bottom left;
          transform: rotate(18deg);
          filter: blur(60px);
          animation: ribbonSweep6 24s ease-in-out infinite alternate;
        }
        .ribbon-7 {
          width: 1100px;
          height: 200px;
          background: linear-gradient(90deg, transparent 0%, rgba(140,200,255,0) 15%, rgba(150,210,255,0.65) 55%, rgba(180,230,255,0.45) 80%, transparent 100%);
          bottom: 10%;
          left: -250px;
          transform-origin: bottom left;
          transform: rotate(-8deg);
          filter: blur(70px);
          animation: ribbonSweep7 28s ease-in-out infinite alternate;
        }
        @keyframes ribbonSweep1 {
          0%   { transform: rotate(-42deg) translate(0px, 0px); opacity: 0.95; }
          50%  { transform: rotate(-38deg) translate(-60px, -30px); opacity: 1; }
          100% { transform: rotate(-44deg) translate(-20px, -50px); opacity: 0.9; }
        }
        @keyframes ribbonSweep2 {
          0%   { transform: rotate(-32deg) translate(0px, 0px); opacity: 0.9; }
          50%  { transform: rotate(-28deg) translate(-80px, -20px); opacity: 1; }
          100% { transform: rotate(-35deg) translate(-40px, -60px); opacity: 0.8; }
        }
        @keyframes ribbonSweep3 {
          0%   { transform: rotate(-22deg) translate(0px, 0px); opacity: 0.85; }
          50%  { transform: rotate(-18deg) translate(-100px, -10px); opacity: 0.95; }
          100% { transform: rotate(-25deg) translate(-50px, -80px); opacity: 0.75; }
        }
        @keyframes ribbonSweep4 {
          0%   { transform: rotate(-12deg) translate(0px, 0px); opacity: 0.8; }
          50%  { transform: rotate(-8deg) translate(-120px, 10px); opacity: 0.9; }
          100% { transform: rotate(-15deg) translate(-60px, -40px); opacity: 0.7; }
        }
        @keyframes ribbonSweep5 {
          0%   { transform: rotate(8deg) translate(0px, 0px); opacity: 0.75; }
          50%  { transform: rotate(12deg) translate(-80px, 20px); opacity: 0.9; }
          100% { transform: rotate(5deg) translate(-40px, -20px); opacity: 0.65; }
        }
        @keyframes ribbonSweep6 {
          0%   { transform: rotate(18deg) translate(0px, 0px); opacity: 0.85; }
          50%  { transform: rotate(22deg) translate(60px, 20px); opacity: 0.95; }
          100% { transform: rotate(15deg) translate(30px, 50px); opacity: 0.75; }
        }
        @keyframes ribbonSweep7 {
          0%   { transform: rotate(-8deg) translate(0px, 0px); opacity: 0.75; }
          50%  { transform: rotate(-4deg) translate(80px, -20px); opacity: 0.9; }
          100% { transform: rotate(-12deg) translate(40px, 30px); opacity: 0.65; }
        }
        @media (max-width: 768px) {
          .ribbon-1 { width: 700px; height: 140px; }
          .ribbon-2 { width: 600px; height: 110px; }
          .ribbon-3 { width: 550px; height: 100px; }
          .ribbon-4 { width: 500px; height: 90px; }
          .ribbon-5 { width: 450px; height: 80px; }
          .ribbon-6 { width: 650px; height: 130px; }
          .ribbon-7 { width: 550px; height: 110px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ribbon { animation: none !important; }
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
            AI-powered exam prep for Intro &amp; Intermediate Accounting. Built from 10+ years of tutoring. Designed for what actually shows up on exams.
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
