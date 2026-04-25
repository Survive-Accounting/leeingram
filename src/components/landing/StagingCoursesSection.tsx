import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#14213D";
const RED = "#CE1126";
const AMBER = "#D4AF37";

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

const SHORT_NAME: Record<string, string> = {
  "intro-accounting-1": "Intro 1",
  "intro-accounting-2": "Intro 2",
  "intermediate-accounting-1": "Intermediate 1",
  "intermediate-accounting-2": "Intermediate 2",
};

/** Section labels per course family. */
function sectionsFor(slug: string): Array<{ key: SectionKey; label: string; prefixes: string[] }> {
  const isIntro = slug.startsWith("intro-");
  if (isIntro) {
    return [
      { key: "be", label: "Quick Studies", prefixes: ["QS", "BE"] },
      { key: "ex", label: "Exercises", prefixes: ["E"] },
      { key: "pr", label: "Problems", prefixes: ["P"] },
    ];
  }
  return [
    { key: "be", label: "Brief Exercises", prefixes: ["BE"] },
    { key: "ex", label: "Exercises", prefixes: ["E"] },
    { key: "pr", label: "Problems", prefixes: ["P"] },
  ];
}

type SectionKey = "be" | "ex" | "pr";

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface ProblemItem {
  id: string;
  source_ref: string;
  problem_title: string | null;
  asset_name?: string | null;
}

interface ProblemDetail {
  survive_problem_text: string | null;
  problem_title: string | null;
  asset_name: string | null;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  instruction_4: string | null;
  instruction_5: string | null;
  survive_solution_text: string | null;
}

export default function StagingCoursesSection({
  courses,
  onCardClick,
  onChapterClick,
  onGetStartedClick,
}: StagingCoursesSectionProps) {
  const ordered = useMemo(
    () =>
      DISPLAY_ORDER.map((slug) => courses.find((c) => c.slug === slug)).filter(
        Boolean,
      ) as Course[],
    [courses],
  );

  const [selectedSlug, setSelectedSlug] = useState<string>(
    ordered[0]?.slug ?? "",
  );
  const selected = ordered.find((c) => c.slug === selectedSlug) ?? ordered[0];

  // Chapters for selected course
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  // Drilldown state
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [items, setItems] = useState<ProblemItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ProblemItem | null>(null);
  const [detail, setDetail] = useState<ProblemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reset on course change
  useEffect(() => {
    setExpandedChapterId(null);
    setActiveSection(null);
    setItems([]);
    setSelectedProblem(null);
    setDetail(null);
  }, [selectedSlug]);

  // Load chapters when course changes
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setChaptersLoading(true);
    (async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", selected.id)
        .order("chapter_number", { ascending: true });
      if (cancelled) return;
      setChapters((data ?? []) as Chapter[]);
      setChaptersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  // Pending auto-selection (set by "Start Exploring" CTA)
  const [pendingAutoSelect, setPendingAutoSelect] = useState(false);

  // Load items when chapter+section change
  useEffect(() => {
    if (!expandedChapterId || !activeSection || !selected) {
      setItems([]);
      return;
    }
    const sec = sectionsFor(selected.slug).find((s) => s.key === activeSection);
    if (!sec) return;
    let cancelled = false;
    setItemsLoading(true);
    (async () => {
      const orFilter = sec.prefixes
        .map((p) => `source_ref.ilike.${p}%`)
        .join(",");
      const { data } = await (supabase as any)
        .from("teaching_assets")
        .select("id, source_ref, problem_title, asset_name")
        .eq("chapter_id", expandedChapterId)
        
        .or(orFilter)
        .order("source_ref", { ascending: true })
        .limit(60);
      if (cancelled) return;
      const seen = new Set<string>();
      const deduped = ((data ?? []) as ProblemItem[]).filter((p) => {
        if (seen.has(p.source_ref)) return false;
        seen.add(p.source_ref);
        return true;
      });
      deduped.sort((a, b) => {
        const na = parseFloat((a.source_ref || "").replace(/[^\d.]/g, "")) || 0;
        const nb = parseFloat((b.source_ref || "").replace(/[^\d.]/g, "")) || 0;
        return na - nb;
      });
      setItems(deduped);
      setItemsLoading(false);
      // Auto-select first problem if requested by CTA
      if (pendingAutoSelect && deduped.length > 0) {
        setSelectedProblem(deduped[0]);
        setPendingAutoSelect(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expandedChapterId, activeSection, selected?.slug, pendingAutoSelect]);

  // When chapters load, if auto-select pending and nothing expanded yet, expand Ch1 + first section
  useEffect(() => {
    if (!pendingAutoSelect || !selected || chapters.length === 0) return;
    if (expandedChapterId && activeSection) return;
    const ch1 = chapters[0];
    if (!ch1) return;
    setExpandedChapterId(ch1.id);
    const firstSection = sectionsFor(selected.slug)[0]?.key ?? null;
    setActiveSection(firstSection);
  }, [pendingAutoSelect, chapters, selected?.slug, expandedChapterId, activeSection]);

  // Load problem detail
  useEffect(() => {
    if (!selectedProblem) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    const minDelay = new Promise((r) => setTimeout(r, 350));
    (async () => {
      const [{ data }] = await Promise.all([
        (supabase as any)
          .from("teaching_assets")
          .select(
            "survive_problem_text, problem_title, asset_name, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, survive_solution_text",
          )
          .eq("id", selectedProblem.id)
          .maybeSingle(),
        minDelay,
      ]);
      if (cancelled) return;
      setDetail((data ?? null) as ProblemDetail | null);
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProblem?.id]);

  const handleSelectChapter = (ch: Chapter) => {
    if (expandedChapterId === ch.id) {
      // collapse
      setExpandedChapterId(null);
      setActiveSection(null);
      setItems([]);
      setSelectedProblem(null);
      setDetail(null);
      return;
    }
    setExpandedChapterId(ch.id);
    setActiveSection(null);
    setItems([]);
    setSelectedProblem(null);
    setDetail(null);
    if (selected && onChapterClick) {
      onChapterClick(selected, ch.chapter_number, ch.chapter_name);
    }
  };

  const handleSelectSection = (key: SectionKey) => {
    setActiveSection(key);
    setSelectedProblem(null);
    setDetail(null);
  };

  const handleSelectProblem = (item: ProblemItem) => {
    setSelectedProblem(item);
  };

  const handleGetStarted = () => {
    if (onGetStartedClick) onGetStartedClick(selected?.slug ?? null);
    else if (selected) onCardClick(selected);
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
        .demo-card-scroll::-webkit-scrollbar { width: 6px; }
        .demo-card-scroll::-webkit-scrollbar-track { background: transparent; }
        .demo-card-scroll::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        .demo-card-scroll::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

        @keyframes demoFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoSpin { to { transform: rotate(360deg); } }
        .demo-spin {
          width: 36px; height: 36px;
          border: 3px solid rgba(206,17,38,0.18);
          border-top-color: ${RED};
          border-radius: 50%;
          animation: demoSpin 800ms linear infinite;
        }
        .demo-fade-up { animation: demoFadeUp 280ms ease-out forwards; }

        .explore-cta { transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease; }
        .explore-cta:hover {
          transform: scale(1.03);
          box-shadow: 0 10px 22px -6px rgba(20,33,61,0.35);
          filter: brightness(1.05);
        }
        .explore-cta:active { transform: scale(0.99); }
        .explore-cta-arrow { display: inline-block; transition: transform 200ms ease; }
        .explore-cta:hover .explore-cta-arrow { transform: translateX(3px); }
        @media (prefers-reduced-motion: reduce) {
          .explore-cta, .explore-cta-arrow { transition: none !important; }
          .explore-cta:hover { transform: none; }
        }
      `}</style>

      {/* Section heading + CTA */}
      <div className="mx-auto text-center mb-10" style={{ maxWidth: 640 }}>
        <h2
          className="text-[28px] sm:text-[36px] leading-tight"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: NAVY }}
        >
          Built for how students actually study
        </h2>
        <p
          className="mt-3 sm:mt-4 text-[15px] sm:text-[16px]"
          style={{ fontFamily: "Inter, sans-serif", color: "#6B7280", lineHeight: 1.55 }}
        >
          Pick a problem. Get a quick explanation when you're stuck. Try it below!
        </p>

      </div>

      {/* Course tabs */}
      <div id="explore-demo" className="mx-auto max-w-[1100px] mb-6 scroll-mt-20">
        <div className="flex flex-wrap justify-center gap-2">
          {ordered.map((c) => {
            const isActive = c.slug === selectedSlug;
            return (
              <button
                key={c.slug}
                onClick={() => setSelectedSlug(c.slug)}
                className="rounded-full px-4 py-2 text-[13px] font-semibold transition-all inline-flex items-center gap-1.5"
                style={{
                  fontFamily: "Inter, sans-serif",
                  background: isActive ? NAVY : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#374151",
                  border: `1px solid ${isActive ? NAVY : "#E5E7EB"}`,
                  boxShadow: isActive
                    ? "0 2px 8px rgba(20,33,61,0.18)"
                    : "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {isActive && <span aria-hidden>📚</span>}
                {SHORT_NAME[c.slug] ?? c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout: card + laptop */}
      <div className="mx-auto max-w-[1100px] grid gap-6 md:grid-cols-[360px_1fr] items-start">
        {/* LEFT: Floating navigation card */}
        <NavigationCard
          courseName={selected?.name ?? ""}
          chapters={chapters}
          chaptersLoading={chaptersLoading}
          expandedChapterId={expandedChapterId}
          activeSection={activeSection}
          items={items}
          itemsLoading={itemsLoading}
          selectedProblemId={selectedProblem?.id ?? null}
          sections={selected ? sectionsFor(selected.slug) : []}
          onSelectChapter={handleSelectChapter}
          onSelectSection={handleSelectSection}
          onSelectProblem={handleSelectProblem}
        />

        {/* RIGHT: Laptop with viewer */}
        <LaptopViewer
          problem={selectedProblem}
          detail={detail}
          loading={detailLoading}
          onGetStarted={handleGetStarted}
        />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/* LEFT — Floating navigation card                            */
/* ────────────────────────────────────────────────────────── */

interface NavigationCardProps {
  courseName: string;
  chapters: Chapter[];
  chaptersLoading: boolean;
  expandedChapterId: string | null;
  activeSection: SectionKey | null;
  items: ProblemItem[];
  itemsLoading: boolean;
  selectedProblemId: string | null;
  sections: Array<{ key: SectionKey; label: string; prefixes: string[] }>;
  onSelectChapter: (ch: Chapter) => void;
  onSelectSection: (key: SectionKey) => void;
  onSelectProblem: (item: ProblemItem) => void;
}

function NavigationCard({
  courseName,
  chapters,
  chaptersLoading,
  expandedChapterId,
  activeSection,
  items,
  itemsLoading,
  selectedProblemId,
  sections,
  onSelectChapter,
  onSelectSection,
  onSelectProblem,
}: NavigationCardProps) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: "0 8px 24px rgba(20,33,61,0.08), 0 1px 3px rgba(20,33,61,0.04)",
      }}
    >
      {/* Card header */}
      <div
        className="px-4 py-3"
        style={{
          background: "linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
        >
          Course
        </div>
        <div
          className="text-[15px] font-semibold mt-0.5"
          style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
        >
          {courseName || "—"}
        </div>
      </div>

      {/* Chapter list */}
      <div
        className="demo-card-scroll"
        style={{ maxHeight: 520, overflowY: "auto", padding: "8px 0" }}
      >
        {chaptersLoading ? (
          <div className="p-6 text-center">
            <div className="demo-spin mx-auto" />
          </div>
        ) : chapters.length === 0 ? (
          <div
            className="px-4 py-6 text-center text-[13px]"
            style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
          >
            No chapters yet for this course.
          </div>
        ) : (
          chapters.map((ch) => {
            const isExpanded = expandedChapterId === ch.id;
            return (
              <div key={ch.id}>
                <button
                  onClick={() => onSelectChapter(ch)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors"
                  style={{
                    background: isExpanded ? "#FEF2F2" : "transparent",
                    borderLeft: `3px solid ${isExpanded ? RED : "transparent"}`,
                    fontFamily: "Inter, sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded)
                      e.currentTarget.style.background = "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      color: isExpanded ? RED : "#6B7280",
                      transition: "transform 200ms ease",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      display: "inline-flex",
                    }}
                  >
                    <ChevronRight size={14} />
                  </span>
                  <span
                    className="text-[13px]"
                    style={{
                      color: isExpanded ? NAVY : "#374151",
                      fontWeight: isExpanded ? 600 : 500,
                      lineHeight: 1.4,
                    }}
                  >
                    Ch. {ch.chapter_number} — {ch.chapter_name}
                  </span>
                </button>

                {/* Expanded: section pills + items */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 demo-fade-up">
                    {/* Section pills */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {sections.map((s) => {
                        const isActive = activeSection === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => onSelectSection(s.key)}
                            className="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all"
                            style={{
                              fontFamily: "Inter, sans-serif",
                              background: isActive ? NAVY : "#F3F4F6",
                              color: isActive ? "#FFFFFF" : "#4B5563",
                              border: `1px solid ${isActive ? NAVY : "#E5E7EB"}`,
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Items */}
                    {activeSection && (
                      <div
                        className="rounded-md"
                        style={{ background: "#F9FAFB", padding: "4px" }}
                      >
                        {itemsLoading ? (
                          <div className="py-4 text-center">
                            <div className="demo-spin mx-auto" style={{ width: 22, height: 22, borderWidth: 2 }} />
                          </div>
                        ) : items.length === 0 ? (
                          <div
                            className="py-3 text-center text-[12px]"
                            style={{ color: "#9CA3AF" }}
                          >
                            No problems in this section yet.
                          </div>
                        ) : (
                          <div style={{ maxHeight: 220, overflowY: "auto" }} className="demo-card-scroll">
                            {items.map((item) => {
                              const isSel = selectedProblemId === item.id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => onSelectProblem(item)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                                  style={{
                                    background: isSel ? "#FEE2E2" : "transparent",
                                    fontFamily: "Inter, sans-serif",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSel)
                                      e.currentTarget.style.background =
                                        "#FFFFFF";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSel)
                                      e.currentTarget.style.background =
                                        "transparent";
                                  }}
                                >
                                  <span
                                    className="text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0"
                                    style={{
                                      background: isSel ? RED : "#E5E7EB",
                                      color: isSel ? "#FFFFFF" : "#4B5563",
                                      fontFamily: "Inter, sans-serif",
                                      letterSpacing: "0.02em",
                                    }}
                                  >
                                    {item.source_ref}
                                  </span>
                                  <span
                                    className="text-[12px] truncate"
                                    style={{
                                      color: isSel ? NAVY : "#4B5563",
                                      fontWeight: isSel ? 600 : 400,
                                    }}
                                    title={item.problem_title ?? ""}
                                  >
                                    {item.problem_title || "Untitled"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* RIGHT — Laptop viewer                                      */
/* ────────────────────────────────────────────────────────── */

interface LaptopViewerProps {
  problem: ProblemItem | null;
  detail: ProblemDetail | null;
  loading: boolean;
  onGetStarted: () => void;
}

function LaptopViewer({ problem, detail, loading, onGetStarted }: LaptopViewerProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
      {/* Lid */}
      <div
        className="relative mx-auto"
        style={{
          background: "linear-gradient(180deg, #d8dadd 0%, #c2c4c8 100%)",
          borderRadius: "16px 16px 6px 6px",
          padding: "12px 12px 16px 12px",
          boxShadow:
            "0 24px 50px -18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
          border: "1px solid #a8aaae",
        }}
      >
        {/* Bezel */}
        <div
          style={{
            background: "#0a0a0a",
            borderRadius: 6,
            padding: 10,
            border: "1px solid #1a1a1a",
          }}
        >
          {/* Camera dot */}
          <div className="flex justify-center mb-1.5">
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#222",
              }}
            />
          </div>
          {/* Screen */}
          <div
            className="relative w-full"
            style={{
              aspectRatio: "16 / 10",
              minHeight: 380,
              overflow: "hidden",
              background: "#FFFFFF",
              borderRadius: 3,
            }}
          >
            <ViewerContent
              problem={problem}
              detail={detail}
              loading={loading}
              onGetStarted={onGetStarted}
            />
          </div>
        </div>
      </div>
      {/* Hinge */}
      <div
        className="mx-auto"
        style={{
          width: "100%",
          height: 12,
          background: "linear-gradient(180deg, #b8babe 0%, #8e9094 100%)",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}

function ViewerContent({
  problem,
  detail,
  loading,
  onGetStarted,
}: LaptopViewerProps) {
  if (!problem) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
        <div className="text-[40px] mb-3" aria-hidden="true">📚</div>
        <div
          className="text-[16px] font-semibold mb-1.5"
          style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
        >
          Pick a problem to preview
        </div>
        <div
          className="text-[13px]"
          style={{ color: "#6B7280", fontFamily: "Inter, sans-serif", maxWidth: 320 }}
        >
          Use the menu on the left: choose a chapter, then a section, then any problem.
        </div>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="demo-spin" />
        <div
          className="mt-3 text-[12px]"
          style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
        >
          Loading problem...
        </div>
      </div>
    );
  }

  const instructions = [
    detail.instruction_1,
    detail.instruction_2,
    detail.instruction_3,
    detail.instruction_4,
    detail.instruction_5,
  ].filter((x): x is string => !!x && x.trim().length > 0);

  const solutionPreview = (detail.survive_solution_text ?? "")
    .split("\n")
    .slice(0, 2)
    .join("\n");

  const fullSolutionUrl = detail.asset_name
    ? `/solutions/${detail.asset_name}`
    : null;

  return (
    <div
      className="absolute inset-0 flex flex-col demo-fade-up"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{
          background: "#F9FAFB",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0"
            style={{ background: RED, color: "#FFFFFF" }}
          >
            {problem.source_ref}
          </span>
          <span
            className="text-[12px] font-semibold truncate"
            style={{ color: NAVY }}
          >
            {detail.problem_title || problem.problem_title || "Problem"}
          </span>
        </div>
        {fullSolutionUrl && (
          <a
            href={fullSolutionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold rounded-md px-2.5 py-1 transition-colors flex-shrink-0"
            style={{
              color: NAVY,
              background: "#FFFFFF",
              border: "1px solid #D1D5DB",
            }}
          >
            Open full solution
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 demo-card-scroll"
        style={{ background: "#FFFFFF" }}
      >
        {/* Problem text */}
        {detail.survive_problem_text && (
          <div
            className="text-[13px] whitespace-pre-line"
            style={{ color: "#1F2937", lineHeight: 1.65 }}
          >
            {detail.survive_problem_text}
          </div>
        )}

        {/* Instructions */}
        {instructions.length > 0 && (
          <div className="mt-4">
            <div
              className="text-[11px] font-bold uppercase mb-2"
              style={{ color: "#6B7280", letterSpacing: "0.06em" }}
            >
              Required
            </div>
            <ol className="space-y-1.5">
              {instructions.map((ins, i) => (
                <li
                  key={i}
                  className="text-[13px] flex gap-2"
                  style={{ color: "#374151", lineHeight: 1.55 }}
                >
                  <span style={{ color: NAVY, fontWeight: 600 }}>
                    ({String.fromCharCode(97 + i)})
                  </span>
                  <span>{ins}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Solution teaser */}
        <div className="mt-5">
          <div
            className="text-[11px] font-bold uppercase mb-2"
            style={{ color: "#6B7280", letterSpacing: "0.06em" }}
          >
            Solution
          </div>
          <div
            className="relative rounded-lg p-3"
            style={{
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              minHeight: 96,
            }}
          >
            {solutionPreview ? (
              <div
                className="text-[12.5px] whitespace-pre-line"
                style={{ color: "#374151", lineHeight: 1.6 }}
              >
                {solutionPreview}
              </div>
            ) : (
              <div className="text-[12.5px]" style={{ color: "#9CA3AF" }}>
                Step-by-step explanation, journal entries, and exam tips.
              </div>
            )}
            {/* Lock fade */}
            <div
              className="absolute left-0 right-0 bottom-0 flex items-end justify-center pb-2"
              style={{
                top: "40%",
                background:
                  "linear-gradient(to bottom, rgba(249,250,251,0) 0%, rgba(249,250,251,0.95) 70%)",
                borderRadius: "0 0 8px 8px",
                pointerEvents: "none",
              }}
            >
              <button
                onClick={onGetStarted}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all hover:brightness-95"
                style={{
                  background: "rgba(212,175,55,0.15)",
                  color: AMBER,
                  border: "1px solid rgba(212,175,55,0.3)",
                  pointerEvents: "auto",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <Lock size={11} />
                Unlock full solution
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
