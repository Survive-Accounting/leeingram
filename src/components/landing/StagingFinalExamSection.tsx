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
        @keyframes finalExamGridDrift {
          0%   { background-position: 0px 0px, 0px 0px; }
          100% { background-position: 80px 80px, 80px 80px; }
        }
        @keyframes finalExamOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
          50%      { transform: translate(40px, -30px) scale(1.05); opacity: 0.5; }
        }
        .final-exam-grid-bg {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 80px 80px, 80px 80px;
          animation: finalExamGridDrift 60s linear infinite;
          mask-image: radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%);
          -webkit-mask-image: radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%);
        }
        .final-exam-orb {
          position: absolute; border-radius: 9999px; filter: blur(80px);
          pointer-events: none; mix-blend-mode: screen;
        }
        .final-exam-orb-1 {
          width: 420px; height: 420px; top: -120px; left: -80px;
          background: radial-gradient(circle, rgba(180,200,230,0.18) 0%, rgba(180,200,230,0) 70%);
          animation: finalExamOrbFloat 28s ease-in-out infinite;
        }
        .final-exam-orb-2 {
          width: 380px; height: 380px; bottom: -100px; right: -60px;
          background: radial-gradient(circle, rgba(200,215,240,0.14) 0%, rgba(200,215,240,0) 70%);
          animation: finalExamOrbFloat 36s ease-in-out infinite reverse;
        }
      `}</style>
      <div className="final-exam-grid-bg" aria-hidden="true" />
      <div className="final-exam-orb final-exam-orb-1" aria-hidden="true" />
      <div className="final-exam-orb final-exam-orb-2" aria-hidden="true" />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(10,20,40,0.85) 0%, rgba(10,20,40,0.95) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(0,0,0,0) 75%)",
        }}
      />
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </section>
  );
}
