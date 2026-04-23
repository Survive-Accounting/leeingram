import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const RED = "#CE1126";
const NAVY = "#14213D";
const GOLD = "#D4AF37";
const HERO_IMAGE = "https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg";

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
          .staging-hero { min-height: auto; padding-top: 32px; padding-bottom: 40px; display: block; }
        }
        .staging-hero-bg {
          position: absolute;
          inset: 0;
          background-image: url('${HERO_IMAGE}');
          background-size: cover;
          background-position: 60% 40%;
          background-repeat: no-repeat;
          background-attachment: fixed;
          transform: scaleX(-1);
          z-index: 0;
        }
        @media (max-width: 768px) {
          .staging-hero-bg { background-attachment: scroll; }
        }
        .staging-hero-overlay-left {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, ${NAVY} 0%, ${NAVY}cc 25%, ${NAVY}99 55%, ${NAVY}99 100%);
          opacity: 1;
          z-index: 1;
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

        /* Entrance animations */
        @keyframes heroPhotoIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes heroBtnIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hero-anim-photo { opacity: 0; animation: heroPhotoIn 0.6s ease-out forwards; }
        .hero-anim-line1 { opacity: 0; animation: heroFadeUp 0.5s ease-out 0.2s forwards; }
        .hero-anim-line2 { opacity: 0; animation: heroFadeUp 0.5s ease-out 0.4s forwards; }
        .hero-anim-sub { opacity: 0; animation: heroFadeIn 0.4s ease-out 0.6s forwards; }
        .hero-anim-btn { opacity: 0; animation: heroBtnIn 0.4s ease-out 0.8s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .hero-anim-photo, .hero-anim-line1, .hero-anim-line2, .hero-anim-sub, .hero-anim-btn {
            opacity: 1 !important;
            animation: none !important;
            transform: none !important;
          }
          .staging-hero-cap-inline { animation: none !important; }
        }
      `}</style>

      <div className="staging-hero-bg" />
      <div className="staging-hero-overlay-left" />

      <div className="relative z-[3] mx-auto max-w-[1100px] px-4 sm:px-6 py-12 md:py-20 w-full">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* LEFT — Photo */}
          <div className="w-full md:w-[42%] flex justify-center md:justify-start">
            <div className="relative w-full max-w-[300px] md:max-w-none">
              <img
                src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg"
                alt="Lee Ingram"
                className="w-full rounded-lg hero-anim-photo"
                style={{
                  borderRadius: 8,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              {/* Hand-drawn annotation pointing at Lee */}
              <div className="photo-annotation">
                <svg
                  className="photo-annotation-svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id="annotation-arrowhead"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                      markerUnits="strokeWidth"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="white" />
                    </marker>
                  </defs>
                  {/* Curved arrow: from label (65, 18) curving down-left to Lee's face (38, 40) */}
                  <path
                    className="photo-annotation-path"
                    d="M 65 18 Q 72 35, 55 38 T 38 40"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    markerEnd="url(#annotation-arrowhead)"
                  />
                </svg>
                <span className="photo-annotation-label">That's me</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Text */}
          <div className="flex-1 text-center md:text-left">
            <p
              className="mb-3 text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.15em] hero-anim-line1"
              style={{
                color: "rgba(255,255,255,0.75)",
                fontFamily: "Inter, sans-serif",
                textShadow: subtextShadow,
              }}
            >
              Ole Miss · Tutor since 2015
            </p>
            <h1
              className="text-white leading-[1.15] tracking-tight text-[28px] sm:text-[36px] md:text-[44px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: headlineShadow }}
            >
              <span className="block hero-anim-line2">
                Accounting exams are more ace-able than you think.
              </span>
            </h1>

            <p
              className="mt-5 text-[15px] md:text-[16px] leading-relaxed mx-auto md:mx-0 max-w-[520px] hero-anim-sub"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif", textShadow: subtextShadow }}
            >
              I'm Lee Ingram, Ole Miss alum and tutor. Helping you ace accounting exams is my passion. Survive Accounting is an AI-enabled platform I'm building specifically for accounting students who want to master the material — not just memorize it.
            </p>

            <TooltipProvider delayDuration={150}>
              <div className="mt-8 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 justify-center md:justify-start hero-anim-btn">
                <button
                  onClick={onGetStartedClick}
                  className="rounded-lg px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.35)" }}
                >
                  Get Started →
                </button>
                <button
                  onClick={onGetStartedClick}
                  className="text-[14px] font-medium underline underline-offset-4 transition-opacity hover:opacity-80"
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontFamily: "Inter, sans-serif",
                    textShadow: subtextShadow,
                  }}
                >
                  See what's included
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
