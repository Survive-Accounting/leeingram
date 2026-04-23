import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import heroImage from "@/assets/staging-hero.jpg";
import leeStadiumPhoto from "@/assets/hero-lee-stadium.jpg";

const RED = "#CE1126";
const NAVY = "#14213D";
const GOLD = "#D4AF37";
const HERO_IMAGE = heroImage;

interface Course {
  id: string;
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  status: "live" | "upcoming" | "future";
  slug: string;
}

interface StagingHeroProps {
  liveCourse: Course;
  futureCourses: Course[];
  onLiveCourseClick: () => void;
  onNotifyClick: (course: Course) => void;
  onGetStartedClick?: () => void;
}

export default function StagingHero({ onGetStartedClick }: StagingHeroProps) {
  const headlineShadow = "2px 2px 8px rgba(0,0,0,0.8)";
  const subtextShadow = "1px 1px 4px rgba(0,0,0,0.6)";

  return (
    <section className="relative w-full overflow-hidden staging-hero">
      <style>{`
        .staging-hero {
          min-height: 85vh;
          display: flex;
          align-items: center;
        }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 12px; padding-bottom: 32px; display: block; }
        }
        .staging-hero-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }
        .staging-hero-overlay-left {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, ${NAVY}cc 0%, ${NAVY}99 40%, ${NAVY}80 100%);
          opacity: 1;
          z-index: 1;
        }
        .staging-hero-card {
          background: rgba(20, 33, 61, 0.72);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
        }
        @media (min-width: 768px) {
          .staging-hero-card { padding: 36px 40px; }
        }
        .staging-hero-overlay-bottom {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 160px;
          background: linear-gradient(to bottom, rgba(248,248,248,0) 0%, #F8F8F8 100%);
          z-index: 2;
          pointer-events: none;
        }
        .staging-hero-cap-inline {
          display: inline-block;
          vertical-align: top;
          margin-left: 12px;
          opacity: 0.7;
          transform: rotate(15deg);
          animation: heroCapFloat 3s ease-in-out infinite;
          filter: drop-shadow(0 0 8px ${GOLD}cc);
        }
        @keyframes heroCapFloat {
          0%, 100% { transform: rotate(15deg) translateY(0); }
          50% { transform: rotate(15deg) translateY(-6px); }
        }
        @media (max-width: 768px) {
          .staging-hero-cap-inline { display: none; }
        }

        /* Photo annotation */
        .photo-annotation {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 4;
          animation: annotationFloat 2.5s ease-in-out infinite;
        }
        @keyframes annotationFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .photo-annotation-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          filter: drop-shadow(1px 1px 3px rgba(0,0,0,0.9));
        }
        .photo-annotation-path {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: drawPath 0.8s ease-out 1s forwards;
        }
        @keyframes drawPath {
          to { stroke-dashoffset: 0; }
        }
        .photo-annotation-arrowhead {
          opacity: 0;
          animation: arrowheadIn 0.2s ease-out 1.75s forwards;
        }
        @keyframes arrowheadIn {
          to { opacity: 1; }
        }
        .photo-annotation-label {
          position: absolute;
          left: 63%;
          top: 12%;
          transform: rotate(-15deg);
          transform-origin: left center;
          font-family: Inter, sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: white;
          background: rgba(0,0,0,0.25);
          padding: 2px 6px;
          border-radius: 4px;
          text-shadow: 1px 1px 4px rgba(0,0,0,0.9);
          white-space: nowrap;
          opacity: 0;
          animation: annotationLabelIn 0.3s ease-out 2s forwards;
        }
        @keyframes annotationLabelIn {
          to { opacity: 1; }
        }
        @media (max-width: 768px) {
          .photo-annotation { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .photo-annotation,
          .photo-annotation-path,
          .photo-annotation-arrowhead,
          .photo-annotation-label {
            opacity: 1 !important;
            animation: none !important;
            stroke-dashoffset: 0 !important;
          }
        }

        /* Entrance animations — smoother, designed easing */
        @keyframes heroPhotoIn {
          0%   { opacity: 0; transform: scale(1.06); filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes heroPhotoDrift {
          0%, 100% { transform: scale(1) translateY(0); }
          50%      { transform: scale(1.015) translateY(-3px); }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes heroBtnIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Cubic-bezier ease-out for refined feel */
        .hero-anim-photo {
          opacity: 0;
          animation:
            heroPhotoIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards,
            heroPhotoDrift 6s ease-in-out 1.2s infinite;
          will-change: transform, opacity, filter;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .hero-anim-line1 { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards; }
        .hero-anim-line2 { opacity: 0; animation: heroFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; }
        .hero-anim-sub   { opacity: 0; animation: heroFadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.55s forwards; }
        .hero-anim-btn   { opacity: 0; animation: heroBtnIn  0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.75s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .hero-anim-photo, .hero-anim-line1, .hero-anim-line2, .hero-anim-sub, .hero-anim-btn {
            opacity: 1 !important;
            animation: none !important;
            transform: none !important;
            filter: none !important;
          }
          .staging-hero-cap-inline { animation: none !important; }
        }
      `}</style>

      <video
        ref={(el) => {
          if (!el) return;
          el.muted = true;
          const tryPlay = () => el.play().catch(() => {});
          tryPlay();
          const onInteract = () => { tryPlay(); document.removeEventListener("touchstart", onInteract); document.removeEventListener("click", onInteract); };
          document.addEventListener("touchstart", onInteract, { once: true, passive: true });
          document.addEventListener("click", onInteract, { once: true });
        }}
        className="staging-hero-video"
        autoPlay
        loop
        muted
        playsInline
        // @ts-ignore
        webkit-playsinline="true"
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        poster={HERO_IMAGE}
      >
        <source src="/videos/hero-loop.mp4" type="video/mp4" />
      </video>
      <div className="staging-hero-overlay-left" />

      <div className="relative z-[3] mx-auto max-w-[1100px] px-4 sm:px-6 py-4 md:py-20 w-full">
        <div className="staging-hero-card flex flex-col md:flex-row items-center gap-6 md:gap-10">
          {/* LEFT — Photo (smaller, ~33% width) */}
          <div className="w-full md:w-[33%] flex flex-col items-center md:items-start shrink-0">
            <div className="relative w-full max-w-[240px] md:max-w-[300px]">
              <img
                src={leeStadiumPhoto}
                alt="Lee Ingram at Ole Miss stadium"
                width={720}
                height={653}
                decoding="async"
                fetchPriority="high"
                className="w-full rounded-lg hero-anim-photo"
                style={{
                  borderRadius: 8,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "block",
                }}
              />
              <p
                className="mt-3 text-center text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.15em] hero-anim-line1"
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "Inter, sans-serif",
                  textShadow: subtextShadow,
                }}
              >
                Lee Ingram · Accounting Tutor Since 2015
              </p>
            </div>
          </div>

          {/* RIGHT — Text */}
          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-white leading-[1.15] tracking-tight text-[28px] sm:text-[40px] md:text-[52px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: headlineShadow }}
            >
              <span className="block hero-anim-line2">
                AI-enabled study tools created by a real tutor.
              </span>
            </h1>

            <TooltipProvider delayDuration={150}>
              <div className="mt-5 md:mt-6 flex justify-center md:justify-start hero-anim-btn">
                <button
                  onClick={onGetStartedClick}
                  className="rounded-lg px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.35)" }}
                >
                  Get Started →
                </button>
              </div>

              <div
                className="mt-5 mx-auto md:mx-0 max-w-[560px] hero-anim-sub"
                style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif", textShadow: subtextShadow }}
              >
                <p className="text-[14px] md:text-[16px] leading-relaxed">
                  I'm Lee Ingram, and I built Survive Accounting to help you walk into your exam feeling confident you'll own it.
                </p>
              </div>

              <div className="mt-6 flex justify-center md:justify-start hero-anim-btn">
                <button
                  onClick={() => {
                    const el = document.getElementById("courses-section");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="text-[14px] font-medium underline underline-offset-4 transition-opacity hover:opacity-80"
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontFamily: "Inter, sans-serif",
                    textShadow: subtextShadow,
                  }}
                >
                  See how it works ↓
                </button>
              </div>
              {/* Hidden tooltip provider preserved for future use */}
              <Tooltip><TooltipTrigger asChild><span /></TooltipTrigger><TooltipContent /></Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      <div className="staging-hero-overlay-bottom" />
    </section>
  );
}
