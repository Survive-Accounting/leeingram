import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
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
  onChapterClick?: (course: Course, chapterNumber: number, chapterName?: string) => void;
  onExpansionClick?: () => void;
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

/** Pick first section prefix group by course family. */
function firstSectionPrefixes(slug: string): string[] {
  const isIntro = slug.startsWith("intro-");
  return isIntro ? ["QS", "BE"] : ["BE"];
}

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface ProblemDetail {
  id: string;
  source_ref: string;
  problem_title: string | null;
  asset_name: string | null;
  survive_problem_text: string | null;
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
  onGetStartedClick,
}: StagingCoursesSectionProps) {
  const ordered = useMemo(
    () =>
      DISPLAY_ORDER.map((slug) => courses.find((c) => c.slug === slug)).filter(
        Boolean,
      ) as Course[],
    [courses],
  );

  const [selectedSlug, setSelectedSlug] = useState<string>(ordered[0]?.slug ?? "");
  const selected = ordered.find((c) => c.slug === selectedSlug) ?? ordered[0];

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Load chapters when course changes
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", selected.id)
        .order("chapter_number", { ascending: true });
      if (cancelled) return;
      const chs = (data ?? []) as Chapter[];
      setChapters(chs);
      setSelectedChapterId(chs[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  // Load first problem of selected chapter
  useEffect(() => {
    if (!selectedChapterId || !selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRevealed(false);
    setDetail(null);
    const minDelay = new Promise((r) => setTimeout(r, 250));
    (async () => {
      const prefixes = firstSectionPrefixes(selected.slug);
      const orFilter = prefixes.map((p) => `source_ref.ilike.${p}%`).join(",");
      const [{ data }] = await Promise.all([
        (supabase as any)
          .from("teaching_assets")
          .select(
            "id, source_ref, problem_title, asset_name, survive_problem_text, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, survive_solution_text",
          )
          .eq("chapter_id", selectedChapterId)
          .or(orFilter)
          .order("source_ref", { ascending: true })
          .limit(1),
        minDelay,
      ]);
      if (cancelled) return;
      const first = (data ?? [])[0] ?? null;
      setDetail(first as ProblemDetail | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChapterId, selected?.slug]);

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
        .demo-card-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
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
        .demo-fade-up { animation: demoFadeUp 320ms ease-out forwards; }

        .demo-cta {
          background: linear-gradient(135deg, #CE1126 0%, #A30D1F 100%);
          box-shadow: 0 8px 20px -6px rgba(206,17,38,0.45);
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
        }
        .demo-cta:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow: 0 12px 26px -6px rgba(206,17,38,0.55);
        }
        .demo-cta:active { transform: translateY(0); }

        .demo-chip {
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
        }

        @media (prefers-reduced-motion: reduce) {
          .demo-fade-up { animation: none; }
          .demo-cta { transition: none; }
          .demo-cta:hover { transform: none; }
        }
      `}</style>

      {/* Section heading */}
      <div className="mx-auto text-center mb-8" style={{ maxWidth: 640 }}>
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
          Pick a chapter. Work a problem. Get a quick explanation when you’re stuck.
        </p>
      </div>

      {/* Course tabs (above laptop) */}
      <div id="explore-demo" className="mx-auto max-w-[1100px] mb-3 scroll-mt-20">
        <div className="flex flex-wrap justify-center gap-2">
          {ordered.map((c) => {
            const isActive = c.slug === selectedSlug;
            return (
              <button
                key={c.slug}
                onClick={() => setSelectedSlug(c.slug)}
                className="demo-chip rounded-full px-4 py-2 text-[13px] font-semibold inline-flex items-center gap-1.5"
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
                {SHORT_NAME[c.slug] ?? c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapter chips (above laptop) */}
      <div className="mx-auto max-w-[1100px] mb-6">
        <div
          className="demo-card-scroll flex gap-1.5 justify-center flex-wrap"
          style={{ rowGap: 8 }}
        >
          {chapters.length === 0 ? (
            <div style={{ height: 28 }} />
          ) : (
            chapters.map((ch) => {
              const isActive = ch.id === selectedChapterId;
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChapterId(ch.id)}
                  className="demo-chip rounded-md px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    background: isActive ? NAVY : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#6B7280",
                    border: `1px solid ${isActive ? NAVY : "#E5E7EB"}`,
                  }}
                  title={ch.chapter_name}
                >
                  Ch. {ch.chapter_number}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Laptop */}
      <LaptopViewer
        detail={detail}
        loading={loading}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onGetStarted={handleGetStarted}
      />
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Laptop viewer                                              */
/* ────────────────────────────────────────────────────────── */

interface LaptopViewerProps {
  detail: ProblemDetail | null;
  loading: boolean;
  revealed: boolean;
  onReveal: () => void;
  onGetStarted: () => void;
}

function LaptopViewer({ detail, loading, revealed, onReveal, onGetStarted }: LaptopViewerProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1100 }}>
      {/* Lid */}
      <div
        className="relative mx-auto"
        style={{
          background: "linear-gradient(180deg, #d8dadd 0%, #c2c4c8 100%)",
          borderRadius: "18px 18px 6px 6px",
          padding: "14px 14px 18px 14px",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.6)",
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
              minHeight: 460,
              overflow: "hidden",
              background: "#FFFFFF",
              borderRadius: 3,
            }}
          >
            <ScreenContent
              detail={detail}
              loading={loading}
              revealed={revealed}
              onReveal={onReveal}
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
          height: 14,
          background: "linear-gradient(180deg, #b8babe 0%, #8e9094 100%)",
          borderRadius: "0 0 14px 14px",
          boxShadow: "0 6px 12px rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );
}

function ScreenContent({
  detail,
  loading,
  revealed,
  onReveal,
  onGetStarted,
}: LaptopViewerProps) {
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

  const fullSolutionUrl = detail.asset_name ? `/solutions/${detail.asset_name}` : null;

  const explanationPreview = (detail.survive_solution_text ?? "")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(0, 8)
    .join("\n");

  return (
    <div
      key={detail.id}
      className="absolute inset-0 flex flex-col demo-fade-up"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
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
            {detail.source_ref}
          </span>
          <span
            className="text-[12px] font-semibold truncate"
            style={{ color: NAVY }}
          >
            Practice based on {detail.source_ref}
          </span>
        </div>
        {fullSolutionUrl && (
          <a
            href={fullSolutionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-[11px] font-semibold rounded-md px-2.5 py-1 flex-shrink-0"
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

      {/* Two-pane body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
        {/* LEFT: Problem */}
        <div
          className="demo-card-scroll overflow-y-auto px-6 py-5"
          style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB" }}
        >
          {detail.survive_problem_text && (
            <div
              className="text-[13.5px] whitespace-pre-line"
              style={{ color: "#1F2937", lineHeight: 1.7 }}
            >
              {detail.survive_problem_text}
            </div>
          )}

          {instructions.length > 0 && (
            <div className="mt-5">
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
                    style={{ color: "#374151", lineHeight: 1.6 }}
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
        </div>

        {/* RIGHT: Explanation panel */}
        <div
          className="demo-card-scroll overflow-y-auto px-6 py-5 flex flex-col"
          style={{
            background:
              "linear-gradient(160deg, #F8FAFF 0%, #EEF2FB 100%)",
          }}
        >
          {!revealed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: "#6B7280" }}
              >
                Stuck?
              </div>
              <div
                className="text-[20px] font-semibold mb-1"
                style={{
                  color: NAVY,
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                }}
              >
                Get a guided walkthrough
              </div>
              <p
                className="text-[12.5px] mb-5"
                style={{ color: "#6B7280", maxWidth: 280, lineHeight: 1.55 }}
              >
                Lee shows you exactly how to think through this problem — step by step.
              </p>
              <button
                onClick={onReveal}
                className="demo-cta inline-flex items-center gap-2 rounded-[10px] text-white"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px 22px",
                }}
              >
                Show me how to think through this
                <span aria-hidden>→</span>
              </button>
            </div>
          ) : (
            <div className="demo-fade-up">
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: RED }}
              >
                Lee's walkthrough
              </div>
              <div
                className="text-[13px] whitespace-pre-line"
                style={{ color: "#1F2937", lineHeight: 1.7 }}
              >
                {explanationPreview ||
                  "Start by identifying what's being asked. Then pull out the key numbers and decide which accounts move."}
              </div>

              <div className="mt-5 flex items-center gap-3">
                {fullSolutionUrl && (
                  <a
                    href={fullSolutionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold"
                    style={{ color: NAVY }}
                  >
                    Open full solution
                    <ExternalLink size={11} />
                  </a>
                )}
                <button
                  onClick={onGetStarted}
                  className="ml-auto text-[12px] font-semibold underline-offset-2 hover:underline"
                  style={{ color: RED, fontFamily: "Inter, sans-serif" }}
                >
                  Unlock all problems →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
