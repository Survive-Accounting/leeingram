import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const RED = "#CE1126";
const NAVY = "#14213D";
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
  const [semesterCount, setSemesterCount] = useState<number | null>(null);
  const [totalPaid, setTotalPaid] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [semRes, totRes] = await Promise.all([
          supabase.rpc("get_semester_enrollment_count" as any, { p_campus_slug: "ole-miss" }),
          supabase.rpc("get_paid_student_count_for_campus" as any, { p_campus_slug: "ole-miss" }),
        ]);
        if (cancelled) return;
        if (typeof semRes.data === "number") setSemesterCount(semRes.data);
        if (typeof totRes.data === "number") setTotalPaid(totRes.data);
      } catch {
        // fail silent
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const headlineCount = BASELINE_OLE_MISS + totalPaid;
  return (
    <section className="relative w-full overflow-hidden staging-hero">
      <style>{`
        .staging-hero {
          min-height: 480px;
        }
        @media (max-width: 768px) {
          .staging-hero { min-height: auto; padding-top: 32px; padding-bottom: 40px; }
        }
        .staging-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url('${HERO_IMAGE}');
          background-size: cover;
          background-position: 60% 40%;
          background-repeat: no-repeat;
          transform: scaleX(-1);
          z-index: 0;
        }
        .staging-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background: ${NAVY};
          opacity: 0.65;
          z-index: 1;
        }
        .staging-hero-fade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 120px;
          background: linear-gradient(to bottom, rgba(248,248,248,0) 0%, #F8F8F8 100%);
          z-index: 2;
          pointer-events: none;
        }
      `}</style>

      <div className="relative z-[3] mx-auto max-w-[1100px] px-4 sm:px-6 py-12 md:py-20">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* LEFT — Photo */}
          <div className="w-full md:w-[42%] flex justify-center md:justify-start">
            <img
              src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg"
              alt="Lee Ingram"
              className="w-full max-w-[300px] md:max-w-none rounded-lg shadow-xl"
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* RIGHT — Text */}
          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-white leading-[1.15] tracking-tight text-[28px] sm:text-[36px] md:text-[44px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Your exam is coming.
              <br />
              Let's get you ready.
            </h1>

            <p
              className="mt-5 text-[15px] md:text-[16px] leading-relaxed mx-auto md:mx-0 max-w-[520px]"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif" }}
            >
              I'm Lee Ingram. Ole Miss accounting alum & tutor. I built this out of a love for helping students master their accounting course — not just survive it.
            </p>

            <TooltipProvider delayDuration={150}>
              <div style={{ marginTop: 16, marginBottom: 24 }} className="mx-auto md:mx-0 max-w-[560px] text-center md:text-left">
                <p
                  className="text-[20px] md:text-[24px] leading-snug"
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                  }}
                >
                  {headlineCount.toLocaleString()}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <sup className="cursor-help" style={{ color: "rgba(255,255,255,0.9)" }}>*</sup>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      Updates as students join. Placeholder until launch.
                    </TooltipContent>
                  </Tooltip>
                  {" "}students across the SEC have survived their exam with this.{" "}
                  <span style={{ color: RED, fontWeight: 700 }}>Want in?</span>
                </p>
                {semesterCount !== null && semesterCount > 0 && (
                  <p
                    className="mt-2 text-[13px]"
                    style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif" }}
                  >
                    {semesterCount} student{semesterCount === 1 ? "" : "s"} enrolled this semester
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <sup className="cursor-help">*</sup>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs">
                        * We're counting — this updates as students join. Last verified April 2026.
                      </TooltipContent>
                    </Tooltip>
                  </p>
                )}
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

      <div className="staging-hero-fade" />
    </section>
  );
}
