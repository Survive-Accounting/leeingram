export default function StagingOrbsTransition() {
  return (
    <section aria-hidden="true" className="staging-orbs-section">
      <style>{`
        .staging-orbs-section {
          position: relative;
          width: 100%;
          height: 160px;
          background: #f5f5f5;
          overflow: hidden;
          pointer-events: none;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }
        .staging-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(95px);
          will-change: transform;
          opacity: 0.15;
        }
        .staging-orb-1 {
          width: 420px;
          height: 420px;
          background: #6b21a8;
          top: -160px;
          left: 5%;
          animation: orbDrift1 14s ease-in-out infinite alternate;
        }
        .staging-orb-2 {
          width: 380px;
          height: 380px;
          background: #c0392b;
          top: -140px;
          left: 38%;
          animation: orbDrift2 15s ease-in-out infinite alternate;
        }
        .staging-orb-3 {
          width: 440px;
          height: 440px;
          background: #1e3a8a;
          top: -180px;
          right: 5%;
          animation: orbDrift3 13s ease-in-out infinite alternate;
        }
        @keyframes orbDrift1 {
          from { transform: translate(0, 0); }
          to   { transform: translate(80px, 30px); }
        }
        @keyframes orbDrift2 {
          from { transform: translate(0, 0); }
          to   { transform: translate(60px, 40px); }
        }
        @keyframes orbDrift3 {
          from { transform: translate(0, 0); }
          to   { transform: translate(-90px, 25px); }
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
