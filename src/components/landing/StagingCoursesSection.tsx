import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Video, BookOpen, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";
const RED = "#CE1126";
const FINALS_DATE = new Date(2026, 4, 4); // May 4, 2026 (local)

/** Returns weeks-only countdown text, or null after May 4. */
function getFinalsCountdownText(): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(FINALS_DATE.getFullYear(), FINALS_DATE.getMonth(), FINALS_DATE.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((target.getTime() - today.getTime()) / msPerDay);
  if (days <= 0) return null;
  const weeks = Math.floor(days / 7);
  if (weeks < 1) return "Final exams are almost here.";
  if (weeks === 1) return "Final exams are 1 week away.";
  return `Final exams are ${weeks} weeks away.`;
}

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
  onChapterClick?: (course: Course, chapterNumber: number, chapterName?: string) => void;
  onExpansionClick?: () => void;
  /** Opens the Get Started email modal; passes selected slug for preselection. */
  onGetStartedClick?: (preselectedSlug: string | null) => void;
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
  "intermediate-accounting-1": "The toughest course you'll ever take",
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
  onGetStartedClick,
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
  const [powerPhase, setPowerPhase] = useState<"off" | "warm" | "expand" | "flash" | "on">("off");
  const laptopRef = useRef<HTMLDivElement>(null);

  const selected = ordered.find((c) => c.slug === selectedSlug);

  // Power-on sequence triggered when a course is selected
  useEffect(() => {
    if (!selected) {
      setPowerPhase("off");
      return;
    }
    setPowerPhase("warm");
    const t1 = setTimeout(() => setPowerPhase("expand"), 200);
    const t2 = setTimeout(() => setPowerPhase("flash"), 500);
    const t3 = setTimeout(() => setPowerPhase("on"), 600);
    const t4 = setTimeout(() => {
      laptopRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [selectedSlug]);

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
    if (onChapterClick) onChapterClick(selected, ch.chapter_number, ch.chapter_name);
    else onCardClick(selected);
  };

  const handlePreviewFreeClick = () => {
    if (!selected) return;
    tagIntent("intent_preview_free");
    onCardClick(selected);
  };

  return (
    <section
      id="courses-section"
      className="relative px-4 sm:px-6 scroll-mt-0 overflow-hidden"
      style={{
        background: "#F3F4F6",
        borderTop: "1px solid #E5E7EB",
        paddingTop: 80,
        paddingBottom: 80,
      }}
    >
      <style>{`
        @keyframes betaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

      {/* Section intro — heading + subtext */}
      <div className="mx-auto text-center mb-6" style={{ maxWidth: 560 }}>
        <h2
          className="text-[24px] sm:text-[28px] leading-tight"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: NAVY }}
        >
          See it in action
        </h2>
        <p
          className="mt-3 text-[15px]"
          style={{ fontFamily: "Inter, sans-serif", color: "#6B7280", maxWidth: 400, margin: "12px auto 0" }}
        >
          Pick a course, open a practice problem, and try the AI tools free.
        </p>
      </div>

      <div className="relative mx-auto max-w-[920px]" style={{ zIndex: 2 }}>

        {/* Mobile-only dropdown (desktop dropdown lives inside the laptop screen) */}
        <div className="md:hidden relative" style={{ zIndex: 100 }}>
          <div className="text-center mb-3">
            <span
              className="inline-block text-[12px] font-bold uppercase rounded-full"
              style={{
                background: NAVY,
                color: "#FFFFFF",
                fontFamily: "Inter, sans-serif",
                padding: "8px 20px",
                letterSpacing: "0.08em",
              }}
            >
              Try a demo
            </span>
          </div>
          <DropdownButton
            selected={selected}
            open={open}
            setOpen={setOpen}
            ordered={ordered}
            setSelectedSlug={setSelectedSlug}
          />
        </div>

        {/* Inner content: tab nav + chapter grid (rendered inside laptop on desktop, raw on mobile) */}
        {(() => {
          const innerContent = selected ? (
            <DemoScreen
              courseName={selected.name}
              chapters={chapters}
              loading={loading}
              onChange={() => {
                setSelectedSlug("");
                setOpen(true);
              }}
              onGetStartedClick={() => {
                if (onGetStartedClick) onGetStartedClick(selected.slug);
              }}
            />
          ) : null;

          return (
            <>
              {/* DESKTOP — MacBook frame */}
              <div ref={laptopRef} className="hidden md:block mt-6 mx-auto" style={{ maxWidth: 860 }}>
                {/* Eyebrow above the laptop — pill badge */}
                <div className="text-center mb-4">
                  <span
                    className="inline-block text-[12px] font-bold uppercase rounded-full"
                    style={{
                      background: NAVY,
                      color: "#FFFFFF",
                      fontFamily: "Inter, sans-serif",
                      padding: "8px 20px",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Try a demo
                  </span>
                </div>
                <style>{`
                  @keyframes mbScanlines {
                    0% { background-position: 0 0; }
                    100% { background-position: 0 4px; }
                  }
                  @keyframes mbCrtExpand {
                    0% { transform: scaleY(0.01); opacity: 1; }
                    100% { transform: scaleY(1); opacity: 1; }
                  }
                  @keyframes mbContentFade {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                  }
                  @keyframes cursorBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                  }
                  @keyframes demoIdleFadeUp {
                    0% { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                  }
                  .demo-cursor {
                    display: inline-block;
                    margin-left: 4px;
                    color: #93C5FD;
                    font-weight: 300;
                    animation: demoCursorBlink 1.6s ease-in-out infinite;
                    text-shadow: 0 0 8px rgba(147,197,253,0.5);
                  }
                  .demo-idle-content > h2 {
                    opacity: 0;
                    animation: demoIdleFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s forwards;
                  }
                  .demo-dropdown-anim {
                    opacity: 0;
                    animation: demoIdleFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.45s forwards;
                  }
                `}</style>
                {/* Lid */}
                <div
                  className="relative mx-auto"
                  style={{
                    background: "linear-gradient(180deg, #d8dadd 0%, #c2c4c8 100%)",
                    borderRadius: "18px 18px 6px 6px",
                    padding: "14px 14px 18px 14px",
                    boxShadow: "0 30px 60px -20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
                    border: "1px solid #a8aaae",
                  }}
                >
                  {/* Screen bezel */}
                  <div
                    style={{
                      background: "#0a0a0a",
                      borderRadius: 8,
                      padding: 12,
                      border: "1px solid #1a1a1a",
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                  >
                    {/* Camera dot */}
                    <div className="flex justify-center mb-2">
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#222", boxShadow: "inset 0 0 2px rgba(255,255,255,0.15)" }} />
                    </div>
                    {/* Screen — 16:10 (always "powered on" with subtle glow) */}
                    <div
                      className="relative w-full"
                      style={{
                        aspectRatio: "16 / 10",
                        minHeight: 440,
                        overflow: "visible",
                        background:
                          "radial-gradient(ellipse at 50% 0%, #1a2845 0%, #0f1a30 60%, #0a1224 100%)",
                        borderRadius: 3,
                        boxShadow:
                          "inset 0 0 60px rgba(80,120,200,0.15), inset 0 0 120px rgba(20,33,61,0.4)",
                      }}
                    >
                      {/* Subtle scanlines */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 3px)",
                          animation: "mbScanlines 6s linear infinite",
                        }}
                      />
                      {/* Soft top vignette glow */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(120,160,255,0.08) 0%, transparent 70%)",
                        }}
                      />

                      {/* Power-on flash overlays (only during transition into selected state) */}
                      {powerPhase === "warm" && (
                        <div className="absolute inset-0" style={{ background: "#1a1a1a", opacity: 0.6 }} />
                      )}
                      {powerPhase === "expand" && (
                        <div
                          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-white"
                          style={{
                            height: "100%",
                            transformOrigin: "center",
                            animation: "mbCrtExpand 300ms ease-out forwards",
                          }}
                        />
                      )}
                      {powerPhase === "flash" && (
                        <div className="absolute inset-0 bg-white" />
                      )}

                      {/* Content fade-in (course selected) — player fills full screen */}
                      {powerPhase === "on" && innerContent && (
                        <div
                          className="absolute inset-0"
                          style={{
                            animation: "mbContentFade 400ms ease-out forwards",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          {innerContent}
                        </div>
                      )}

                      {/* Idle / off state — headline + dropdown LIVE INSIDE the screen */}
                      {powerPhase === "off" && (
                        <div className="absolute inset-0 flex flex-col items-center px-8 pt-[14%] demo-idle-content">
                          {/* Faint radial glow behind text — "screen is on" feel */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background:
                                "radial-gradient(ellipse 55% 45% at 50% 35%, rgba(147,197,253,0.10) 0%, rgba(147,197,253,0.04) 40%, transparent 75%)",
                            }}
                          />
                          <h2
                            className="relative text-center text-white leading-tight text-[22px] sm:text-[28px] md:text-[34px]"
                            style={{
                              fontFamily: "'DM Serif Display', serif",
                              fontWeight: 400,
                              textShadow: "0 2px 16px rgba(120,160,255,0.25)",
                            }}
                          >
                            Which course are you studying?
                            <span
                              aria-hidden="true"
                              style={{
                                display: "inline-block",
                                width: "3px",
                                height: "1em",
                                background: RED,
                                marginLeft: "6px",
                                verticalAlign: "middle",
                                animation: "cursorBlink 1s step-end infinite",
                                boxShadow: "0 0 10px rgba(206,17,38,0.5)",
                              }}
                            />
                          </h2>
                          <div className="relative w-full max-w-[460px] mt-4 demo-dropdown-anim">
                            <DropdownButton
                              selected={selected}
                              open={open}
                              setOpen={setOpen}
                              ordered={ordered}
                              setSelectedSlug={setSelectedSlug}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Hinge / base */}
                <div
                  className="mx-auto relative"
                  style={{
                    background: "linear-gradient(180deg, #b8bbbf 0%, #9da0a4 100%)",
                    height: 14,
                    width: "104%",
                    marginLeft: "-2%",
                    borderRadius: "0 0 18px 18px",
                    boxShadow: "0 6px 14px rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-0 rounded-b-lg"
                    style={{ width: "18%", height: 5, background: "rgba(0,0,0,0.18)" }}
                  />
                </div>
              </div>

              {/* MOBILE — content directly, no frame */}
              {selected && (
                <div
                  className="mt-5 rounded-2xl p-3 sm:p-4 animate-fade-in md:hidden"
                  style={{
                    background: "#fff",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {innerContent}
                </div>
              )}
            </>
          );
        })()}

      </div>
    </section>
  );
}

// ── DropdownButton (used both inside the laptop screen and on mobile) ──
interface DropdownButtonProps {
  selected: Course | undefined;
  open: boolean;
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  ordered: Course[];
  setSelectedSlug: (slug: string) => void;
}

function DropdownButton({ selected, open, setOpen, ordered, setSelectedSlug }: DropdownButtonProps) {
  return (
    <div className="relative mx-auto" style={{ zIndex: 100, maxWidth: 440 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left transition-all hover:shadow-md"
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "16px 20px",
          border: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        <div className="flex flex-col">
          {selected ? (
            <>
              <span className="text-[15px] font-semibold leading-tight" style={{ color: NAVY }}>
                {selected.name}
              </span>
              {SUBTEXT_BY_SLUG[selected.slug] && (
                <span className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                  {SUBTEXT_BY_SLUG[selected.slug]}
                </span>
              )}
            </>
          ) : (
            <span className="text-[15px] font-medium leading-tight" style={{ color: "#9CA3AF" }}>
              Select your course →
            </span>
          )}
        </div>
        <ChevronDown
          className="w-5 h-5 flex-shrink-0"
          style={{
            color: NAVY,
            transition: "transform 200ms ease",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-2 overflow-hidden"
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
            zIndex: 110,
          }}
        >
          {ordered.map((c) => {
            const isActive = selected?.slug === c.slug;
            return (
              <button
                key={c.slug}
                onClick={() => {
                  setSelectedSlug(c.slug);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#F3F4F6";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
                className="w-full text-left transition-colors block"
                style={{
                  padding: "14px 16px",
                  background: isActive ? NAVY : "transparent",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div
                  className="text-[14px] font-semibold"
                  style={{ color: isActive ? "#FFFFFF" : NAVY }}
                >
                  {c.name}
                </div>
                {SUBTEXT_BY_SLUG[c.slug] && (
                  <div
                    className="text-[12px] font-normal mt-0.5"
                    style={{ color: isActive ? "rgba(255,255,255,0.75)" : "#6B7280" }}
                  >
                    {SUBTEXT_BY_SLUG[c.slug]}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DemoScreen (renders inside the laptop screen) ──
type DemoAssetType = "BE" | "EX" | "P";

interface DemoScreenProps {
  courseName: string;
  chapters: Chapter[];
  loading: boolean;
  onChange: () => void;
  onGetStartedClick?: () => void;
}

interface DemoProblem {
  id: string;
  source_ref: string | null;
  source_number: string | null;
  problem_title: string | null;
}

interface DemoProblemDetail {
  survive_problem_text: string | null;
  problem_title: string | null;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  instruction_4: string | null;
  instruction_5: string | null;
  survive_solution_text: string | null;
  survive_solution_json: any;
}

const DEMO_TYPE_PREFIXES: Record<DemoAssetType, string[]> = {
  BE: ["BE", "QS"],
  EX: ["E"],
  P: ["P"],
};

const DEMO_TYPE_LABELS: Record<DemoAssetType, string> = {
  BE: "brief exercises",
  EX: "exercises",
  P: "problems",
};

function DemoScreen({ courseName, chapters, loading, onChange, onGetStartedClick }: DemoScreenProps) {
  // Detect narrow laptop screen — collapse sidebar by default on mobile
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 600 : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsNarrow(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(!isNarrow);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<DemoAssetType>("BE");
  const [problems, setProblems] = useState<DemoProblem[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [problemDetail, setProblemDetail] = useState<DemoProblemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [chapterCounts, setChapterCounts] = useState<Record<DemoAssetType, number>>({ BE: 0, EX: 0, P: 0 });

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;

  // When narrow, force sidebar collapsed unless user explicitly toggles
  useEffect(() => {
    if (isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  // Reset selection if chapters list changes (new course)
  useEffect(() => {
    setSelectedChapterId(null);
    setActiveType("BE");
    setSelectedProblemId(null);
    setProblemDetail(null);
  }, [courseName]);

  // Reset problem selection when chapter or type changes
  useEffect(() => {
    setSelectedProblemId(null);
    setProblemDetail(null);
    setSolutionOpen(false);
  }, [selectedChapterId, activeType]);

  // Fetch counts per type when chapter changes
  useEffect(() => {
    if (!selectedChapter) {
      setChapterCounts({ BE: 0, EX: 0, P: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("teaching_assets")
        .select("source_ref")
        .eq("chapter_id", selectedChapter.id)
        .not("asset_approved_at", "is", null)
        .limit(2000);
      if (cancelled || error) return;
      const counts: Record<DemoAssetType, number> = { BE: 0, EX: 0, P: 0 };
      ((data ?? []) as { source_ref: string | null }[]).forEach((r) => {
        const ref = (r.source_ref ?? "").toUpperCase();
        if (ref.startsWith("BE") || ref.startsWith("QS")) counts.BE += 1;
        else if (ref.startsWith("E")) counts.EX += 1;
        else if (ref.startsWith("P")) counts.P += 1;
      });
      setChapterCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChapter?.id]);

  // Keyboard navigation: arrow up/down to move within problems, Enter to select, Escape to close solution
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && solutionOpen) {
        setSolutionOpen(false);
        return;
      }
      if (problems.length === 0) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      // Don't hijack typing in inputs
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = problems.findIndex((p) => p.id === selectedProblemId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = idx < 0 ? 0 : Math.min(idx + 1, problems.length - 1);
        setSelectedProblemId(problems[next].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = idx <= 0 ? 0 : idx - 1;
        setSelectedProblemId(problems[next].id);
      } else if (e.key === "Enter" && idx >= 0) {
        e.preventDefault();
        setSolutionOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [problems, selectedProblemId, solutionOpen]);

  // Fetch problems when chapter or type changes
  useEffect(() => {
    if (!selectedChapter) {
      setProblems([]);
      setProblemsLoading(false);
      return;
    }
    let cancelled = false;
    setProblemsLoading(true);
    (async () => {
      const prefixes = DEMO_TYPE_PREFIXES[activeType];
      // Use ilike OR for prefix matching on source_ref
      let query = (supabase as any)
        .from("teaching_assets")
        .select("id, source_ref, source_number, problem_title")
        .eq("chapter_id", selectedChapter.id)
        .not("asset_approved_at", "is", null)
        .order("source_ref", { ascending: true })
        .limit(20);

      const orFilter = prefixes.map((p) => `source_ref.ilike.${p}%`).join(",");
      query = query.or(orFilter);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error("[demo] problems fetch error", error);
        setProblems([]);
      } else {
        // Filter strictly by prefix (so "E" doesn't match nothing weird, "P" excludes BE/QS already by .or)
        const filtered = ((data ?? []) as DemoProblem[]).filter((row) => {
          const ref = (row.source_ref ?? "").toUpperCase();
          if (activeType === "BE") return ref.startsWith("BE") || ref.startsWith("QS");
          if (activeType === "EX") return ref.startsWith("E") && !ref.startsWith("EX");
          if (activeType === "P") return ref.startsWith("P") && !ref.startsWith("PR");
          return false;
        });
        setProblems(filtered);
      }
      setProblemsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChapter?.id, activeType]);

  // Fetch problem detail when selected
  useEffect(() => {
    if (!selectedProblemId) {
      setProblemDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setSolutionOpen(false);
    const minDelay = new Promise((r) => setTimeout(r, 600));
    (async () => {
      const { data, error } = await (supabase as any)
        .from("teaching_assets")
        .select(
          "survive_problem_text, problem_title, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, survive_solution_text, survive_solution_json"
        )
        .eq("id", selectedProblemId)
        .maybeSingle();
      await minDelay;
      if (cancelled) return;
      if (error) {
        console.error("[demo] problem detail error", error);
        setProblemDetail(null);
      } else {
        setProblemDetail((data ?? null) as DemoProblemDetail | null);
      }
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProblemId]);

  const typePills: { key: DemoAssetType; label: string }[] = [
    { key: "BE", label: "Brief Exercises" },
    { key: "EX", label: "Exercises" },
    { key: "P", label: "Problems" },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#14213D",
        animation: "demoPlayerFadeIn 250ms ease-out forwards",
        opacity: 0,
      }}
    >
      <style>{`
        @keyframes demoPlayerFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes demoSidebarSlideIn {
          0% { opacity: 0; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes demoRightPanelFadeUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoSkeletonShimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .demo-skeleton-row {
          height: 36px;
          margin: 4px 12px;
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0%,
            rgba(255,255,255,0.10) 50%,
            rgba(255,255,255,0.04) 100%
          );
          background-size: 200px 100%;
          background-repeat: no-repeat;
          animation: demoSkeletonShimmer 1.4s ease-in-out infinite;
        }
        .demo-chapter-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          margin: 2px 8px;
          border-radius: 6px;
          cursor: pointer;
          border-left: 3px solid transparent;
          transition: background 150ms ease, border-color 150ms ease;
        }
        .demo-chapter-row:hover { background: rgba(255,255,255,0.06); }
        .demo-chapter-row:hover .demo-chapter-name { color: rgba(255,255,255,1); }
        .demo-chapter-row.is-selected {
          background: rgba(206,17,38,0.2);
          border-left-color: #CE1126;
        }
        .demo-chapter-row.is-selected .demo-chapter-name {
          color: #fff;
          font-weight: 600;
        }
        .demo-chapter-row.is-selected .demo-chapter-pill {
          background: #CE1126;
          color: #fff;
        }
        .demo-chapter-pill {
          font-size: 10px;
          font-weight: 700;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.6);
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          transition: background 150ms ease, color 150ms ease;
        }
        .demo-chapter-name {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          flex: 1;
          transition: color 150ms ease, font-weight 150ms ease;
        }
        @keyframes demoSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes demoViewerFadeUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .demo-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(206,17,38,0.3);
          border-top-color: #CE1126;
          border-radius: 50%;
          animation: demoSpin 800ms linear infinite;
        }
        .demo-problem-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          margin: 2px 12px;
          border-radius: 6px;
          cursor: pointer;
          border-left: 3px solid transparent;
          transition: background 150ms ease, border-color 150ms ease;
        }
        .demo-problem-row:hover { background: rgba(255,255,255,0.06); }
        .demo-problem-row.is-selected {
          background: rgba(206,17,38,0.15);
          border-left-color: #CE1126;
        }
        .demo-problem-row.is-selected .demo-problem-badge {
          background: #CE1126;
          color: #fff;
        }
        .demo-problem-badge {
          font-size: 10px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          padding: 2px 7px;
          border-radius: 4px;
          flex-shrink: 0;
          transition: background 150ms ease, color 150ms ease;
        }
        .demo-problem-title {
          font-size: 13px;
          font-weight: 400;
          font-family: Inter, sans-serif;
          color: rgba(255,255,255,0.75);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          flex: 1;
        }
        .demo-thin-scroll::-webkit-scrollbar { width: 4px; }
        .demo-thin-scroll::-webkit-scrollbar-track { background: transparent; }
        .demo-thin-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 2px;
        }
        .demo-pill-count {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
          color: inherit;
          opacity: 0.55;
        }
        .demo-pill-active .demo-pill-count {
          opacity: 1;
          background: rgba(20,33,61,0.12);
          color: #14213D;
        }
        .demo-solution-locked {
          position: relative;
          max-height: 56px;
          overflow: hidden;
        }
        .demo-solution-fade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 110%;
          background: linear-gradient(to bottom, transparent 0%, #14213D 80%);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 6px;
          pointer-events: none;
        }
        .demo-solution-unlock {
          pointer-events: auto;
          font-size: 11px;
          font-weight: 600;
          font-family: Inter, sans-serif;
          color: #D4AF37;
          background: rgba(212,175,55,0.15);
          border: none;
          padding: 6px 14px;
          border-radius: 999px;
          cursor: pointer;
        }
      `}</style>

      {/* Top bar */}
      <div
        className="flex items-center"
        style={{
          height: 36,
          background: "#0A1628",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 12px",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            width: 28,
            height: 28,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            color: "#fff",
            fontSize: 14,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {sidebarOpen ? "«" : "»"}
        </button>
        <div
          className="flex-1 text-center"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            paddingLeft: 8,
            paddingRight: 8,
          }}
          title={isNarrow && selectedChapter ? `Ch. ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}` : "Survive Accounting"}
        >
          {isNarrow && selectedChapter
            ? `Ch. ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}`
            : "Survive Accounting"}
        </div>
        <div style={{ width: 28 }} />
      </div>

      {/* Body: sidebar + right panel */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside
          style={{
            width: sidebarOpen ? 220 : 0,
            minWidth: sidebarOpen ? 220 : 0,
            height: "100%",
            background: "#0D1B2E",
            borderRight: sidebarOpen ? "1px solid rgba(255,255,255,0.08)" : "none",
            overflowY: "auto",
            overflowX: "hidden",
            flexShrink: 0,
            transition: "width 200ms ease, min-width 200ms ease",
            opacity: 0,
            animation: "demoSidebarSlideIn 300ms ease-out 100ms forwards",
          }}
        >
          {/* Sidebar header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              title={courseName}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {courseName}
            </span>
            <button
              type="button"
              onClick={onChange}
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: RED,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                whiteSpace: "nowrap",
              }}
            >
              Change →
            </button>
          </div>

          {/* Sidebar body — chapters list / loading / empty */}
          <div style={{ paddingTop: 8, paddingBottom: 12 }}>
            {loading ? (
              <>
                <div className="demo-skeleton-row" />
                <div className="demo-skeleton-row" />
                <div className="demo-skeleton-row" />
                <div className="demo-skeleton-row" />
              </>
            ) : chapters.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.3)",
                  textAlign: "center",
                  padding: 20,
                }}
              >
                No chapters yet
              </div>
            ) : (
              chapters.map((ch) => {
                const isSelected = selectedChapterId === ch.id;
                return (
                  <div
                    key={ch.id}
                    className={`demo-chapter-row${isSelected ? " is-selected" : ""}`}
                    onClick={() => setSelectedChapterId(ch.id)}
                  >
                    <span className="demo-chapter-pill">Ch. {ch.chapter_number}</span>
                    <span className="demo-chapter-name" title={ch.chapter_name}>
                      {ch.chapter_name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right panel */}
        <main
          className="flex-1 relative"
          style={{
            background: "#14213D",
            overflowY: "auto",
            opacity: 0,
            animation: "demoRightPanelFadeUp 300ms ease-out 150ms forwards",
          }}
        >
          {selectedChapter ? (
            <div className="absolute inset-0 flex flex-col">
              {/* Chapter heading */}
              <div
                style={{
                  padding: "20px 24px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                >
                  Ch. {selectedChapter.chapter_number}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontFamily: '"DM Serif Display", serif',
                    color: "#fff",
                    lineHeight: 1.2,
                  }}
                >
                  {selectedChapter.chapter_name}
                </div>
              </div>

              {/* Type pills */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "14px 24px",
                  flexShrink: 0,
                }}
              >
                {typePills.map((p) => {
                  const active = activeType === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setActiveType(p.key)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "Inter, sans-serif",
                        cursor: "pointer",
                        border: "none",
                        transition: "all 150ms ease",
                        background: active ? "#fff" : "rgba(255,255,255,0.08)",
                        color: active ? "#14213D" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Problem list area */}
              <div
                style={{
                  flex: selectedProblemId ? "0 0 auto" : 1,
                  maxHeight: selectedProblemId ? 200 : undefined,
                  overflowY: "auto",
                  borderBottom: selectedProblemId ? "1px solid rgba(255,255,255,0.08)" : "none",
                  paddingBottom: 8,
                }}
              >
                {problemsLoading ? (
                  <div style={{ paddingTop: 4 }}>
                    <div className="demo-skeleton-row" style={{ marginLeft: 12, marginRight: 12 }} />
                    <div className="demo-skeleton-row" style={{ marginLeft: 12, marginRight: 12 }} />
                    <div className="demo-skeleton-row" style={{ marginLeft: 12, marginRight: 12 }} />
                  </div>
                ) : problems.length === 0 ? (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.3)",
                      textAlign: "center",
                      padding: 24,
                    }}
                  >
                    No {DEMO_TYPE_LABELS[activeType]} in this chapter yet.
                  </div>
                ) : (
                  problems.map((p) => {
                    const isSel = selectedProblemId === p.id;
                    const ref = p.source_number || p.source_ref || "—";
                    const title = p.problem_title || "Untitled problem";
                    return (
                      <div
                        key={p.id}
                        className={`demo-problem-row${isSel ? " is-selected" : ""}`}
                        onClick={() => setSelectedProblemId(p.id)}
                      >
                        <span className="demo-problem-badge">{ref}</span>
                        <span className="demo-problem-title" title={title}>
                          {title}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Problem viewer (bottom half) */}
              {selectedProblemId && (
                <div
                  key={selectedProblemId}
                  style={{
                    flex: 1,
                    position: "relative",
                    overflow: "hidden",
                    animation: "demoViewerFadeUp 250ms ease-out forwards",
                    opacity: 0,
                  }}
                >
                  {detailLoading || !problemDetail ? (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center"
                      style={{ gap: 12 }}
                    >
                      <div className="demo-spinner" />
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                        Loading problem...
                      </p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col" style={{ overflowY: "auto" }}>
                      {/* Problem text */}
                      {problemDetail.survive_problem_text && (
                        <div
                          style={{
                            background: "rgba(0,0,0,0.2)",
                            borderRadius: 8,
                            padding: 16,
                            margin: 12,
                            fontSize: 13,
                            fontFamily: "Inter, sans-serif",
                            color: "rgba(255,255,255,0.85)",
                            lineHeight: 1.7,
                            overflowY: "auto",
                            maxHeight: 180,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {problemDetail.survive_problem_text}
                        </div>
                      )}

                      {/* Instructions */}
                      <div style={{ padding: "0 24px" }}>
                        {[
                          problemDetail.instruction_1,
                          problemDetail.instruction_2,
                          problemDetail.instruction_3,
                          problemDetail.instruction_4,
                          problemDetail.instruction_5,
                        ]
                          .map((txt, i) => ({ txt, letter: String.fromCharCode(97 + i) }))
                          .filter((x) => x.txt && x.txt.trim().length > 0)
                          .map((x) => (
                            <div
                              key={x.letter}
                              style={{
                                fontSize: 12,
                                fontFamily: "Inter, sans-serif",
                                color: "rgba(255,255,255,0.65)",
                                lineHeight: 1.6,
                                marginBottom: 4,
                              }}
                            >
                              ({x.letter}) {x.txt}
                            </div>
                          ))}
                      </div>

                      {/* See Solution button */}
                      <div style={{ padding: "12px 24px" }}>
                        <button
                          type="button"
                          onClick={() => setSolutionOpen((v) => !v)}
                          style={{
                            padding: "8px 16px",
                            background: RED,
                            color: "#fff",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "Inter, sans-serif",
                            cursor: "pointer",
                            border: "none",
                          }}
                        >
                          {solutionOpen ? "Hide Solution" : "See Solution"}
                        </button>
                      </div>

                      {/* Solution */}
                      {solutionOpen && (
                        <div style={{ padding: "0 24px 16px" }}>
                          {Array.isArray(problemDetail.survive_solution_json?.parts) &&
                          problemDetail.survive_solution_json.parts.length > 0 ? (
                            problemDetail.survive_solution_json.parts.map((part: any, i: number) => {
                              const label =
                                part?.label || part?.part_label || `(${String.fromCharCode(97 + i)})`;
                              const answer =
                                part?.answer ||
                                part?.final_answer ||
                                part?.text ||
                                (typeof part === "string" ? part : "");
                              return (
                                <div
                                  key={i}
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter, sans-serif",
                                    color: "rgba(255,255,255,0.8)",
                                    lineHeight: 1.6,
                                    marginBottom: 6,
                                  }}
                                >
                                  <strong style={{ color: "rgba(255,255,255,0.95)" }}>{label}</strong>{" "}
                                  {typeof answer === "string"
                                    ? answer
                                    : JSON.stringify(answer)}
                                </div>
                              );
                            })
                          ) : (
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: "Inter, sans-serif",
                                color: "rgba(255,255,255,0.8)",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {(problemDetail.survive_solution_text || "").slice(0, 400)}
                              {(problemDetail.survive_solution_text || "").length > 400 ? "..." : ""}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Demo badge */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "10px 12px 14px",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => onGetStartedClick?.()}
                  style={{
                    fontSize: 10,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    background: "rgba(212,175,55,0.15)",
                    color: "#D4AF37",
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🔒 Full access unlocked with Get Started →
                </button>
              </div>
            </div>
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ padding: 24 }}
            >
              <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 12 }}>📚</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                Select a chapter to begin
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


// ── ChapterView (renders inside the laptop screen when a chapter is selected) ──
interface ChapterViewProps {
  courseName: string;
  chapter: Chapter;
  tab: "survival" | "practice" | "videos";
  onTabChange: (t: "survival" | "practice" | "videos") => void;
  onBack: () => void;
  onChange: () => void;
}

type SurvivalPill = "flashcards" | "journal_entries" | "formulas";
type PracticePill = "be" | "ex" | "p";

interface ProblemRow {
  id: string;
  asset_name: string;
  source_ref: string | null;
}

function ChapterView({ courseName, chapter, tab, onTabChange, onBack, onChange }: ChapterViewProps) {
  const [survivalPill, setSurvivalPill] = useState<SurvivalPill>("flashcards");
  const [practicePill, setPracticePill] = useState<PracticePill>("be");
  const [pillSkeleton, setPillSkeleton] = useState(true);
  const [contentKey, setContentKey] = useState(0);
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null);
  const [solutionLoading, setSolutionLoading] = useState(false);

  useEffect(() => {
    setPillSkeleton(true);
    setContentKey((k) => k + 1);
    const t = setTimeout(() => setPillSkeleton(false), 400);
    return () => clearTimeout(t);
  }, [tab, survivalPill, practicePill]);

  useEffect(() => {
    if (tab !== "practice") return;
    setProblemsLoading(true);
    const prefix = practicePill === "be" ? "BE" : practicePill === "ex" ? "EX" : "P";
    (supabase as any)
      .from("teaching_assets")
      .select("id, asset_name, source_ref")
      .eq("chapter_id", chapter.id)
      .eq("status", "approved")
      .ilike("source_ref", `${prefix}%`)
      .order("source_ref")
      .then(({ data }: any) => {
        setProblems(
          (data ?? []).map((d: any) => ({ id: d.id, asset_name: d.asset_name, source_ref: d.source_ref })),
        );
        setProblemsLoading(false);
      });
  }, [tab, practicePill, chapter.id]);

  const handleViewSolution = (id: string) => {
    setActiveProblemId(id);
    setSolutionLoading(true);
    setTimeout(() => setSolutionLoading(false), 600);
  };

  const renderShimmer = (count: number, height = 64) => (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg w-full"
          style={{
            height,
            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
            backgroundSize: "200% 100%",
            animation: "demoShimmer 1.5s linear infinite",
            border: "1px solid #E5E7EB",
          }}
        />
      ))}
    </div>
  );

  // Solution viewer with paywall placeholders
  if (activeProblemId) {
    const problem = problems.find((p) => p.id === activeProblemId);
    return (
      <div className="flex flex-col h-full" style={{ fontFamily: "Inter, sans-serif" }}>
        <style>{`
          @keyframes demoShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @keyframes demoFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        `}</style>
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={() => setActiveProblemId(null)}
            className="text-[12px] font-semibold hover:opacity-70"
            style={{ color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Back to problems
          </button>
          <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
            {courseName} › Ch {chapter.chapter_number}
          </p>
        </div>
        {solutionLoading ? (
          renderShimmer(4, 80)
        ) : (
          <div style={{ animation: "demoFadeIn 300ms ease-out" }}>
            <div className="rounded-lg p-4 mb-3" style={{ background: "#fff", border: "1px solid #E5E7EB" }}>
              <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: "#9CA3AF", letterSpacing: "0.06em" }}>
                Problem {problem?.source_ref}
              </p>
              <p className="text-[13px]" style={{ color: NAVY }}>
                Survive Company A purchased equipment for $24,000 with a useful life of 6 years and a residual value of $0. Compute depreciation using the straight-line method.
              </p>
            </div>
            {["Explanation", "Journal Entries", "Final Answer"].map((label) => (
              <div
                key={label}
                className="relative rounded-lg p-4 mb-2 overflow-hidden"
                style={{ background: "#fff", border: "1px solid #E5E7EB", minHeight: 80 }}
              >
                <p className="text-[12px] font-bold mb-1" style={{ color: NAVY }}>{label}</p>
                <div style={{ filter: "blur(5px)", userSelect: "none" }}>
                  <p className="text-[12px]" style={{ color: "#6B7280" }}>
                    Step 1: Calculate annual depreciation expense.<br />
                    Cost − Residual / Useful life = $24,000 / 6 = $4,000 per year.
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.45)" }}>
                  <span
                    className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded"
                    style={{ background: NAVY, color: "#fff", letterSpacing: "0.06em" }}
                  >
                    🔒 Unlock with access
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const survivalPills: { key: SurvivalPill; label: string }[] = [
    { key: "flashcards", label: "Flashcards" },
    { key: "journal_entries", label: "Journal Entries" },
    { key: "formulas", label: "Formulas" },
  ];
  const practicePills: { key: PracticePill; label: string }[] = [
    { key: "be", label: "Brief Exercises" },
    { key: "ex", label: "Exercises" },
    { key: "p", label: "Problems" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes demoShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes demoFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
      `}</style>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-3 px-1 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] font-semibold hover:opacity-70 shrink-0"
            style={{ color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Back
          </button>
          <p className="text-[11px] truncate" style={{ color: "#9CA3AF" }}>
            {courseName} › Ch {chapter.chapter_number}: {chapter.chapter_name}
          </p>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="text-[12px] font-semibold hover:opacity-70 shrink-0"
          style={{ color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Change →
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg mb-3" style={{ background: "#EEF0F3", border: "1px solid #E5E7EB" }}>
        {[
          { key: "survival" as const, label: "Study Tools" },
          { key: "practice" as const, label: "Practice Problems" },
          { key: "videos" as const, label: "Cram Videos" },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className="flex-1 py-2 text-[13px] font-semibold rounded-md transition-all"
              style={{
                background: active ? NAVY : "transparent",
                color: active ? "#fff" : "#6B7280",
                border: "none",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Pills (only for survival + practice) */}
      {tab !== "videos" && (
        <div className="flex flex-wrap gap-2 mb-4 px-1">
          {(tab === "survival" ? survivalPills : practicePills).map((pill: any) => {
            const active = tab === "survival" ? survivalPill === pill.key : practicePill === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => {
                  if (tab === "survival") setSurvivalPill(pill.key);
                  else setPracticePill(pill.key);
                }}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={{
                  background: active ? NAVY : "transparent",
                  color: active ? "#fff" : NAVY,
                  border: `1px solid ${NAVY}`,
                  cursor: "pointer",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div key={contentKey} style={{ animation: "demoFadeIn 200ms ease-out" }}>
        {pillSkeleton || (tab === "practice" && problemsLoading) ? (
          renderShimmer(tab === "practice" ? 5 : 3, tab === "practice" ? 56 : 80)
        ) : tab === "videos" ? (
          <div className="rounded-lg p-8 text-center" style={{ background: "#fff", border: "1px solid #E5E7EB" }}>
            <div
              className="mx-auto mb-3 flex items-center justify-center rounded-full"
              style={{ width: 48, height: 48, background: "rgba(20,33,61,0.06)" }}
            >
              <Video size={22} color={NAVY} strokeWidth={1.6} />
            </div>
            <p className="text-[13px] font-bold mb-1" style={{ color: NAVY }}>
              Cram Videos
            </p>
            <p className="text-[12px]" style={{ color: "#9CA3AF" }}>
              Lee's full video library — binge what's there, request what's not.
            </p>
          </div>
        ) : tab === "survival" ? (
          <div className="rounded-lg p-8 text-center" style={{ background: "#fff", border: "1px solid #E5E7EB" }}>
            <p className="text-[13px] font-bold mb-1" style={{ color: NAVY }}>
              {survivalPills.find((p) => p.key === survivalPill)?.label}
            </p>
            <p className="text-[12px]" style={{ color: "#9CA3AF" }}>
              Content coming soon for this chapter.
            </p>
          </div>
        ) : problems.length === 0 ? (
          <p className="text-[13px] text-center py-6" style={{ color: "#9CA3AF" }}>
            No problems available for this type yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {problems.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:shadow-sm"
                style={{ background: "#fff", border: "1px solid #E5E7EB" }}
              >
                <span
                  className="text-[11px] font-bold uppercase shrink-0"
                  style={{ color: NAVY, minWidth: 48, letterSpacing: "0.04em" }}
                >
                  {p.source_ref}
                </span>
                <span className="flex-1 text-[12px] truncate" style={{ color: "#6B7280" }}>
                  Practice problem
                </span>
                <button
                  type="button"
                  onClick={() => handleViewSolution(p.id)}
                  className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md hover:opacity-80 transition-opacity"
                  style={{ background: NAVY, color: "#fff", border: "none", cursor: "pointer" }}
                >
                  View Solution →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
