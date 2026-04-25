interface StagingFinalCtaSectionProps {
  onGetAccessClick: () => void;
  onTryDemoClick?: () => void;
}

export default function StagingFinalCtaSection({
  onGetAccessClick,
}: StagingFinalCtaSectionProps) {
  return (
    <section
      className="w-full px-4 sm:px-6 text-center relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #D81221 0%, #C00018 60%, #A8000F 100%)",
        paddingTop: 96,
        paddingBottom: 96,
      }}
    >
      <style>{`
        .final-cta-arrow { display: inline-block; transition: transform 0.25s ease; }
        .final-cta-btn:hover .final-cta-arrow { transform: translateX(4px); }
        .final-cta-arrow-char::before { content: "›"; }
        .final-cta-btn:hover .final-cta-arrow-char::before { content: "→"; }
      `}</style>

      {/* Soft top vignette — blends from page above */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Soft bottom vignette */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.12) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="mx-auto max-w-[680px] relative" style={{ zIndex: 1 }}>
        <h2
          className="text-white leading-tight tracking-tight text-[36px] sm:text-[52px]"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Your exam is coming up.
        </h2>
        <p
          className="mt-4 text-[16px]"
          style={{ color: "rgba(255,255,255,0.9)", opacity: 0.9, fontFamily: "Inter, sans-serif" }}
        >
          Practice smarter, understand faster, walk into your exam confident.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={onGetAccessClick}
            className="final-cta-btn rounded-xl px-9 py-4 text-[16px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "#FFFFFF",
              color: "#CC0000",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Start Studying <span className="final-cta-arrow final-cta-arrow-char" />
          </button>
        </div>

        <p
          className="mt-6 text-[12px]"
          style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif" }}
        >
          7-day refund guarantee • Full access through your exams
        </p>
      </div>
    </section>
  );
}
