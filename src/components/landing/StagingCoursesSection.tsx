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
  "intermediate-accounting-1": "The weed-out course",
  "intermediate-accounting-2": "Even harder than the first one",
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
  const [loading, setLoading] = useState(false);

  const selected = ordered.find((c) => c.slug === selectedSlug);

  useEffect(() => {
    if (!selected) {
      setChapters([]);
      setProblemCount(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const minDelay = new Promise((r) => setTimeout(r, 400));
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
      await minDelay;
      if (cancelled) return;
      setChapters((chData ?? []) as Chapter[]);
      setProblemCount(typeof count === "number" ? count : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  /** Tag the user's intent before opening modal / navigating. */
  const tagIntent = (tag: string) => {
    if (!selected) return;
    try {
      sessionStorage.setItem(
        "sa_signup_intent",
        JSON.stringify({
          tag,
          course_slug: selected.slug,
          course_name: selected.name,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleStatClick = (tag: string) => {
    if (!selected) return;
    tagIntent(tag);
    onCardClick(selected);
  };

  const handleChapterRowClick = (ch: Chapter) => {
    if (!selected) return;
    tagIntent(`intent_chapter_${ch.chapter_number}`);
    if (onChapterClick) onChapterClick(selected, ch.chapter_number);
    else onCardClick(selected);
  };

  const handlePreviewFreeClick = () => {
    if (!selected) return;
    tagIntent("intent_preview_free");
    onCardClick(selected);
  };

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

        {/* Stats + Chapters — only after selection */}
        {selected && (
          <div
            className="mt-5 rounded-2xl p-3 sm:p-4 animate-fade-in"
            style={{
              background: "#fff",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {loading ? (
              <div className="flex flex-col md:flex-row gap-3 animate-pulse items-stretch">
                <div className="md:w-[35%] md:shrink-0 rounded-xl p-4" style={{ background: "#1a1a2e" }}>
                  <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-3 rounded w-3/4 mb-2" style={{ background: "rgba(255,255,255,0.12)" }} />
                        <div className="h-2 rounded w-1/2" style={{ background: "rgba(255,255,255,0.08)" }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:w-[65%] md:flex-1 rounded-xl p-4 flex flex-col gap-2" style={{ background: "#F9F9F9", border: "1px solid #E5E7EB" }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-5 rounded" style={{ background: "#EEF0F3" }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-3 items-stretch">
                {/* LEFT — navy callout block with stat items + CTA */}
                <div
                  className="md:w-[35%] md:shrink-0 rounded-xl p-4 pr-6 flex flex-col"
                  style={{ background: "#1a1a2e" }}
                >
                  <div className="flex flex-col gap-2 flex-1">
                    {[
                      {
                        tag: "intent_practice_problems",
                        title: problemCount && problemCount > 0
                          ? `${problemCount}+ Practice Problems`
                          : "Hundreds of Practice Problems",
                        subtext: "Step-by-step AI solutions",
                      },
                      { tag: "intent_cram_tools", title: "Get Cram Resources", subtext: "Study tools for every chapter" },
                      { tag: "intent_lee_on_demand", title: "Get Lee on Demand", subtext: "Personalized tutoring videos" },
                    ].map((stat) => (
                      <button
                        key={stat.tag}
                        type="button"
                        onClick={() => handleStatClick(stat.tag)}
                        className="rounded-lg p-3 text-left transition-all hover:bg-white/5 group flex items-center justify-between gap-2 w-full"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] sm:text-[13px] font-bold leading-tight text-white">
                            {stat.title}
                          </div>
                          <div
                            className="text-[10px] sm:text-[11px] mt-1 leading-snug"
                            style={{ color: "rgba(255,255,255,0.6)" }}
                          >
                            {stat.subtext}
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className="text-[16px] flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                          style={{ color: "rgba(255,255,255,0.5)" }}
                        >
                          →
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handlePreviewFreeClick}
                    className="mt-2 w-full rounded-lg px-4 py-3 text-[14px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99]"
                    style={{ background: RED, boxShadow: "0 4px 14px rgba(206,17,38,0.3)" }}
                  >
                    Start Free Preview →
                  </button>
                </div>

                {/* RIGHT — chapter list, own framed box */}
                <div
                  className="md:w-[65%] md:flex-1 rounded-xl p-4"
                  style={{ background: "#F9F9F9", border: "1px solid #E5E7EB" }}
                >
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wider mb-3 px-2"
                    style={{ color: "#9CA3AF" }}
                  >
                    What's Covered
                  </div>
                  {chapters.length === 0 ? (
                    <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
                      No chapters available yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col -mx-1">
                      {chapters.map((ch) => (
                        <li key={ch.id}>
                          <button
                            type="button"
                            onClick={() => handleChapterRowClick(ch)}
                            className="w-full flex items-baseline gap-2 text-[14px] text-left rounded-lg px-2 py-2 transition-colors hover:bg-white cursor-pointer"
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
            )}
          </div>
        )}

      </div>
    </section>
  );
}
