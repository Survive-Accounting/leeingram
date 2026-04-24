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
          "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 60%, #F1F5F9 100%)",
      }}
    >
      <style>{`
        .staging-hero {
          min-height: 85vh;
          display: flex;
          align-items: center;
        }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 24px; padding-bottom: 48px; display: block; }
        }

        /* Entrance animations */
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes heroBtnIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
          50%      { transform: translateY(-10px) rotate(var(--rot, 0deg)); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(20px) rotate(var(--rot, 0deg)) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    rotate(var(--rot, 0deg)) scale(1); }
        }

        .hero-anim-eyebrow { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s forwards; }
        .hero-anim-headline { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.25s forwards; }
        .hero-anim-sub      { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.45s forwards; }
        .hero-anim-btn      { opacity: 0; animation: heroBtnIn  0.55s cubic-bezier(0.34,1.56,0.64,1) 0.65s forwards; }
        .hero-anim-link     { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.85s forwards; }
        .hero-anim-cards-label { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.4s forwards; }

        .product-card {
          opacity: 0;
          animation:
            cardFadeIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards,
            cardFloat 7s ease-in-out infinite;
          will-change: transform;
        }
        /* Coordinated, slow float — same duration, slight delay stagger */
        .product-card-1 { --rot: -3deg; animation-delay: 0.5s, 1.2s;  animation-duration: 0.7s, 9s; }
        .product-card-2 { --rot: 2deg;  animation-delay: 0.7s, 1.6s;  animation-duration: 0.7s, 9s; }
        .product-card-3 { --rot: -2deg; animation-delay: 0.9s, 2.0s;  animation-duration: 0.7s, 9s; }

        @media (prefers-reduced-motion: reduce) {
          .hero-anim-eyebrow, .hero-anim-headline, .hero-anim-sub, .hero-anim-btn, .hero-anim-link, .hero-anim-cards-label,
          .product-card, .product-card-1, .product-card-2, .product-card-3 {
            opacity: 1 !important;
            animation: none !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <div className="relative z-[3] mx-auto max-w-[1180px] px-4 sm:px-6 py-8 md:py-20 w-full">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-6">
          {/* LEFT — Copy */}
          <div className="flex-1 w-full text-center md:text-left" style={{ maxWidth: 540 }}>
            <div
              className="hero-anim-eyebrow inline-block text-[11px] font-semibold uppercase tracking-[0.14em] px-3 py-1 rounded-full mb-5"
              style={{
                color: RED,
                background: "rgba(206,17,38,0.08)",
                border: `1px solid rgba(206,17,38,0.18)`,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Built by a real tutor
            </div>

            <h1
              className="leading-[1.1] tracking-tight text-[34px] sm:text-[42px] md:text-[48px] hero-anim-headline"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
                color: NAVY,
              }}
            >
              Study tools that get you unstuck — fast.
            </h1>

            <p
              className="mt-5 hero-anim-sub"
              style={{
                color: "#475569",
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
                lineHeight: 1.6,
              }}
            >
              AI-powered accounting study tools — built by Lee Ingram, Ole Miss alum & tutor helping students nationwide.
            </p>

            <div className="mt-8 hero-anim-btn flex flex-col items-center md:items-start gap-3">
              <button
                onClick={onGetStartedClick}
                className="rounded-xl px-8 py-3.5 text-[16px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                  fontFamily: "Inter, sans-serif",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 24px rgba(206,17,38,0.35)",
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

          {/* RIGHT — Product visual */}
          <div className="flex-1 w-full flex flex-col items-center md:items-start justify-center md:-ml-4 lg:-ml-8" style={{ minHeight: 480 }}>
            <div
              className="hero-anim-cards-label w-full text-center md:text-left mb-4"
              style={{ maxWidth: 480, paddingLeft: 8 }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "#94A3B8", fontFamily: "Inter, sans-serif" }}
              >
                What you'll use →
              </span>
            </div>
            <div
              className="relative w-full"
              style={{ maxWidth: 480, height: 420 }}
            >
              {/* Soft glow backdrop */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 45% 50%, rgba(206,17,38,0.10) 0%, rgba(20,33,61,0) 65%)",
                  filter: "blur(20px)",
                }}
              />

              {/* Card 1 — Journal Entries / Flashcards */}
              <div
                className="product-card product-card-1 absolute"
                style={{
                  top: 0,
                  left: 0,
                  width: 270,
                  background: "#FFFFFF",
                  borderRadius: 16,
                  padding: "26px 24px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 14px 36px rgba(15,23,42,0.14), 0 4px 8px rgba(15,23,42,0.06)",
                  fontFamily: "'DM Serif Display', serif",
                  zIndex: 2,
                }}
              >
                <div className="text-[26px] leading-tight" style={{ color: NAVY }}>
                  Journal Entries
                </div>
                <div className="mt-2 text-[16px]" style={{ color: RED, fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                  Flashcards
                </div>
              </div>

              {/* Card 2 — Practice Problems / Formulas (overlaps card 1) */}
              <div
                className="product-card product-card-2 absolute"
                style={{
                  top: 110,
                  right: 0,
                  width: 280,
                  background: NAVY,
                  borderRadius: 16,
                  padding: "26px 24px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 18px 44px rgba(20,33,61,0.38), 0 4px 8px rgba(20,33,61,0.2)",
                  fontFamily: "'DM Serif Display', serif",
                  zIndex: 3,
                }}
              >
                <div className="text-[26px] leading-tight" style={{ color: "#FFFFFF" }}>
                  Practice Problems
                </div>
                <div className="mt-2 text-[16px]" style={{ color: "#FCA5A5", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                  Formulas
                </div>
              </div>

              {/* Card 3 — Cram Videos (overlaps card 2) */}
              <div
                className="product-card product-card-3 absolute"
                style={{
                  bottom: 0,
                  left: 40,
                  width: 280,
                  background: "#FFFFFF",
                  borderRadius: 16,
                  padding: "26px 24px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 14px 36px rgba(15,23,42,0.14), 0 4px 8px rgba(15,23,42,0.06)",
                  fontFamily: "'DM Serif Display', serif",
                  zIndex: 2,
                }}
              >
                <div className="text-[26px] leading-tight" style={{ color: NAVY }}>
                  Cram Videos
                </div>
                <div className="mt-2 text-[14px]" style={{ color: "#64748B", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                  New content added weekly
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
