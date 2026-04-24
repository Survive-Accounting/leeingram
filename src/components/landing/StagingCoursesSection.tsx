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
      className="relative px-4 sm:px-6 scroll-mt-0 overflow-hidden pt-12 md:pt-20 pb-[320px] md:pb-[120px]"
      style={{
        background: `linear-gradient(180deg, #0F1A2E 0%, ${NAVY} 50%, #0B1426 100%)`,
      }}
    >
      <style>{`
        @keyframes betaPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>

      <div className="relative mx-auto max-w-[920px]" style={{ zIndex: 2 }}>

        {/* Mobile-only dropdown (desktop dropdown lives inside the laptop screen) */}
        <div className="md:hidden relative" style={{ zIndex: 100 }}>
          <div className="text-center mb-3">
            <span
              className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif" }}
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
              onChapterClick={(ch, tag) => {
                tagIntent(tag);
                if (onChapterClick) onChapterClick(selected, ch.chapter_number, ch.chapter_name);
                else onCardClick(selected);
              }}
            />
          ) : null;

          return (
            <>
              {/* DESKTOP — MacBook frame */}
              <div ref={laptopRef} className="hidden md:block mt-6">
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
                  @keyframes demoCursorBlink {
                    0%, 45% { opacity: 1; }
                    55%, 100% { opacity: 0.05; }
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
                      className="relative w-full overflow-hidden"
                      style={{
                        aspectRatio: "16 / 10",
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

                      {/* Content fade-in (course selected) */}
                      {powerPhase === "on" && innerContent && (
                        <div
                          className="absolute inset-0 overflow-y-auto p-4"
                          style={{
                            background: "#F8F8FA",
                            animation: "mbContentFade 400ms ease-out forwards",
                          }}
                        >
                          {innerContent}
                        </div>
                      )}

                      {/* Idle / off state — eyebrow + headline + dropdown LIVE INSIDE the screen */}
                      {powerPhase === "off" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 demo-idle-content">
                          {/* Faint radial glow behind text — "screen is on" feel */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background:
                                "radial-gradient(ellipse 55% 45% at 50% 45%, rgba(147,197,253,0.10) 0%, rgba(147,197,253,0.04) 40%, transparent 75%)",
                            }}
                          />
                          <span
                            className="relative text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] mb-3"
                            style={{ color: "rgba(147,197,253,0.7)", fontFamily: "Inter, sans-serif" }}
                          >
                            Try a demo
                          </span>
                          <h2
                            className="relative text-center text-white leading-tight text-[22px] sm:text-[28px] md:text-[34px]"
                            style={{
                              fontFamily: "'DM Serif Display', serif",
                              fontWeight: 400,
                              textShadow: "0 2px 16px rgba(120,160,255,0.25)",
                            }}
                          >
                            Which course are you studying?
                            <span className="demo-cursor" aria-hidden="true">_</span>
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
    <div className="relative" style={{ zIndex: 100 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-2xl px-5 py-4 flex items-center justify-between text-left transition-all hover:shadow-md"
        style={{
          background: "#fff",
          borderLeft: `4px solid ${NAVY}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
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
          className="absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            boxShadow: "0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)",
            zIndex: 110,
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
  );
}

// ── DemoScreen (renders inside the laptop screen) ──
interface DemoScreenProps {
  courseName: string;
  chapters: Chapter[];
  loading: boolean;
  onChange: () => void;
  onChapterClick: (ch: Chapter, tag: string) => void;
}

function DemoScreen({ courseName, chapters, loading, onChange, onChapterClick }: DemoScreenProps) {
  const [tab, setTab] = useState<"survival" | "practice" | "videos">("survival");
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [contentKey, setContentKey] = useState(0);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [scalingId, setScalingId] = useState<string | null>(null);

  // Skeleton min-duration 400ms
  useEffect(() => {
    setShowSkeleton(true);
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, [tab, loading]);

  // Bump key when tab/chapter changes for fade transition
  useEffect(() => {
    setContentKey((k) => k + 1);
  }, [tab, activeChapter?.id]);

  const tagFor = (ch: Chapter) => {
    const slug = tab === "survival" ? "cram_tools" : tab === "practice" ? "practice_problems" : "cram_videos";
    return `intent_${slug}_ch${ch.chapter_number}`;
  };

  const handleChapterPick = (ch: Chapter) => {
    onChapterClick(ch, tagFor(ch)); // fire intent tag
    setScalingId(ch.id);
    setTimeout(() => {
      setActiveChapter(ch);
      setScalingId(null);
    }, 150);
  };

  // If a chapter is active, render the ChapterView
  if (activeChapter) {
    return (
      <ChapterView
        courseName={courseName}
        chapter={activeChapter}
        tab={tab}
        onTabChange={setTab}
        onBack={() => setActiveChapter(null)}
        onChange={onChange}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes demoCardIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes demoFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Course label + change link */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[12px]" style={{ color: "#6B7280" }}>
          {courseName}
        </p>
        <button
          type="button"
          onClick={onChange}
          className="text-[12px] font-semibold hover:opacity-70 transition-opacity"
          style={{ color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Change →
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-lg mb-4"
        style={{ background: "#EEF0F3", border: "1px solid #E5E7EB" }}
      >
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
              onClick={() => setTab(t.key)}
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

      {/* Choose a chapter label */}
      <p
        className="text-[11px] font-semibold uppercase mb-3 px-1"
        style={{ color: "#9CA3AF", letterSpacing: "0.08em" }}
      >
        Choose a chapter
      </p>

      {/* Grid */}
      <div key={contentKey} style={{ animation: "demoFadeIn 150ms ease-out" }}>
        {showSkeleton || loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg"
                style={{
                  height: 64,
                  background:
                    "linear-gradient(90deg, #EEF0F3 0%, #F8F9FB 50%, #EEF0F3 100%)",
                  backgroundSize: "200% 100%",
                  animation: "demoShimmer 1.4s linear infinite",
                  border: "1px solid #E5E7EB",
                }}
              />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-[13px] text-center py-6" style={{ color: "#9CA3AF" }}>
            No chapters available yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {chapters.map((ch, i) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleChapterPick(ch)}
                className="relative rounded-lg p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  opacity: 0,
                  animation: `demoCardIn 320ms ease-out forwards`,
                  animationDelay: `${i * 80}ms`,
                  transform: scalingId === ch.id ? "scale(1.05)" : undefined,
                  transition: scalingId === ch.id ? "transform 150ms ease-out" : undefined,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = NAVY;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB";
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase mb-1"
                  style={{ color: "#9CA3AF", letterSpacing: "0.06em" }}
                >
                  Ch. {ch.chapter_number}
                </p>
                <p className="text-[13px] font-bold leading-tight text-center" style={{ color: NAVY }}>
                  {ch.chapter_name}
                </p>
              </button>
            ))}
          </div>
        )}
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
