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
          background: #0B0F1A;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
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
        <div className="staging-hero-card flex flex-col md:flex-row items-center gap-6 md:gap-0">
          {/* LEFT — Photo (33% width) */}
          <div className="w-full md:w-[33%] flex flex-col items-center justify-center shrink-0 md:pr-10">
            <div className="relative w-full max-w-[240px] md:max-w-[280px]">
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
              <div className="mt-3 text-center hero-anim-line1" style={{ fontFamily: "Inter, sans-serif" }}>
                <p
                  className="font-semibold"
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: "13px",
                    textShadow: subtextShadow,
                  }}
                >
                  Lee Ingram · Ole Miss Alum
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "11px",
                    fontWeight: 400,
                    marginTop: 2,
                    textShadow: subtextShadow,
                  }}
                >
                  Full-time Accounting Tutor
                </p>
              </div>
            </div>
          </div>

          {/* DIVIDER */}
          <div
            className="hidden md:block self-stretch"
            style={{ width: "1px", background: "rgba(255,255,255,0.15)" }}
            aria-hidden="true"
          />

          {/* RIGHT — Text (67%) */}
          <div className="flex-1 w-full md:w-[67%] flex flex-col justify-center text-center md:text-left md:pl-10">
            <h1
              className="text-white leading-[1.15] tracking-tight text-[26px] sm:text-[36px] md:text-[38px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: headlineShadow }}
            >
              <span className="block hero-anim-line2">
                Generic AI isn't built for accounting exam prep. This is.
              </span>
            </h1>

            <TooltipProvider delayDuration={150}>
              <div
                className="mt-5 mx-auto md:mx-0 max-w-[600px] hero-anim-sub"
                style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", textShadow: subtextShadow }}
              >
                <p style={{ fontSize: "15px", lineHeight: 1.6 }}>
                  Prep for your exams with AI-assisted study tools designed to get you unstuck fast. Built by OG accounting tutor, Lee Ingram. Trusted by 1,200+ students since 2015.
                </p>
              </div>
              {/* Hidden tooltip provider preserved for future use */}
              <Tooltip><TooltipTrigger asChild><span /></TooltipTrigger><TooltipContent /></Tooltip>
            </TooltipProvider>

            {/* CTA inside card */}
            <div className="mt-7 flex justify-center md:justify-start hero-anim-btn">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(206,17,38,0.5) 0%, rgba(120,40,180,0.25) 50%, rgba(20,33,61,0) 80%)",
                    filter: "blur(24px)",
                    zIndex: 0,
                    animation: "heroBtnGlow 4s ease-in-out infinite",
                  }}
                />
                <style>{`
                  @keyframes heroBtnGlow {
                    0%, 100% { opacity: 0.85; transform: scale(1); }
                    50%      { opacity: 1;    transform: scale(1.06); }
                  }
                `}</style>
                <button
                  onClick={onGetStartedClick}
                  className="relative rounded-xl px-10 py-4 text-[17px] md:text-[19px] font-bold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                  style={{
                    background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                    fontFamily: "Inter, sans-serif",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(255,255,255,0.1), 0 10px 28px rgba(206,17,38,0.5), 0 20px 50px rgba(120,40,180,0.3)",
                    letterSpacing: "0.01em",
                    zIndex: 1,
                  }}
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* "See how it works" sits below the card */}
        <div className="mt-6 md:mt-8 flex justify-center hero-anim-btn">
          <button
            onClick={() => {
              const el = document.getElementById("courses-section");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="text-[16px] md:text-[17px] font-semibold underline underline-offset-[6px] decoration-2 transition-opacity hover:opacity-100 opacity-90 px-3 py-1.5"
            style={{
              color: "rgba(255,255,255,0.92)",
              fontFamily: "Inter, sans-serif",
              textShadow: subtextShadow,
              background: "none",
              border: "none",
            }}
          >
            See how it works ↓
          </button>
        </div>
      </div>

      <div className="staging-hero-overlay-bottom" />
    </section>
  );
}
