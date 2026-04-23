import { ReactNode } from "react";

const NAVY = "#14213D";

interface Props {
  children: ReactNode;
}

/**
 * Light-themed wrapper for the combined
 * "Final exams + feature cards + contact form" section.
 * Provides one continuous off-white background with subtle geometry.
 * (The contact form area renders its own dark backdrop at the bottom.)
 */
export default function StagingFinalExamSection({ children }: Props) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "#F8FAFC" }}
    >
      <style>{`
        @keyframes finalExamGridDriftLight {
          0%   { background-position: 0px 0px, 0px 0px; }
          100% { background-position: 120px 120px, 120px 120px; }
        }
        @keyframes finalExamDiagDriftLight {
          0%   { background-position: 0px 0px; }
          100% { background-position: 200px 200px; }
        }
        .final-exam-grid-bg-light {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(20,33,61,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,33,61,0.045) 1px, transparent 1px);
          background-size: 120px 120px, 120px 120px;
          animation: finalExamGridDriftLight 2400s linear infinite;
          opacity: 0.6;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 100%);
          -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.6) 100%);
        }
        .final-exam-diag-bg-light {
          position: absolute; inset: 0; pointer-events: none;
          background-image: repeating-linear-gradient(
            135deg,
            rgba(20,33,61,0.035) 0px,
            rgba(20,33,61,0.035) 1px,
            transparent 1px,
            transparent 200px
          );
          animation: finalExamDiagDriftLight 3200s linear infinite;
          opacity: 0.7;
        }
        @media (prefers-reduced-motion: reduce) {
          .final-exam-grid-bg-light, .final-exam-diag-bg-light { animation: none !important; }
        }
      `}</style>
      <div className="final-exam-grid-bg-light" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="final-exam-diag-bg-light" aria-hidden="true" style={{ zIndex: 0 }} />
      <div className="relative" style={{ zIndex: 3 }}>
        {children}
      </div>
    </section>
  );
}
