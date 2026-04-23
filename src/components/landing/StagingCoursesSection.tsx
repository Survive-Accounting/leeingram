import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  courses: Course[];
  onCardClick: (course: Course) => void;
  onChapterClick?: (course: Course, chapterNumber: number) => void;
  onExpansionClick?: () => void;
}

const DISPLAY_ORDER = [
  "intro-accounting-1",
  "intro-accounting-2",
  "intermediate-accounting-1",
  "intermediate-accounting-2",
];

const SUBTEXT_BY_SLUG: Record<string, string> = {
  "intro-accounting-1": "Financial Principles",
  "intro-accounting-2": "Managerial Principles",
};

const TEXTBOOK_BY_SLUG: Record<string, string> = {
  "intro-accounting-1": "Based on Principles of Accounting (McGraw Hill)",
  "intro-accounting-2": "Based on Principles of Accounting (McGraw Hill)",
  "intermediate-accounting-1": "Based on Intermediate Accounting, 18th Ed. (Wiley)",
  "intermediate-accounting-2": "Based on Intermediate Accounting, 18th Ed. (Wiley)",
};

const COLOR_BY_SLUG: Record<string, { border: string; tint: string }> = {
  "intro-accounting-1": { border: "#BFDBFE", tint: "#EFF6FF" },
  "intro-accounting-2": { border: "#FCA5A5", tint: "#FEF2F2" },
  "intermediate-accounting-1": { border: "#86EFAC", tint: "#F0FDF4" },
  "intermediate-accounting-2": { border: "#FCD34D", tint: "#FFFBEB" },
};

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id: string;
}

export default function StagingCoursesSection({
  courses,
  onCardClick,
  onChapterClick,
}: StagingCoursesSectionProps) {
  const ordered = DISPLAY_ORDER
    .map((slug) => courses.find((c) => c.slug === slug))
    .filter(Boolean) as Course[];

  // No pre-selection
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [problemCount, setProblemCount] = useState<number | null>(null);

  const selected = ordered.find((c) => c.slug === selectedSlug);

  useEffect(() => {
    if (!selected) {
      setChapters([]);
      setProblemCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: chData }, { count }] = await Promise.all([
        supabase
          .from("chapters")
          .select("id, chapter_number, chapter_name, course_id")
          .eq("course_id", selected.id)
          .order("chapter_number", { ascending: true }),
        (supabase as any)
          .from("teaching_assets")
          .select("id", { count: "exact", head: true })
          .eq("course_id", selected.id)
          .not("asset_approved_at", "is", null),
      ]);
      if (cancelled) return;
      setChapters((chData ?? []) as Chapter[]);
      setProblemCount(typeof count === "number" ? count : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  return (
    <section className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: "#F8F8FA" }}>
      <style>{`
        @keyframes betaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

      <div className="mx-auto max-w-[920px]">

        <p
          className="text-center mb-4 text-[22px] sm:text-[28px] md:text-[34px] leading-tight"
          style={{ color: "#14213D", fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Which course are you studying?
        </p>

        {/* Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full rounded-2xl px-5 py-4 flex items-center justify-between text-left transition-all hover:shadow-md"
            style={{
              background: "#fff",
              borderLeft: `4px solid ${NAVY}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div className="flex flex-col">
              {selected ? (
                <>
                  <span className="text-[18px] sm:text-[20px] font-bold leading-tight" style={{ color: NAVY }}>
                    {selected.name}
                  </span>
                  {SUBTEXT_BY_SLUG[selected.slug] && (
                    <span className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                      {SUBTEXT_BY_SLUG[selected.slug]}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[17px] sm:text-[19px] font-semibold leading-tight" style={{ color: "#9CA3AF" }}>
                  Select your course →
                </span>
              )}
            </div>
            <ChevronDown
              className="w-5 h-5 flex-shrink-0 transition-transform"
              style={{ color: NAVY, transform: open ? "rotate(180deg)" : "none" }}
            />
          </button>

          {open && (
            <div
              className="absolute z-20 left-0 right-0 mt-2 rounded-2xl overflow-hidden"
              style={{
                background: "#fff",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
              }}
            >
              {ordered.map((c) => {
                const color = COLOR_BY_SLUG[c.slug];
                return (
                  <button
                    key={c.slug}
                    onClick={() => {
                      setSelectedSlug(c.slug);
                      setOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (color) e.currentTarget.style.background = color.tint;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    className="w-full px-5 py-3 text-left transition-colors"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      borderLeft: `4px solid ${color?.border ?? "transparent"}`,
                    }}
                  >
                    <div className="text-[15px] font-semibold" style={{ color: NAVY }}>
                      {c.name}
                    </div>
                    {SUBTEXT_BY_SLUG[c.slug] && (
                      <div className="text-[12px]" style={{ color: "#6B7280" }}>
                        {SUBTEXT_BY_SLUG[c.slug]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview Free button — appears once a course is selected */}
        {selected && (
          <>
            <button
              onClick={() => onCardClick(selected)}
              className="mt-4 w-full rounded-xl px-5 py-3.5 text-[14px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
              style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.25)" }}
            >
              Preview Free →
            </button>
            <p
              className="mt-2 text-center text-[12px]"
              style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
            >
              Already have an account?{" "}
              <Link to="/login" className="underline hover:no-underline" style={{ color: NAVY, fontWeight: 600 }}>
                Log in →
              </Link>
            </p>
          </>
        )}

        {/* Stats + Chapters — only after selection */}
        {selected && (
          <div
            className="mt-5 rounded-2xl p-5 sm:p-6"
            style={{
              background: "#fff",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div className="flex flex-col md:flex-row gap-5 md:gap-6">
              {/* LEFT — stat items + convergence lines */}
              <div className="md:w-[30%] md:shrink-0 relative">
                <div className="flex flex-col gap-3">
                  {[
                    {
                      title: problemCount && problemCount > 0
                        ? `${problemCount}+ Practice Problems`
                        : "Hundreds of Practice Problems",
                      subtext: "Step-by-step AI solutions",
                    },
                    { title: "Cram Tools", subtext: "Every chapter covered" },
                    { title: "Lee on Demand", subtext: "Personalized tutoring videos" },
                  ].map((stat) => (
                    <div
                      key={stat.title}
                      className="rounded-xl p-3 sm:p-3.5"
                      style={{ background: "#F8F8FA" }}
                    >
                      <div
                        className="text-[12px] sm:text-[13px] font-bold leading-tight"
                        style={{ color: NAVY }}
                      >
                        {stat.title}
                      </div>
                      <div
                        className="text-[10px] sm:text-[11px] mt-1 leading-snug"
                        style={{ color: "#6B7280" }}
                      >
                        {stat.subtext}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Convergence arrows — desktop only */}
                <svg
                  className="hidden md:block absolute pointer-events-none"
                  style={{ right: -18, top: 0, width: 40, height: "100%" }}
                  viewBox="0 0 40 200"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M0 25 Q 25 25 32 100" stroke="#D1D5DB" strokeWidth="1" fill="none" />
                  <path d="M0 100 L 32 100" stroke="#D1D5DB" strokeWidth="1" fill="none" />
                  <path d="M0 175 Q 25 175 32 100" stroke="#D1D5DB" strokeWidth="1" fill="none" />
                  <path d="M32 70 L 32 130" stroke="#D1D5DB" strokeWidth="1.5" fill="none" />
                  <path d="M32 100 L 38 96 M32 100 L 38 104" stroke="#D1D5DB" strokeWidth="1" fill="none" />
                </svg>
              </div>

              {/* RIGHT — chapter list */}
              <div className="md:w-[70%] md:flex-1">
                {chapters.length === 0 ? (
                  <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
                    Loading chapters…
                  </p>
                ) : (
                  <ul className="flex flex-col -mx-2">
                    {chapters.map((ch) => (
                      <li key={ch.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onChapterClick
                              ? onChapterClick(selected, ch.chapter_number)
                              : onCardClick(selected)
                          }
                          className="w-full flex items-baseline gap-2 text-[14px] text-left rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 cursor-pointer"
                          style={{ color: NAVY }}
                        >
                          <span className="text-[12px] font-semibold w-12 flex-shrink-0" style={{ color: "#9CA3AF" }}>
                            Ch. {ch.chapter_number}
                          </span>
                          <span>{ch.chapter_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <p
          className="mt-8 text-center text-[14px]"
          style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
        >
          AI-enabled study tools curated by a real tutor for maximum exam impact. Started at University of Mississippi. Built for accounting students anywhere.
        </p>
      </div>
    </section>
  );
}
