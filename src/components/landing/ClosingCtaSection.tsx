const NAVY = "#14213D";
const RED = "#CE1126";

interface ClosingCtaSectionProps {
  onCtaClick: () => void;
}

export default function ClosingCtaSection({ onCtaClick }: ClosingCtaSectionProps) {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 text-center" style={{ background: NAVY }}>
      <div className="mx-auto max-w-[560px]">
        <h2
          className="text-[26px] sm:text-[36px] text-white leading-tight tracking-tight"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Your exam is coming up.
        </h2>
        <p
          className="mt-3 text-[16px] sm:text-[18px]"
          style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter, sans-serif" }}
        >
          If you want a clearer way to study — this will help.
        </p>

        <button
          onClick={onCtaClick}
          className="mt-8 rounded-xl px-10 py-4 text-[16px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: RED,
            boxShadow: "0 4px 20px rgba(206,17,38,0.35)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Start Studying →
        </button>

        <p
          className="mt-5 text-[13px]"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}
        >
          Built from real tutoring. Designed to actually help.
        </p>
      </div>
    </section>
  );
}
