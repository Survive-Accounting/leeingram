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
          opacity: 0;
          animation: annotationFloat 2s ease-in-out infinite, annotationFadeIn 0.3s ease-out 1.2s forwards;
          filter: drop-shadow(1px 2px 3px rgba(0,0,0,0.6));
          z-index: 4;
        }
        @keyframes annotationFadeIn {
          to { opacity: 1; }
        }
        @keyframes annotationFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .photo-annotation-path {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: drawPath 0.8s ease-out 1s forwards;
        }
        @keyframes drawPath {
          to { stroke-dashoffset: 0; }
        }
        .photo-annotation-arrowhead {
          opacity: 0;
          animation: arrowheadIn 0.2s ease-out 1.7s forwards;
        }
        @keyframes arrowheadIn {
          to { opacity: 1; }
        }
        .photo-annotation-text {
          opacity: 0;
          animation: annotationTextIn 0.3s ease-out 1.8s forwards;
        }
        @keyframes annotationTextIn {
          to { opacity: 1; }
        }
        @media (max-width: 768px) {
          .photo-annotation { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .photo-annotation,
          .photo-annotation-path,
          .photo-annotation-arrowhead,
          .photo-annotation-text {
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
              <svg
                className="photo-annotation"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* "That's me" text at origin (62%, 8%) */}
                <text
                  className="photo-annotation-text"
                  x="62"
                  y="8"
                  fill="white"
                  textAnchor="start"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    fontSize: "3.2px",
                    textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  That's me
                </text>
                {/* Curved arrow from origin (62, 11) down-left to tip (35, 30) */}
                <path
                  className="photo-annotation-path"
                  d="M 62 11 Q 70 22, 55 24 T 35 30"
                  stroke="white"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                />
                {/* Arrowhead at tip (35, 30) */}
                <path
                  className="photo-annotation-arrowhead"
                  d="M 35 30 L 39 26 M 35 30 L 40 31"
                  stroke="white"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                />
              </svg>
            </div>
          </div>

          {/* RIGHT — Text */}
          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-white leading-[1.15] tracking-tight text-[28px] sm:text-[36px] md:text-[44px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: headlineShadow }}
            >
              <span className="block hero-anim-line1">Your exam is coming.</span>
              <span className="block hero-anim-line2">I'll get you ready.</span>
            </h1>

            <p
              className="mt-5 text-[15px] md:text-[16px] leading-relaxed mx-auto md:mx-0 max-w-[520px] hero-anim-sub"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif", textShadow: subtextShadow }}
            >
              I'm Lee Ingram. Ole Miss accounting alum & tutor. I built Survive Accounting out of a love for helping students master their accounting courses — not just survive them.
            </p>

            <TooltipProvider delayDuration={150}>
              <div className="mt-8 flex justify-center md:justify-start hero-anim-btn">
                <button
                  onClick={onGetStartedClick}
                  className="rounded-lg px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.35)" }}
                >
                  Get Started →
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
