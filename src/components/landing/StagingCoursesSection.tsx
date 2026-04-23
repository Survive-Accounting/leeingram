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

  const countdownText = useMemo(() => getFinalsCountdownText(), []);

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

        <div className="relative">
          <p
            className="relative text-center mb-2 text-[26px] sm:text-[32px] md:text-[38px] leading-tight text-white"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
              textShadow: "2px 2px 12px rgba(0,0,0,0.5)",
              zIndex: 1,
            }}
          >
            Which course are you studying?
          </p>
          <p
            className="text-center mb-4 text-[13px] sm:text-[14px]"
            style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter, sans-serif" }}
          >
            Select your course to start the demo →
          </p>
        </div>

        {/* Dropdown */}
        <div className="relative" style={{ zIndex: 100 }}>
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
              className="absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden"
              style={{
                background: "#fff",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
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

        {/* Below-dropdown stack: countdown + urgency CTA */}
        <div style={{ marginTop: 20, marginBottom: 20 }} className="flex flex-col items-center gap-1.5">
          {countdownText && (
            <p
              className="text-center"
              style={{
                color: "#475569",
                fontSize: 13,
                fontFamily: "Inter, sans-serif",
                fontWeight: 400,
              }}
            >
              {countdownText}
            </p>
          )}
          <button
            type="button"
            onClick={() => onGetStartedClick?.(selected?.slug ?? null)}
            className="text-center hover:opacity-80 transition-opacity"
            style={{
              color: NAVY,
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Start studying now →
          </button>
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
                    {/* Screen — 16:10 */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{
                        aspectRatio: "16 / 10",
                        background: powerPhase === "off" || powerPhase === "warm" ? "#000" : "#fff",
                        borderRadius: 3,
                        transition: powerPhase === "warm" ? "background 200ms linear" : undefined,
                      }}
                    >
                      {/* Faint scanlines on off state */}
                      {(powerPhase === "off" || powerPhase === "warm") && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)",
                            animation: "mbScanlines 6s linear infinite",
                          }}
                        />
                      )}
                      {/* Warm dark-gray flash */}
                      {powerPhase === "warm" && (
                        <div className="absolute inset-0" style={{ background: "#1a1a1a", opacity: 0.6 }} />
                      )}
                      {/* CRT expand white bar */}
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
                      {/* White flash */}
                      {powerPhase === "flash" && (
                        <div className="absolute inset-0 bg-white" />
                      )}
                      {/* Content fade-in */}
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
                      {/* Off / placeholder text */}
                      {powerPhase === "off" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p
                            className="text-[12px] tracking-wider uppercase"
                            style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Inter, sans-serif" }}
                          >
                            Select a course to begin
                          </p>
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

// ── DemoScreen (renders inside the laptop screen) ──
interface DemoScreenProps {
  courseName: string;
  chapters: Chapter[];
  loading: boolean;
  onChange: () => void;
  onChapterClick: (ch: Chapter, tag: string) => void;
}

function DemoScreen({ courseName, chapters, loading, onChange, onChapterClick }: DemoScreenProps) {
  const [tab, setTab] = useState<"survival" | "practice">("survival");
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [contentKey, setContentKey] = useState(0);

  // Skeleton min-duration 400ms
  useEffect(() => {
    setShowSkeleton(true);
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, [tab, loading]);

  // Bump key when tab changes for fade transition
  useEffect(() => {
    setContentKey((k) => k + 1);
  }, [tab]);

  const tagFor = (ch: Chapter) =>
    `intent_${tab === "survival" ? "cram_tools" : "practice_problems"}_ch${ch.chapter_number}`;

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
          { key: "survival" as const, label: "Survival Tools" },
          { key: "practice" as const, label: "Practice Problems" },
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
                onClick={() => onChapterClick(ch, tagFor(ch))}
                className="relative rounded-lg p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: "#fff",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  opacity: 0,
                  animation: `demoCardIn 320ms ease-out forwards`,
                  animationDelay: `${i * 80}ms`,
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
