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
          50%      { transform: translateY(-8px) rotate(var(--rot, 0deg)); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(20px) rotate(var(--rot, 0deg)) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    rotate(var(--rot, 0deg)) scale(1); }
        }

        .hero-anim-eyebrow { opacity: 0; animation: heroFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s forwards; }
        .hero-anim-headline { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.25s forwards; }
        .hero-anim-sub      { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.45s forwards; }
        .hero-anim-bullets  { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.6s forwards; }
        .hero-anim-btn      { opacity: 0; animation: heroBtnIn  0.55s cubic-bezier(0.34,1.56,0.64,1) 0.8s forwards; }

        .product-card {
          opacity: 0;
          animation:
            cardFadeIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards,
            cardFloat 6s ease-in-out infinite;
          will-change: transform;
        }
        .product-card-1 { --rot: -3deg; animation-delay: 0.5s, 1.2s; }
        .product-card-2 { --rot: 2deg;  animation-delay: 0.7s, 1.5s; }
        .product-card-3 { --rot: -2deg; animation-delay: 0.9s, 1.8s; }

        @media (prefers-reduced-motion: reduce) {
          .hero-anim-eyebrow, .hero-anim-headline, .hero-anim-sub, .hero-anim-bullets, .hero-anim-btn,
          .product-card, .product-card-1, .product-card-2, .product-card-3 {
            opacity: 1 !important;
            animation: none !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <div className="relative z-[3] mx-auto max-w-[1180px] px-4 sm:px-6 py-8 md:py-20 w-full">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-12">
          {/* LEFT — Copy */}
          <div className="flex-1 w-full text-center md:text-left" style={{ maxWidth: 560 }}>
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
              AI-powered accounting study tools built by a real tutor — for students who want to do more than just survive their exam.
            </p>

            <ul
              className="mt-6 space-y-2.5 hero-anim-bullets text-left inline-block md:block"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {[
                "Practice real exam-style problems",
                "Understand it — not just memorize it",
                "Built for the night before your test",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5" style={{ color: "#1E293B", fontSize: "14.5px" }}>
                  <span
                    className="shrink-0 mt-[7px] inline-block rounded-full"
                    style={{ width: 6, height: 6, background: RED }}
                    aria-hidden="true"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 hero-anim-btn flex flex-col sm:flex-row items-center md:items-start sm:items-center gap-3 sm:gap-5 justify-center md:justify-start">
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
                Get Access <span aria-hidden="true">→</span>
              </button>

              <button
                onClick={handleSeeHowItWorks}
                className="text-[14px] font-semibold transition-opacity hover:opacity-70"
                style={{
                  color: NAVY,
                  fontFamily: "Inter, sans-serif",
                  background: "none",
                  border: "none",
                  padding: "10px 4px",
                }}
              >
                See how it works ↓
              </button>
            </div>
          </div>

          {/* RIGHT — Product visual */}
          <div className="flex-1 w-full flex items-center justify-center" style={{ minHeight: 400 }}>
            <div
              className="relative w-full"
              style={{ maxWidth: 460, height: 440 }}
            >
              {/* Soft glow backdrop */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(206,17,38,0.08) 0%, rgba(20,33,61,0) 65%)",
                  filter: "blur(20px)",
                }}
              />

              {/* Card 1 — Practice problem */}
              <div
                className="product-card product-card-1 absolute"
                style={{
                  top: 0,
                  left: 0,
                  width: 280,
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 12px 32px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ color: RED, background: "rgba(206,17,38,0.08)" }}
                  >
                    Practice
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>
                    BE13.4
                  </span>
                </div>
                <p className="text-[12.5px] leading-snug" style={{ color: "#1E293B" }}>
                  On Jan 1, Survive Co. issued <strong>$500,000</strong> of 6%, 10-year bonds at <strong>98</strong>. Record the entry.
                </p>
                <div
                  className="mt-3 pt-3 border-t flex items-center justify-between"
                  style={{ borderColor: "#F1F5F9" }}
                >
                  <span className="text-[10.5px] font-medium" style={{ color: "#64748B" }}>
                    Try it →
                  </span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16A34A" }} />
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#E2E8F0" }} />
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#E2E8F0" }} />
                  </div>
                </div>
              </div>

              {/* Card 2 — Explanation */}
              <div
                className="product-card product-card-2 absolute"
                style={{
                  top: 130,
                  right: 0,
                  width: 280,
                  background: NAVY,
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 16px 40px rgba(20,33,61,0.35), 0 4px 8px rgba(20,33,61,0.2)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
                    style={{ background: RED, color: "white" }}
                  >
                    ✓
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Explanation
                  </span>
                </div>
                <table className="w-full text-[11.5px]" style={{ color: "white" }}>
                  <tbody>
                    <tr>
                      <td className="py-0.5">Cash</td>
                      <td className="py-0.5 text-right" style={{ color: "#86EFAC" }}>490,000</td>
                      <td className="py-0.5 text-right opacity-50">—</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pl-3">Discount on B/P</td>
                      <td className="py-0.5 text-right" style={{ color: "#86EFAC" }}>10,000</td>
                      <td className="py-0.5 text-right opacity-50">—</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pl-6 italic" style={{ color: "rgba(255,255,255,0.7)" }}>Bonds Payable</td>
                      <td className="py-0.5 text-right opacity-50">—</td>
                      <td className="py-0.5 text-right" style={{ color: "#FCA5A5" }}>500,000</td>
                    </tr>
                  </tbody>
                </table>
                <p
                  className="mt-2.5 pt-2.5 text-[10.5px] leading-relaxed border-t"
                  style={{ color: "rgba(255,255,255,0.65)", borderColor: "rgba(255,255,255,0.1)" }}
                >
                  Issued at 98 → discount of 2% × $500K = $10K
                </p>
              </div>

              {/* Card 3 — Flashcard */}
              <div
                className="product-card product-card-3 absolute"
                style={{
                  bottom: 0,
                  left: 30,
                  width: 240,
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: 18,
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 12px 32px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)",
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                }}
              >
                <div
                  className="text-[9.5px] font-bold uppercase tracking-[0.16em] mb-2"
                  style={{ color: "#94A3B8" }}
                >
                  Flashcard
                </div>
                <div
                  className="text-[15px] leading-tight"
                  style={{ fontFamily: "'DM Serif Display', serif", color: NAVY }}
                >
                  Carrying Value of Bond
                </div>
                <div
                  className="mt-2 text-[12px] font-mono"
                  style={{ color: RED }}
                >
                  Face − Discount + Premium
                </div>
                <div className="mt-3 flex justify-center gap-1.5">
                  <span className="w-6 h-1 rounded-full" style={{ background: RED }} />
                  <span className="w-2 h-1 rounded-full" style={{ background: "#E2E8F0" }} />
                  <span className="w-2 h-1 rounded-full" style={{ background: "#E2E8F0" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
