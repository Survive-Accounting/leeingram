import { CheckCircle2 } from "lucide-react";
import leeHeadshot from "@/assets/lee-headshot-styled.png";

const NAVY = "#14213D";
const RED = "#CE1126";

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
}

export default function StagingHero({ liveCourse, futureCourses, onLiveCourseClick, onNotifyClick }: StagingHeroProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Background image + overlay */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "60% 40%",
            backgroundRepeat: "no-repeat",
            transform: "scaleX(-1)",
            filter: "blur(1px)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(20,33,61,0.75) 0%, rgba(20,33,61,0.85) 50%, rgba(20,33,61,0.95) 100%)",
          }}
        />
      </div>

      {/* Content — 2 column desktop, stacked mobile */}
      <div className="relative z-10 mx-auto max-w-[1000px] px-4 sm:px-6 pt-10 sm:pt-14 pb-12 sm:pb-16">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

          {/* LEFT — Message */}
          <div className="flex-1 min-w-0 md:pt-2">
            <h1
              className="text-[24px] sm:text-[32px] md:text-[38px] text-white leading-[1.15] tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Start passing your accounting exams with confidence.
            </h1>

            {/* Byline */}
            <div className="mt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
                <img src={leeHeadshot} alt="Lee Ingram" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white/85" style={{ fontFamily: "Inter, sans-serif" }}>
                  Lee Ingram — Accounting tutor
                </p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Helping students since 2015
                </p>
              </div>
            </div>

            {/* Core message */}
            <p
              className="mt-5 text-[14px] sm:text-[15px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif" }}
            >
              I built this from years of real tutoring sessions — helping students go from
              <span className="text-white/90"> "I don't get this" </span>
              to
              <span className="text-white/90"> "ohhh that makes sense."</span>
            </p>
            <p
              className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter, sans-serif" }}
            >
              It's not a replacement for your class — it's what makes it finally click.
            </p>

            {/* Value bullets */}
            <ul className="mt-5 space-y-2">
              {[
                "Built from real tutoring sessions",
                "Helps you understand — not just memorize",
                "Designed to make class and exams finally click",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2 text-[12px] sm:text-[13px]" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,0.35)" }} />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — Course cards */}
          <div className="w-full md:w-[340px] shrink-0">
            {/* Primary course card */}
            <button
              onClick={onLiveCourseClick}
              className="w-full text-left rounded-2xl p-5 transition-all hover:scale-[1.01] active:scale-[0.99] group"
              style={{
                background: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white mb-2"
                    style={{ background: "#22C55E" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    AVAILABLE NOW
                  </span>
                  <h3 className="text-[18px] sm:text-[20px] font-bold" style={{ color: NAVY }}>
                    {liveCourse.name}
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                    Ch 13–22 · Finals prep
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 mt-1 shrink-0" style={{ color: "#22C55E" }} />
              </div>

              <span
                className="block rounded-xl px-5 py-3 text-[14px] font-bold text-center text-white transition-all group-hover:brightness-110"
                style={{ background: RED }}
              >
                Start Studying →
              </span>
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 mt-5 mb-4">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
              <p className="text-[12px] font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Inter, sans-serif" }}>
                More courses launching soon
              </p>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Secondary course cards */}
            <div className="space-y-2.5">
              {futureCourses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onNotifyClick(c)}
                  className="w-full text-left rounded-xl p-3.5 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-between gap-3"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold text-white/85 leading-snug block">{c.name}</span>
                    <span className="text-[11px] block mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {c.availability}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap"
                    style={{
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    Get early access →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
