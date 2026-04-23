export default function StagingOrbsTransition() {
  return (
    <section aria-hidden="true" className="staging-orbs-section">
      <style>{`
        .staging-orbs-section {
          position: relative;
          width: 100%;
          height: 120px;
          background: transparent;
          overflow: hidden;
          pointer-events: none;
        }
        .staging-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          will-change: transform;
        }
        .staging-orb-1 {
          width: 280px;
          height: 280px;
          background: #1a1a2e;
          opacity: 0.40;
          top: -80px;
          left: 10%;
          animation: orbDrift1 8s ease-in-out infinite alternate;
        }
        .staging-orb-2 {
          width: 240px;
          height: 240px;
          background: #c0392b;
          opacity: 0.25;
          top: -60px;
          left: 40%;
          animation: orbDrift2 11s ease-in-out infinite alternate;
        }
        .staging-orb-3 {
          width: 260px;
          height: 260px;
          background: #d4a017;
          opacity: 0.30;
          top: -70px;
          right: 10%;
          animation: orbDrift3 9s ease-in-out infinite alternate;
        }
        @keyframes orbDrift1 {
          from { transform: translate(0, 0); }
          to   { transform: translate(120px, 20px); }
        }
        @keyframes orbDrift2 {
          from { transform: translate(0, 0); }
          to   { transform: translate(80px, 40px); }
        }
        @keyframes orbDrift3 {
          from { transform: translate(0, 0); }
          to   { transform: translate(-120px, 25px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .staging-orb-1, .staging-orb-2, .staging-orb-3 { animation: none !important; }
        }
      `}</style>
      <div className="staging-orb staging-orb-1" />
      <div className="staging-orb staging-orb-2" />
      <div className="staging-orb staging-orb-3" />
    </section>
  );
}
