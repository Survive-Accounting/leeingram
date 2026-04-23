import { ReactNode } from "react";

const NAVY = "#14213D";

interface Props {
  children: ReactNode;
}

/**
 * Shared animated background wrapper for the combined
 * "Final exams + feature cards + contact form" section.
 * Provides ONE continuous background spanning all child subsections.
 */
export default function StagingFinalExamSection({ children }: Props) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, #6F7C92 0%, #2A3654 8%, #14213D 22%, ${NAVY} 60%, #0B1426 100%)`,
      }}
    >
      <style>{`
        /* Match hero visual language: lines + geometry, slower + lower opacity than hero */
        @keyframes finalExamGridDrift {
          0%   { background-position: 0px 0px, 0px 0px; }
          100% { background-position: 120px 120px, 120px 120px; }
        }
        @keyframes finalExamDiagDrift {
          0%   { background-position: 0px 0px; }
          100% { background-position: 200px 200px; }
        }
        @keyframes finalExamOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.10; }
          50%      { transform: translate(30px, -20px) scale(1.04); opacity: 0.16; }
        }
        .final-exam-grid-bg {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px);
          background-size: 120px 120px, 120px 120px;
          animation: finalExamGridDrift 2400s linear infinite;
          opacity: 0.32;
          filter: blur(1.4px);
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.9) 100%);
          -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.9) 100%);
        }
        /* Diagonal accent lines — matches hero geometry, very low opacity */
        .final-exam-diag-bg {
          position: absolute; inset: 0; pointer-events: none;
          background-image: repeating-linear-gradient(
            135deg,
            rgba(255,255,255,0.04) 0px,
            rgba(255,255,255,0.04) 1px,
            transparent 1px,
            transparent 200px
          );
          animation: finalExamDiagDrift 3200s linear infinite;
          opacity: 0.7;
          filter: blur(0.6px);
        }
        .final-exam-orb {
          position: absolute; border-radius: 9999px; filter: blur(110px);
          pointer-events: none; mix-blend-mode: screen;
        }
        .final-exam-orb-1 {
          width: 420px; height: 420px; top: -120px; left: -80px;
          background: radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%);
          animation: finalExamOrbFloat 1100s ease-in-out infinite;
        }
        .final-exam-orb-2 {
          width: 380px; height: 380px; bottom: -100px; right: -60px;
          background: radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0) 70%);
          animation: finalExamOrbFloat 1400s ease-in-out infinite reverse;
        }
        @media (prefers-reduced-motion: reduce) {
          .final-exam-grid-bg, .final-exam-diag-bg, .final-exam-orb { animation: none !important; }
        }
      `}</style>
      <div className="final-exam-grid-bg" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="final-exam-diag-bg" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="final-exam-orb final-exam-orb-1" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="final-exam-orb final-exam-orb-2" aria-hidden="true" style={{ zIndex: 0 }} />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background: "linear-gradient(180deg, rgba(10,20,40,0.85) 0%, rgba(10,20,40,0.95) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
          background:
            "radial-gradient(ellipse 75% 60% at 50% 40%, rgba(10,20,40,0) 0%, rgba(10,20,40,0.18) 60%, rgba(10,20,40,0.45) 100%)",
        }}
      />
      <div className="relative" style={{ zIndex: 3 }}>
        {children}
      </div>
    </section>
  );
}
