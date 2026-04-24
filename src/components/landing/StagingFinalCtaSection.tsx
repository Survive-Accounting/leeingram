interface StagingFinalCtaSectionProps {
  onGetAccessClick: () => void;
  onTryDemoClick: () => void;
}

export default function StagingFinalCtaSection({
  onGetAccessClick,
  onTryDemoClick,
}: StagingFinalCtaSectionProps) {
  return (
    <section
      className="w-full px-4 sm:px-6 text-center"
      style={{ background: "#CC0000", paddingTop: 80, paddingBottom: 80 }}
    >
      <style>{`
        .final-cta-arrow { display: inline-block; transition: transform 0.25s ease; }
        .final-cta-btn:hover .final-cta-arrow { transform: translateX(4px); }
        .final-cta-arrow-char::before { content: "›"; }
        .final-cta-btn:hover .final-cta-arrow-char::before { content: "→"; }
      `}</style>

      <div className="mx-auto max-w-[680px]">
        <h2
          className="text-white font-bold leading-tight tracking-tight text-[32px] sm:text-[44px]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Your exam isn't going to wait.
        </h2>
        <p
          className="mt-4 text-[16px]"
          style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif" }}
        >
          Join 1,200+ students who stopped panicking and started studying.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={onGetAccessClick}
            className="final-cta-btn rounded-xl px-8 py-4 text-[16px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "#FFFFFF",
              color: "#CC0000",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Get Full Access <span className="final-cta-arrow final-cta-arrow-char" />
          </button>

          <button
            onClick={onTryDemoClick}
            className="final-cta-btn rounded-xl px-8 py-4 text-[16px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "transparent",
              color: "#FFFFFF",
              border: "2px solid #FFFFFF",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Try the Demo First <span className="final-cta-arrow final-cta-arrow-char" />
          </button>
        </div>

        <p
          className="mt-6 text-[12px]"
          style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif" }}
        >
          7-day refund guarantee · Instant access after purchase
        </p>
      </div>
    </section>
  );
}
