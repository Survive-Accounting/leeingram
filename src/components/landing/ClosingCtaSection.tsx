import { useEmailGate } from "@/contexts/EmailGateContext";

const RED = "#CE1126";

interface ClosingCtaSectionProps {
  onCtaClick?: () => void;
  /** Optional course slug to pass into /get-access */
  courseSlug?: string;
  /** Optional campus slug to pass into /get-access (currently unused — gate detects campus). */
  campusSlug?: string;
}

export default function ClosingCtaSection({ onCtaClick, courseSlug }: ClosingCtaSectionProps) {
  const { requestAccess } = useEmailGate();
  const handleClick = () => {
    if (onCtaClick) onCtaClick();
    else requestAccess({ course: courseSlug });
  };
  return (
    <section
      className="relative py-20 sm:py-28 px-4 sm:px-6 text-center overflow-hidden"
      style={{ background: RED }}
    >
      <style>{`
        .cta-top-fade {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 160px;
          background: linear-gradient(to bottom, #F3F4F6 0%, rgba(206,17,38,0) 100%);
          z-index: 2;
          pointer-events: none;
        }
        .cta-bottom-fade {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 100%);
          z-index: 1;
          pointer-events: none;
        }
        .cta-ribbons {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .cta-ribbon {
          position: absolute;
          will-change: transform;
        }
        .cr-1 {
          width: 1200px;
          height: 240px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(120, 0, 15, 0.0) 15%,
            rgba(120, 0, 15, 0.7) 55%,
            rgba(100, 0, 10, 0.5) 80%,
            transparent 100%
          );
          bottom: -60px;
          left: -200px;
          transform: rotate(32deg);
          filter: blur(50px);
          animation: ctaSweep1 16s ease-in-out infinite alternate;
        }
        .cr-2 {
          width: 1000px;
          height: 200px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(80, 0, 8, 0.0) 20%,
            rgba(80, 0, 8, 0.65) 55%,
            rgba(60, 0, 6, 0.4) 80%,
            transparent 100%
          );
          bottom: -20px;
          left: -100px;
          transform: rotate(20deg);
          filter: blur(60px);
          animation: ctaSweep2 20s ease-in-out infinite alternate;
        }
        .cr-3 {
          width: 900px;
          height: 180px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(180, 20, 20, 0.0) 20%,
            rgba(180, 20, 20, 0.5) 55%,
            rgba(160, 10, 10, 0.3) 80%,
            transparent 100%
          );
          top: -20px;
          right: -100px;
          transform: rotate(-15deg);
          filter: blur(70px);
          animation: ctaSweep3 24s ease-in-out infinite alternate;
        }
        .cr-4 {
          width: 700px;
          height: 300px;
          background: radial-gradient(ellipse at center, rgba(60, 0, 0, 0.6) 0%, transparent 70%);
          bottom: -80px;
          right: -80px;
          filter: blur(80px);
          animation: ctaSweep4 28s ease-in-out infinite alternate;
        }
        @keyframes ctaSweep1 {
          0%   { transform: rotate(32deg) translate(0, 0); opacity: 0.9; }
          100% { transform: rotate(28deg) translate(40px, -30px); opacity: 1; }
        }
        @keyframes ctaSweep2 {
          0%   { transform: rotate(20deg) translate(0, 0); opacity: 0.85; }
          100% { transform: rotate(24deg) translate(60px, -20px); opacity: 0.95; }
        }
        @keyframes ctaSweep3 {
          0%   { transform: rotate(-15deg) translate(0, 0); opacity: 0.7; }
          100% { transform: rotate(-10deg) translate(-40px, 20px); opacity: 0.85; }
        }
        @keyframes ctaSweep4 {
          0%   { transform: translate(0, 0); opacity: 0.7; }
          100% { transform: translate(-30px, -20px); opacity: 0.85; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cta-ribbon { animation: none !important; }
        }
        .cta-button {
          background: #ffffff;
          color: ${RED};
          transition: all 200ms ease;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        }
        .cta-button:hover {
          background: rgba(255,255,255,0.92);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }
        .cta-button:active {
          transform: translateY(0px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      `}</style>

      {/* Top fade — gray dissolves into red */}
      <div className="cta-top-fade" aria-hidden="true" />

      {/* Animated ribbon system */}
      <div className="cta-ribbons" aria-hidden="true">
        <div className="cta-ribbon cr-1" />
        <div className="cta-ribbon cr-2" />
        <div className="cta-ribbon cr-3" />
        <div className="cta-ribbon cr-4" />
      </div>

      {/* Bottom fade into footer */}
      <div className="cta-bottom-fade" aria-hidden="true" />

      <div className="relative mx-auto max-w-[560px]" style={{ zIndex: 1 }}>
        <h2
          className="relative text-[26px] sm:text-[36px] text-white leading-tight tracking-tight"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
            zIndex: 1,
            textShadow: "0 2px 20px rgba(0,0,0,0.3)",
          }}
        >
          Your exam isn't going to wait.
        </h2>
        <p
          className="relative mt-3 text-[16px] sm:text-[18px]"
          style={{
            color: "rgba(255,255,255,0.85)",
            fontFamily: "Inter, sans-serif",
            zIndex: 1,
          }}
        >
          1,200+ students passed accounting with Lee's help. Finals season is here.
        </p>

        <button
          onClick={handleClick}
          className="cta-button relative mt-8 rounded-xl px-10 py-4 text-[16px] font-bold"
          style={{
            fontFamily: "Inter, sans-serif",
            zIndex: 1,
          }}
        >
          Start Studying →
        </button>

        <p
          className="relative mt-5 text-[13px]"
          style={{
            color: "rgba(255,255,255,0.6)",
            fontFamily: "Inter, sans-serif",
            zIndex: 1,
          }}
        >
          7-day refund guarantee · Semester pass · Active through May 31
        </p>
      </div>
    </section>
  );
}
