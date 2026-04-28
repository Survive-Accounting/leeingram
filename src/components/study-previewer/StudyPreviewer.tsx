import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolKey } from "@/components/dashboard/StudyToolCards";
import RetroTerminalFrame, {
  type TerminalTool,
} from "@/components/study-previewer/RetroTerminalFrame";

const NAVY = "#14213D";
const RED = "#CE1126";
const LOGO_FONT = "'DM Serif Display', serif";

const TERMINAL_TOOLS: TerminalTool[] = [
  { key: "practice", label: "Practice Problem Helper" },
  { key: "je", label: "Journal Entry Helper", hint: "(coming soon)" },
  { key: "feedback", label: "Suggest a tool we should build" },
];

export interface PreviewChapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

export interface PreviewCourse {
  id: string;
  shortName: string;
  fullName: string;
}

interface StudyPreviewerProps {
  /** Chapter list for the currently active course. */
  chapters: PreviewChapter[];

  /** Optional course list. When provided, renders a real course selector. */
  courses?: PreviewCourse[];
  /** Currently selected course id. Required when `courses` is provided. */
  selectedCourseId?: string | null;
  /** Course change handler (landing only). */
  onCourseChange?: (courseId: string) => void;

  /** Read-only display when no `courses` array is passed (dashboard case). */
  fixedCourseLabel?: string | null;

  onOpenFeedback: () => void;
  onRequestUnlock?: (action: "open_workspace") => boolean;
  persistChapterKey?: string | null;
  resetSignal?: number;
}

export default function StudyPreviewer({
  chapters,
  courses,
  selectedCourseId,
  onCourseChange,
  fixedCourseLabel,
  onOpenFeedback,
  onRequestUnlock,
  persistChapterKey,
  resetSignal,
}: StudyPreviewerProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [viewerAssetCode, setViewerAssetCode] = useState<string | null>(null);

  const chapterDropdownRef = useRef<HTMLSelectElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const courseChosen = courses
    ? !!selectedCourseId
    : !!fixedCourseLabel;
  const chapterChosen = !!selectedChapterId && !chapterLoading;

  // Restore from localStorage
  useEffect(() => {
    if (!persistChapterKey) return;
    try {
      const stored = localStorage.getItem(persistChapterKey);
      if (stored && chapters.some((c) => c.id === stored)) {
        setSelectedChapterId(stored);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistChapterKey, chapters.length]);

  useEffect(() => {
    if (resetSignal === undefined) return;
    setSelectedChapterId(null);
    setActiveTool(null);
    setViewerAssetCode(null);
  }, [resetSignal]);

  const handleChapterChange = async (chId: string) => {
    if (!chId) {
      setSelectedChapterId(null);
      setViewerAssetCode(null);
      setActiveTool(null);
      if (persistChapterKey) {
        try { localStorage.removeItem(persistChapterKey); } catch { /* ignore */ }
      }
      return;
    }
    setChapterLoading(true);
    setViewerAssetCode(null);

    const ch = chapters.find((c) => c.id === chId);

    const { data } = await supabase
      .from("teaching_assets")
      .select("asset_name, source_number")
      .eq("chapter_id", chId)
      .order("source_number", { ascending: true, nullsFirst: false })
      .order("asset_name", { ascending: true })
      .limit(1);
    const first = data?.[0]?.asset_name ?? null;

    await new Promise((r) => setTimeout(r, 400));

    setSelectedChapterId(chId);
    setViewerAssetCode(first);
    setChapterLoading(false);
    if (persistChapterKey) {
      try { localStorage.setItem(persistChapterKey, chId); } catch { /* ignore */ }
    }

    if (ch) toast.success(`Ch. ${ch.chapter_number} study tools are loaded!`);
  };

  const handleSelectTool = (key: ToolKey) => {
    if (key === "practice" && onRequestUnlock && !onRequestUnlock("open_workspace")) {
      return;
    }
    setActiveTool(key);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleNudgeChapter = () => {
    toast("Pick a chapter first 👇");
    chapterDropdownRef.current?.focus();
    chapterDropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );

  const selectedCourseLabel = useMemo(
    () => courses?.find((c) => c.id === selectedCourseId)?.fullName ?? null,
    [courses, selectedCourseId],
  );

  const stepLabel = (n: number, label: string, complete: boolean) => (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-full text-[10.5px] font-bold transition-colors"
        style={{
          width: 20,
          height: 20,
          background: complete ? NAVY : "#E2E8F0",
          color: complete ? "#fff" : "#64748B",
        }}
      >
        {complete ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
      </span>
      <span
        className="text-[11px] uppercase tracking-[0.14em] font-semibold"
        style={{ color: complete ? NAVY : "#94A3B8" }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes sa-rise-in {
          0% { opacity: 0; transform: translateY(14px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sa-rise { animation: sa-rise-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        /* Crossfade stage: retro terminal ↔ modern viewer share the same frame */
        .sa-stage { position: relative; }
        .sa-stage-layer {
          transition:
            opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
            filter 520ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, filter, transform;
        }
        .sa-stage-overlay {
          position: absolute;
          inset: 0;
        }
        .sa-stage-hidden {
          opacity: 0;
          filter: blur(8px);
          transform: scale(0.985);
          pointer-events: none;
        }
        .sa-stage-visible {
          opacity: 1;
          filter: blur(0);
          transform: scale(1);
        }
      `}</style>

      {/* Navy frame wrapper */}
      <div
        className="relative rounded-[28px] p-5 sm:p-8 lg:p-10 sa-rise"
        style={{
          background: `linear-gradient(180deg, ${NAVY} 0%, #1A2A4F 55%, #20335E 100%)`,
          boxShadow:
            "0 30px 60px -25px rgba(20,33,61,0.45), 0 10px 24px -10px rgba(20,33,61,0.25)",
          animationDelay: "0ms",
        }}
      >
        {/* Red accent bar */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 -top-px rounded-b-full"
          style={{ width: 96, height: 4, background: RED }}
        />
        {/* Subtle inner glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px]"
          style={{
            background:
              "radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)",
          }}
        />

        <div className="relative space-y-6 sm:space-y-8">
          {/* Stepper: Course + Chapter */}
          <section
            className="rounded-2xl sa-rise p-5 sm:p-6"
            style={{
              background: "#fff",
              boxShadow:
                "0 12px 28px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
              animationDelay: "120ms",
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {/* Step 1 — Course */}
              <div className="space-y-2.5">
                {stepLabel(1, "Course", courseChosen)}
                {courses ? (
                  <SelectShell
                    value={selectedCourseId ?? ""}
                    onChange={(v) => onCourseChange?.(v)}
                    accent={!!selectedCourseId}
                  >
                    <option value="">Choose course…</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </SelectShell>
                ) : (
                  <div
                    className="w-full rounded-lg px-4 py-2.5 text-[14px] font-semibold flex items-center justify-between"
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      color: NAVY,
                    }}
                  >
                    <span className="truncate">{fixedCourseLabel ?? "—"}</span>
                    <Lock className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />
                  </div>
                )}
              </div>

              {/* Step 2 — Chapter */}
              <div className="space-y-2.5">
                {stepLabel(2, "Chapter", chapterChosen)}
                <SelectShell
                  ref={chapterDropdownRef}
                  value={selectedChapterId ?? ""}
                  onChange={handleChapterChange}
                  accent={!!selectedChapterId}
                  disabled={!courseChosen || chapterLoading || chapters.length === 0}
                  loading={chapterLoading}
                >
                  <option value="">
                    {!courseChosen
                      ? "Pick a course first"
                      : chapters.length === 0
                      ? "Loading chapters…"
                      : "Choose chapter…"}
                  </option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      Ch {ch.chapter_number} — {ch.chapter_name}
                    </option>
                  ))}
                </SelectShell>
              </div>
            </div>
          </section>

          {/* Workspace pane — retro terminal launchpad OR loaded tool */}
          {!activeTool ? (
            <div
              ref={workspaceRef}
              className="sa-rise"
              style={{ animationDelay: "240ms" }}
            >
              <RetroTerminalFrame
                courseLabel={fixedCourseLabel ?? selectedCourseLabel ?? null}
                chapterLabel={
                  selectedChapter
                    ? `Ch ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}`
                    : null
                }
                tools={TERMINAL_TOOLS}
                activeToolKey={activeTool}
                canPickTool={chapterChosen}
                loading={chapterLoading}
                onNudgeChapter={handleNudgeChapter}
                onSelectTool={(key) => {
                  if (key === "feedback") {
                    onOpenFeedback();
                    return;
                  }
                  handleSelectTool(key as ToolKey);
                }}
              />
            </div>
          ) : (
            <section
              ref={workspaceRef}
              className="rounded-2xl overflow-hidden sa-rise"
              style={{
                background: "#fff",
                boxShadow:
                  "0 16px 40px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.10)",
                minHeight: 600,
                animationDelay: "0ms",
              }}
            >
              {activeTool === "practice" && viewerAssetCode && (
                <div className="relative">
                  <div
                    className="px-5 py-2.5 flex items-center justify-between gap-3 text-[12px]"
                    style={{ background: "#fff", borderBottom: "1px solid #EEF2F7", color: "#64748B" }}
                  >
                    <span className="truncate font-medium" style={{ color: NAVY }}>
                      {selectedChapter
                        ? `Ch ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}`
                        : "Practice Problem Helper"}
                    </span>
                    <button
                      onClick={() =>
                        window.open(
                          `/v2/solutions/${encodeURIComponent(viewerAssetCode)}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: NAVY, fontWeight: 600 }}
                    >
                      Open in new tab <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                  <iframe
                    key={viewerAssetCode}
                    src={`/v2/solutions/${encodeURIComponent(viewerAssetCode)}`}
                    title="Practice Problem Helper"
                    className="w-full block border-0"
                    style={{ height: "min(85vh, 980px)", background: "#fff" }}
                  />
                </div>
              )}

              {activeTool === "practice" && !viewerAssetCode && (
                <div className="flex items-center justify-center text-center px-6 py-24">
                  <p className="text-[14px]" style={{ color: "#64748B" }}>
                    This chapter is being finalized — check back soon.
                  </p>
                </div>
              )}

              {activeTool === "je" && (
                <div className="px-6 py-16 sm:py-20 max-w-2xl mx-auto text-center">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-widest"
                    style={{ background: "#FEF3C7", color: "#92400E" }}
                  >
                    Coming soon
                  </div>
                  <h3
                    className="mt-3 text-[26px] leading-tight"
                    style={{ color: NAVY, fontFamily: LOGO_FONT, fontWeight: 400 }}
                  >
                    Journal Entry Helper is being built
                  </h3>
                  <p className="mt-2 text-[14px]" style={{ color: "#64748B" }}>
                    Tell us exactly how you'd want this to work and we'll build it
                    straight from your feedback.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenFeedback}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
                      boxShadow: "0 4px 12px rgba(206,17,38,0.25)",
                    }}
                  >
                    Tell us what you'd want <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared dropdown shell ─── */

interface SelectShellProps {
  value: string;
  onChange: (v: string) => void;
  accent: boolean;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

const SelectShell = forwardRef<HTMLSelectElement, SelectShellProps>(function SelectShell(
  { value, onChange, accent, disabled, loading, children },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-lg px-4 py-2.5 pr-10 text-[14px] font-medium outline-none transition-all disabled:opacity-60"
        style={{
          background: disabled ? "#F1F5F9" : "#F8FAFC",
          border: `1px solid ${accent ? NAVY : "#E2E8F0"}`,
          color: NAVY,
          cursor: disabled ? "not-allowed" : loading ? "wait" : "pointer",
        }}
      >
        {children}
      </select>
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
        style={{ color: "#94A3B8" }}
      />
    </div>
  );
});
