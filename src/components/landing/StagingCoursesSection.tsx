import { CheckCircle2 } from "lucide-react";

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

interface StagingCoursesSectionProps {
  liveCourse: Course;
  futureCourses: Course[];
  onLiveCourseClick: () => void;
  onNotifyClick: (course: Course) => void;
}

export default function StagingCoursesSection({
  liveCourse,
  futureCourses,
  onLiveCourseClick,
  onNotifyClick,
}: StagingCoursesSectionProps) {
  return (
    <section className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[420px]">
        {/* Primary course card */}
        <button
          onClick={onLiveCourseClick}
          className="w-full text-left rounded-2xl p-5 transition-all hover:scale-[1.01] active:scale-[0.99] group"
          style={{
            background: "#fff",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
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
                Exam prep for the full course
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

          <div className="mt-3 text-center">
            <p className="text-[14px] font-semibold" style={{ color: NAVY }}>
              <span className="text-[13px] line-through" style={{ color: "#9CA3AF" }}>$250</span>
              {" "}
              <span className="text-[16px] font-bold" style={{ color: NAVY }}>$99 one-time</span>
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>Full access through finals week</p>
          </div>
        </button>

        {/* More courses */}
        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: "#F3F4F6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <p
            className="text-[12px] font-medium text-center mb-3"
            style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
          >
            More courses launching soon
          </p>

          <div className="space-y-2">
            {[...futureCourses]
              .sort((a, b) => {
                const order: Record<string, number> = {
                  "intro-accounting-1": 0,
                  "intro-accounting-2": 1,
                  "intermediate-accounting-1": 2,
                };
                return (order[a.slug] ?? 9) - (order[b.slug] ?? 9);
              })
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => onNotifyClick(c)}
                  className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-between gap-3"
                  style={{ background: "#fff", border: "1px solid #E5E7EB" }}
                >
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold leading-snug block" style={{ color: NAVY }}>
                      {c.name}
                    </span>
                    <span className="text-[11px] block mt-0.5" style={{ color: "#9CA3AF" }}>
                      {c.availability}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap"
                    style={{ border: `1px solid ${NAVY}30`, color: NAVY, opacity: 0.7 }}
                  >
                    Join waitlist →
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
