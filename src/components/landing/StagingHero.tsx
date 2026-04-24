import leeHeadshot from "@/assets/lee-headshot-original.png";

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
  const handleSeeHowItWorks = () => {
    const el = document.getElementById("exam-coming-up");
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden staging-hero"
      style={{
        background:
          "linear-gradient(180deg, #EAF2FB 0%, #F5F9FE 45%, #FFFFFF 100%)",
      }}
    >
      {/* Soft radial glow behind headline for depth */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 42%, rgba(120,160,255,0.18) 0%, rgba(206,17,38,0.04) 35%, rgba(255,255,255,0) 70%)",
          filter: "blur(20px)",
        }}
      />

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
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }

        .hero-anim-headshot { opacity: 0; animation: headshotIn 0.7s cubic-bezier(0.16,1,0.3,1) 0s forwards; }
        .hero-anim-eyebrow  { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.18s forwards; }
        .hero-anim-headline { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.32s forwards; }
        .hero-anim-sub      { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s forwards; }
        .hero-anim-btn      { opacity: 0; animation: heroBtnIn  0.55s cubic-bezier(0.34,1.56,0.64,1) 0.7s forwards; }
        .hero-anim-link     { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.9s forwards; }

        @media (prefers-reduced-motion: reduce) {
          .hero-anim-headshot, .hero-anim-eyebrow, .hero-anim-headline, .hero-anim-sub, .hero-anim-btn, .hero-anim-link {
            opacity: 1 !important;
            animation: none !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <div className="relative z-[3] mx-auto max-w-[760px] px-4 sm:px-6 py-10 md:py-24 w-full">
        <div className="flex flex-col items-center text-center">
          {/* Headshot */}
          <div className="hero-anim-headshot mb-6">
            <div
              className="rounded-full overflow-hidden"
              style={{
                width: 72,
                height: 72,
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
          </div>

          {/* Eyebrow */}
          <div
            className="hero-anim-eyebrow inline-block text-[11px] font-semibold uppercase tracking-[0.16em] px-3 py-1 rounded-full mb-7"
            style={{
              color: RED,
              background: "rgba(206,17,38,0.08)",
              border: `1px solid rgba(206,17,38,0.18)`,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Built by a real tutor
          </div>

          {/* Headline */}
          <h1
            className="leading-[1.08] tracking-tight text-[36px] sm:text-[48px] md:text-[58px] hero-anim-headline"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
              color: NAVY,
              maxWidth: 680,
            }}
          >
            Study tools that get you unstuck — fast.
          </h1>

          {/* Subtext */}
          <p
            className="mt-7 hero-anim-sub"
            style={{
              color: "#475569",
              fontFamily: "Inter, sans-serif",
              fontSize: "17px",
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            AI-powered accounting study tools — built by Lee Ingram, Ole Miss alum &amp; tutor since 2015.
          </p>

          {/* CTAs — stacked, centered */}
          <div className="mt-10 flex flex-col items-center gap-4">
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
              Start Studying <span aria-hidden="true">→</span>
            </button>

            <button
              onClick={handleSeeHowItWorks}
              className="hero-anim-link text-[14px] font-semibold transition-opacity hover:opacity-70"
              style={{
                color: NAVY,
                fontFamily: "Inter, sans-serif",
                background: "none",
                border: "none",
                padding: "4px 4px",
              }}
            >
              See how it works
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
