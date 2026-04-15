import { CheckCircle2, Users, BookOpen, Zap } from "lucide-react";
import { GlobeHeadshot } from "@/components/GlobeHeadshot";

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
            background: "linear-gradient(180deg, rgba(20,33,61,0.72) 0%, rgba(20,33,61,0.82) 50%, rgba(20,33,61,0.92) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[800px] px-4 sm:px-6 pt-12 sm:pt-16 pb-14 sm:pb-20">
        {/* Headline */}
        <h1
          className="text-[26px] sm:text-[38px] md:text-[44px] text-white leading-[1.15] tracking-tight text-center"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          Stop guessing.{" "}
          <span className="block sm:inline">Start passing your accounting exams.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mt-4 text-[14px] sm:text-[16px] text-center leading-relaxed max-w-[560px] mx-auto"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Step-by-step exam prep built from real student struggles and real exams.
          <br className="hidden sm:block" />
          No fluff. Just what actually shows up.
        </p>

        {/* Micro-proof row */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {[
            { icon: Users, text: "1,000+ students" },
            { icon: BookOpen, text: "Built from real exams" },
            { icon: Zap, text: "No fluff — just what matters" },
          ].map((item) => (
            <span
              key={item.text}
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-medium"
              style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif" }}
            >
              <item.icon className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.45)" }} />
              {item.text}
            </span>
          ))}
        </div>

        {/* Authority element */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            <GlobeHeadshot size={36} />
          </div>
          <div className="text-left">
            <p className="text-[12px] font-semibold text-white/80" style={{ fontFamily: "Inter, sans-serif" }}>
              Lee Ingram — Accounting tutor
            </p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}>
              Helping students since 2015
            </p>
          </div>
        </div>

        {/* Primary course card */}
        <div className="mt-8 sm:mt-10 mx-auto max-w-md">
          <button
            onClick={onLiveCourseClick}
            className="w-full text-left rounded-2xl p-5 sm:p-6 transition-all hover:scale-[1.01] active:scale-[0.99] group"
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
                <h3 className="text-[20px] sm:text-[22px] font-bold" style={{ color: NAVY }}>
                  {liveCourse.name}
                </h3>
                <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                  Ch 13–22 · Finals prep
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 mt-1 shrink-0" style={{ color: "#22C55E" }} />
            </div>

            <span
              className="block rounded-xl px-5 py-3.5 text-[15px] font-bold text-center text-white transition-all group-hover:brightness-110"
              style={{ background: RED }}
            >
              Start Studying →
            </span>
          </button>

          {/* Secondary link */}
          <p className="text-center mt-3">
            <button
              className="text-[12px] hover:underline transition-colors"
              style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif" }}
            >
              Buying for someone else?
            </button>
          </p>
        </div>

        {/* Separator + coming soon courses */}
        <div className="mt-10 sm:mt-12">
          <div className="flex items-center gap-3 mb-5 max-w-md mx-auto">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
            <p
              className="text-[13px] font-medium whitespace-nowrap"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}
            >
              More courses launching soon
            </p>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg sm:max-w-2xl mx-auto">
            {futureCourses.map((c) => (
              <button
                key={c.id}
                onClick={() => onNotifyClick(c)}
                className="text-left rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span className="text-[14px] font-semibold text-white/90 leading-snug">{c.name}</span>
                {c.subtext && (
                  <span className="text-[11px] block mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {c.subtext}
                  </span>
                )}
                <p className="text-[11px] font-medium mt-1.5 mb-3 flex-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {c.availability}
                </p>
                <span
                  className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-center transition-colors"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Get early access →
                </span>
                <p className="text-[10px] text-center mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Be first to get access + early discounts
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Debug panel (temporary) */}
        <div
          className="mt-10 mx-auto max-w-md rounded-lg p-3 text-[11px] font-mono space-y-1"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          <p className="font-bold text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            🛠 Debug
          </p>
          <p>email: {sessionStorage.getItem("student_email") || "—"}</p>
          <p>campus: {sessionStorage.getItem("campus_slug") || "—"}</p>
          <p>login: {sessionStorage.getItem("sa_test_mode") === "true" ? "test_mode" : "none"}</p>
        </div>
      </div>
    </div>
  );
}
