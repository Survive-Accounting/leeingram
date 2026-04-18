import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const RED = "#CE1126";
const NAVY = "#14213D";
const GOLD = "#D4AF37";
const HERO_IMAGE = "https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg";
const BASELINE_OLE_MISS = 597;

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
  const [totalPaid, setTotalPaid] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const totRes = await supabase.rpc("get_paid_student_count_for_campus" as any, { p_campus_slug: "ole-miss" });
        if (cancelled) return;
        if (typeof totRes.data === "number") setTotalPaid(totRes.data);
      } catch {
        // fail silent
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const headlineCount = BASELINE_OLE_MISS + totalPaid;

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
          .staging-hero-bg {
            background-attachment: scroll;
          }
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
        .staging-hero-abacus {
          position: absolute;
          top: 8%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2;
          opacity: 0.6;
          filter: drop-shadow(0 0 12px ${GOLD}88);
          pointer-events: none;
        }
        .staging-hero-cap {
          position: absolute;
          top: 12%;
          right: 8%;
          z-index: 2;
          opacity: 0.4;
          transform: rotate(15deg);
          animation: heroCapFloat 3s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes heroCapFloat {
          0%, 100% { transform: rotate(15deg) translateY(0); }
          50% { transform: rotate(15deg) translateY(-10px); }
        }
        @media (max-width: 768px) {
          .staging-hero-abacus, .staging-hero-cap { display: none; }
        }
      `}</style>

      <div className="staging-hero-bg" />
      <div className="staging-hero-overlay-left" />

      {/* Abacus SVG at mountain peak */}
      <svg className="staging-hero-abacus" width="80" height="56" viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="72" height="48" rx="3" stroke={GOLD} strokeWidth="2" fill="none" />
        <line x1="4" y1="18" x2="76" y2="18" stroke={GOLD} strokeWidth="1.5" />
        <line x1="4" y1="32" x2="76" y2="32" stroke={GOLD} strokeWidth="1.5" />
        <line x1="4" y1="46" x2="76" y2="46" stroke={GOLD} strokeWidth="1.5" />
        {[14, 24, 34, 44, 54, 64].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy="11" r="3" fill={GOLD} />
            <circle cx={cx} cy="25" r="3" fill={GOLD} />
            <circle cx={cx} cy="39" r="3" fill={GOLD} />
          </g>
        ))}
      </svg>

      {/* Floating grad cap */}
      <svg className="staging-hero-cap" width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 8 L52 20 L28 32 L4 20 Z" fill="white" stroke={GOLD} strokeWidth="1.5" />
        <path d="M14 24 V36 C14 36 20 42 28 42 C36 42 42 36 42 36 V24" stroke="white" strokeWidth="1.5" fill="none" />
        <line x1="50" y1="21" x2="50" y2="34" stroke={GOLD} strokeWidth="1.5" />
        <circle cx="50" cy="36" r="2.5" fill={GOLD} />
      </svg>

      <div className="relative z-[3] mx-auto max-w-[1100px] px-4 sm:px-6 py-12 md:py-20 w-full">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* LEFT — Photo */}
          <div className="w-full md:w-[42%] flex justify-center md:justify-start">
            <img
              src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg"
              alt="Lee Ingram"
              className="w-full max-w-[300px] md:max-w-none rounded-lg"
              style={{
                borderRadius: 8,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>

          {/* RIGHT — Text */}
          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-white leading-[1.15] tracking-tight text-[28px] sm:text-[36px] md:text-[44px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: headlineShadow }}
            >
              Your exam is coming.
              <br />
              Let's get you ready.
            </h1>

            <p
              className="mt-5 text-[15px] md:text-[16px] leading-relaxed mx-auto md:mx-0 max-w-[520px]"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif", textShadow: subtextShadow }}
            >
              I'm Lee Ingram. Ole Miss accounting alum & tutor. I built this out of a love for helping students master their accounting course — not just survive it.
            </p>

            <TooltipProvider delayDuration={150}>
              <div style={{ marginTop: 16, marginBottom: 24 }} className="mx-auto md:mx-0 max-w-[560px] text-center md:text-left">
                <p
                  className="leading-snug"
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    textShadow: subtextShadow,
                  }}
                >
                  <span
                    className="text-white text-[34px] md:text-[42px] font-bold"
                    style={{ textShadow: headlineShadow }}
                  >
                    {headlineCount.toLocaleString()}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <sup className="cursor-help text-white text-[18px]" style={{ marginLeft: 2 }}>*</sup>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      Updated as students join. Placeholder until launch.
                    </TooltipContent>
                  </Tooltip>
                  <span
                    className="text-[18px] md:text-[22px] block mt-1"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    Ole Miss students have climbed this mountain with me.{" "}
                    <span style={{ color: RED, fontWeight: 700 }}>Your turn.</span>
                  </span>
                </p>
              </div>
            </TooltipProvider>

            <div className="flex justify-center md:justify-start">
              <button
                onClick={onGetStartedClick}
                className="rounded-lg px-7 py-3.5 text-[15px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
                style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.35)" }}
              >
                Get Started →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="staging-hero-overlay-bottom" />
    </section>
  );
}
