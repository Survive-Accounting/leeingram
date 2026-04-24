const NAVY = "#14213D";
const GREEN = "#16A34A";

const BULLETS = [
  "Study tools for every chapter in your course — journal entries, formulas, flashcards",
  "Explore 2,500 practice problems with AI explanations curated by Lee's tutoring experience",
  "Ask Lee questions when you're stuck — get personalized video responses",
];

export default function StagingBetaBanner() {
  return (
    <section className="px-4 sm:px-6 py-10 sm:py-12" style={{ background: "#F8F8FA" }}>
      <style>{`
        @keyframes betaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .beta-pulse-dot::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: ${GREEN};
          animation: betaPulse 1.8s ease-in-out infinite;
        }
      `}</style>

      <div className="mx-auto max-w-[860px]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <span
            className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-[12px] font-bold"
            style={{
              background: "rgba(22,163,74,0.12)",
              color: GREEN,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <span className="relative inline-block w-2 h-2">
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: GREEN }}
              />
              <span className="beta-pulse-dot absolute inset-0 rounded-full" />
            </span>
            Spring 2026 Beta is Live
          </span>
          <p
            className="text-[13px] sm:text-[14px]"
            style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
          >
            AI study tools for accounting · Curated by a real tutor
          </p>
        </div>

        <ul className="space-y-3">
          {BULLETS.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-[14px] sm:text-[15px] leading-relaxed"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              <span
                className="flex-shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full"
                style={{ background: GREEN }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}