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

/* Match the retro terminal chassis so the selectors feel like the same hardware. */
const PHOSPHOR = "#7CFFB0";
const PHOSPHOR_DIM = "rgba(124,255,176,0.65)";
const PHOSPHOR_GLOW = "rgba(124,255,176,0.45)";
const CHASSIS_TOP = "#1F1F23";
const CHASSIS_BOTTOM = "#141417";
const CHASSIS_BORDER = "#2A2A30";
const MONO_FONT = "'JetBrains Mono', 'SF Mono', ui-monospace, monospace";

const TERMINAL_TOOLS: TerminalTool[] = [
  { key: "practice", label: "Practice Problem Helper" },
  { key: "je", label: "Journal Entry Helper" },
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

  /** Personalized welcome shown inside the monitor (dashboard only). */
  welcomeName?: string | null;
  /** When true, greets as returning ("Welcome back"); otherwise as new ("Welcome"). */
  isReturning?: boolean;
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
  welcomeName,
  isReturning,
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

  // Restore from localStorage — also hydrate the first asset code so the
  // Practice Problem Helper has something to load on first click.
  useEffect(() => {
    if (!persistChapterKey) return;
    let cancelled = false;
    try {
      const stored = localStorage.getItem(persistChapterKey);
      if (stored && chapters.some((c) => c.id === stored)) {
        setSelectedChapterId(stored);
        (async () => {
          const { data } = await supabase
            .from("teaching_assets")
            .select("asset_name, source_number")
            .eq("chapter_id", stored)
            .order("source_number", { ascending: true, nullsFirst: false })
            .order("asset_name", { ascending: true })
            .limit(1);
          if (cancelled) return;
          setViewerAssetCode(data?.[0]?.asset_name ?? null);
        })();
      }
    } catch { /* ignore */ }
    return () => { cancelled = true; };
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

  const moduleHeader = (
    label: string,
    active: boolean,
    complete: boolean,
    pulseKey: string | number = "",
  ) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="relative inline-flex items-center justify-center"
          style={{ width: 9, height: 9 }}
        >
          {/* One-shot pulse ring on change */}
          {active && (
            <span
              key={`pulse-${label}-${pulseKey}`}
              className="absolute inset-0 rounded-full sa-status-pulse"
              style={{ background: PHOSPHOR }}
            />
          )}
          {/* Core LED */}
          <span
            className="relative inline-block rounded-full transition-all duration-300"
            style={{
              width: 7,
              height: 7,
              background: active ? PHOSPHOR : "#3A3A42",
              boxShadow: active
                ? `0 0 8px ${PHOSPHOR_GLOW}, inset 0 0 2px rgba(255,255,255,0.35)`
                : "inset 0 0 2px rgba(0,0,0,0.4)",
            }}
          />
        </span>
        <span
          className="text-[10.5px] uppercase font-semibold transition-colors duration-300"
          style={{
            color: active ? PHOSPHOR_DIM : "#6B7280",
            letterSpacing: "0.22em",
            fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
          }}
        >
          {label}
        </span>
        <span
          className="text-[9px] font-semibold transition-opacity duration-300"
          style={{
            color: active ? PHOSPHOR : "#4B5563",
            opacity: active ? 1 : 0.55,
            letterSpacing: "0.18em",
            fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
            textShadow: active ? `0 0 4px ${PHOSPHOR_GLOW}` : "none",
          }}
        >
          {active ? "● ACTIVE" : "○ STANDBY"}
        </span>
      </div>
      {complete && (
        <Check
          className="h-3 w-3"
          strokeWidth={3}
          style={{ color: PHOSPHOR, filter: `drop-shadow(0 0 3px ${PHOSPHOR_GLOW})` }}
        />
      )}
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

        /* One-shot status LED ring pulse on selector change */
        @keyframes sa-status-pulse {
          0%   { transform: scale(0.6); opacity: 0.7; }
          80%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .sa-status-pulse {
          animation: sa-status-pulse 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
          pointer-events: none;
        }

        /* ─── 90s desktop-app window frame ─── */
        .sa-win-frame {
          background: #ECECEE;
          border-radius: 10px;
          border: 1px solid #C8CAD0;
          box-shadow:
            0 16px 40px rgba(0,0,0,0.28),
            0 4px 10px rgba(0,0,0,0.12),
            inset 0 1px 0 rgba(255,255,255,0.85),
            inset 0 -1px 0 rgba(0,0,0,0.06);
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }
        .sa-win-titlebar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: linear-gradient(180deg, #E6E8EE 0%, #C8CCD4 100%);
          border-bottom: 1px solid #A9ADB5;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
          position: relative;
        }
        .sa-win-traffic { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .sa-win-dot {
          width: 12px; height: 12px; border-radius: 50%;
          border: 1px solid;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 1px 0 rgba(0,0,0,0.05);
        }
        .sa-win-title {
          flex: 1;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #2A2F3A;
          letter-spacing: 0.01em;
          text-shadow: 0 1px 0 rgba(255,255,255,0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 8px;
        }
        .sa-win-controls { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .sa-win-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px; height: 18px;
          font-size: 10px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          color: #3A3F4A;
          background: linear-gradient(180deg, #F4F5F8 0%, #D9DCE3 100%);
          border: 1px solid #A9ADB5;
          border-radius: 3px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          line-height: 1;
        }
        .sa-win-btn-close { color: #8B1A1A; }

        .sa-win-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          background: linear-gradient(180deg, #F2F3F6 0%, #E4E6EC 100%);
          border-bottom: 1px solid #C8CAD0;
          font-size: 11.5px;
        }
        .sa-win-addr-label {
          font-weight: 600;
          color: #5A6070;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 10px;
        }
        .sa-win-addr {
          flex: 1;
          background: #fff;
          border: 1px solid #B5B9C2;
          border-radius: 3px;
          padding: 3px 8px;
          font-size: 11.5px;
          color: #14213D;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sa-win-tool-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 600;
          color: #14213D;
          background: linear-gradient(180deg, #FAFBFD 0%, #DDE0E7 100%);
          border: 1px solid #A9ADB5;
          border-radius: 3px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          cursor: pointer;
          transition: filter 120ms ease-out;
        }
        .sa-win-tool-btn:hover { filter: brightness(1.04); }
        .sa-win-tool-btn:active { box-shadow: inset 0 1px 2px rgba(0,0,0,0.15); }

        .sa-win-content {
          background: #fff;
          border-top: 1px solid #fff;
          box-shadow: inset 0 1px 0 rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04);
          margin: 0 6px;
          border-radius: 2px;
          overflow: hidden;
        }

        .sa-win-statusbar {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 4px 6px;
          background: linear-gradient(180deg, #E6E8EE 0%, #D2D5DC 100%);
          border-top: 1px solid #B5B9C2;
          font-size: 10.5px;
          color: #4A4F5A;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          letter-spacing: 0.04em;
        }
        .sa-win-status-cell {
          padding: 2px 10px;
          border: 1px solid transparent;
          border-left-color: rgba(255,255,255,0.7);
          border-right-color: rgba(0,0,0,0.08);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .sa-win-status-grow { flex: 1; }
        .sa-win-status-led {
          width: 7px; height: 7px; border-radius: 50%;
          background: #4ADE80;
          box-shadow: 0 0 4px rgba(74,222,128,0.6), inset 0 0 1px rgba(255,255,255,0.5);
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

        <div className="relative">
          {/* Setup panels — dark control modules above the monitor */}
          <section
            className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 sa-rise"
            style={{ animationDelay: "120ms" }}
          >
            {/* Module 1 — Course */}
            <div
              className="relative rounded-xl p-3.5 sm:p-4 space-y-2.5"
              style={{
                background: `linear-gradient(180deg, ${CHASSIS_TOP} 0%, ${CHASSIS_BOTTOM} 100%)`,
                border: `1px solid ${courseChosen ? "rgba(124,255,176,0.30)" : CHASSIS_BORDER}`,
                boxShadow: courseChosen
                  ? "0 8px 20px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 14px -4px rgba(124,255,176,0.30)"
                  : "0 8px 20px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
                transition: "box-shadow 280ms ease-out, border-color 280ms ease-out",
              }}
            >
              {moduleHeader("Course", courseChosen, courseChosen, selectedCourseId ?? "")}
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
                  className="w-full rounded-md px-3 py-2.5 text-[13.5px] font-medium flex items-center justify-between"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${CHASSIS_BORDER}`,
                    color: "#E8FFF1",
                    fontFamily: MONO_FONT,
                  }}
                >
                  <span className="truncate">{fixedCourseLabel ?? "—"}</span>
                  <Lock className="h-3.5 w-3.5 shrink-0 ml-2" style={{ color: "#6B7280" }} />
                </div>
              )}
              {/* I/O port label */}
              <span
                aria-hidden
                className="absolute right-3 top-3 text-[9px] font-semibold"
                style={{
                  color: "#4B5563",
                  letterSpacing: "0.18em",
                  fontFamily: MONO_FONT,
                }}
              >
                IN/01
              </span>
            </div>

            {/* Module 2 — Chapter */}
            <div
              className="relative rounded-xl p-3.5 sm:p-4 space-y-2.5"
              style={{
                background: `linear-gradient(180deg, ${CHASSIS_TOP} 0%, ${CHASSIS_BOTTOM} 100%)`,
                border: `1px solid ${chapterChosen ? "rgba(124,255,176,0.30)" : CHASSIS_BORDER}`,
                boxShadow: chapterChosen
                  ? "0 8px 20px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 14px -4px rgba(124,255,176,0.30)"
                  : "0 8px 20px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
                opacity: courseChosen ? 1 : 0.6,
                transition:
                  "box-shadow 280ms ease-out, border-color 280ms ease-out, opacity 280ms ease-out",
              }}
            >
              {moduleHeader("Chapter", chapterChosen, chapterChosen, selectedChapterId ?? "")}
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
              {/* I/O port label */}
              <span
                aria-hidden
                className="absolute right-3 top-3 text-[9px] font-semibold"
                style={{
                  color: "#4B5563",
                  letterSpacing: "0.18em",
                  fontFamily: MONO_FONT,
                }}
              >
                IN/02
              </span>
            </div>
          </section>

          {/* Signal bus — visually connects the modules to the monitor below */}
          <div
            aria-hidden
            className="relative mx-auto sa-rise"
            style={{ width: "60%", maxWidth: 420, height: 18, animationDelay: "200ms" }}
          >
            {/* Two short risers from each module */}
            <span
              className="absolute top-0"
              style={{
                left: "16%",
                width: 1,
                height: 9,
                background: courseChosen ? PHOSPHOR_DIM : CHASSIS_BORDER,
                boxShadow: courseChosen ? `0 0 6px ${PHOSPHOR_GLOW}` : "none",
                transition: "background 280ms ease-out, box-shadow 280ms ease-out",
              }}
            />
            <span
              className="absolute top-0"
              style={{
                right: "16%",
                width: 1,
                height: 9,
                background: chapterChosen ? PHOSPHOR_DIM : CHASSIS_BORDER,
                boxShadow: chapterChosen ? `0 0 6px ${PHOSPHOR_GLOW}` : "none",
                transition: "background 280ms ease-out, box-shadow 280ms ease-out",
              }}
            />
            {/* Horizontal bus */}
            <span
              className="absolute"
              style={{
                left: "16%",
                right: "16%",
                top: 9,
                height: 1,
                background:
                  courseChosen && chapterChosen
                    ? `linear-gradient(90deg, ${PHOSPHOR_DIM} 0%, ${PHOSPHOR} 50%, ${PHOSPHOR_DIM} 100%)`
                    : courseChosen || chapterChosen
                    ? `linear-gradient(90deg, ${PHOSPHOR_DIM} 0%, ${CHASSIS_BORDER} 100%)`
                    : CHASSIS_BORDER,
                boxShadow:
                  courseChosen && chapterChosen ? `0 0 8px ${PHOSPHOR_GLOW}` : "none",
                transition: "background 280ms ease-out, box-shadow 280ms ease-out",
              }}
            />
            {/* Center riser into the monitor */}
            <span
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: 9,
                width: 1,
                height: 9,
                background:
                  courseChosen && chapterChosen ? PHOSPHOR : CHASSIS_BORDER,
                boxShadow:
                  courseChosen && chapterChosen ? `0 0 8px ${PHOSPHOR_GLOW}` : "none",
                transition: "background 280ms ease-out, box-shadow 280ms ease-out",
              }}
            />
            {/* Center node */}
            <span
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                top: 14,
                width: 5,
                height: 5,
                background:
                  courseChosen && chapterChosen ? PHOSPHOR : "#3A3A42",
                boxShadow:
                  courseChosen && chapterChosen ? `0 0 8px ${PHOSPHOR_GLOW}` : "none",
                transition: "background 280ms ease-out, box-shadow 280ms ease-out",
              }}
            />
          </div>

          {/* Workspace stage — retro terminal + modern viewer crossfade in the same frame */}
          <div
            ref={workspaceRef}
            className="sa-stage sa-rise mt-2"
            style={{ animationDelay: "240ms" }}
          >
            {/* Layer 1 — Retro terminal launchpad (in flow when no tool, overlay when transitioning out) */}
            <div
              className={`sa-stage-layer ${activeTool ? "sa-stage-overlay sa-stage-hidden" : "sa-stage-visible"}`}
              aria-hidden={!!activeTool}
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
                welcomeName={welcomeName ?? null}
                isReturning={!!isReturning}
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

            {/* Layer 2 — Modern V2 viewer in a subtle 90s desktop-app frame */}
            {activeTool && (
              <section
                className="sa-stage-layer sa-stage-visible sa-win-frame"
                style={{ minHeight: 600 }}
              >
                {/* Classic title bar */}
                <div className="sa-win-titlebar">
                  <div className="sa-win-traffic" aria-hidden>
                    <span className="sa-win-dot" style={{ background: "#FF5F57", borderColor: "#E14640" }} />
                    <span className="sa-win-dot" style={{ background: "#FEBC2E", borderColor: "#D89E1F" }} />
                    <span className="sa-win-dot" style={{ background: "#28C840", borderColor: "#1FA22F" }} />
                  </div>
                  <div className="sa-win-title">
                    {activeTool === "practice"
                      ? selectedChapter
                        ? `Practice Problem Helper — Ch ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}`
                        : "Practice Problem Helper"
                      : "Journal Entry Helper"}
                  </div>
                  <div className="sa-win-controls" aria-hidden>
                    <span className="sa-win-btn">_</span>
                    <span className="sa-win-btn">▢</span>
                    <span className="sa-win-btn sa-win-btn-close">✕</span>
                  </div>
                </div>

                {/* Optional toolbar / address strip */}
                {activeTool === "practice" && viewerAssetCode && (
                  <div className="sa-win-toolbar">
                    <span className="sa-win-addr-label">File</span>
                    <div className="sa-win-addr">
                      <span className="truncate">
                        {selectedChapter
                          ? `Ch ${selectedChapter.chapter_number} — ${selectedChapter.chapter_name}`
                          : "Practice Problem Helper"}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        window.open(
                          `/v2/solutions/${encodeURIComponent(viewerAssetCode)}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="sa-win-tool-btn"
                    >
                      Open in new tab <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Inset content well */}
                <div className="sa-win-content">
                  {activeTool === "practice" && viewerAssetCode && (
                    <iframe
                      key={viewerAssetCode}
                      src={`/v2/solutions/${encodeURIComponent(viewerAssetCode)}`}
                      title="Practice Problem Helper"
                      className="w-full block border-0"
                      style={{ height: "min(85vh, 980px)", background: "#fff" }}
                    />
                  )}

                  {activeTool === "practice" && !viewerAssetCode && (
                    <div className="flex items-center justify-center text-center px-6 py-24 bg-white">
                      <p className="text-[14px]" style={{ color: "#64748B" }}>
                        This chapter is being finalized — check back soon.
                      </p>
                    </div>
                  )}

                  {activeTool === "je" && (
                    <div className="px-6 py-16 sm:py-20 max-w-2xl mx-auto text-center bg-white">
                      <h3
                        className="text-[26px] leading-tight"
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
                </div>

                {/* Status bar */}
                <div className="sa-win-statusbar">
                  <span className="sa-win-status-cell sa-win-status-grow">
                    <span className="sa-win-status-led" /> Ready
                  </span>
                  <span className="sa-win-status-cell">
                    {activeTool === "practice" ? "PRACTICE.EXE" : "JE_HELPER.EXE"}
                  </span>
                  <span className="sa-win-status-cell">SURVIVE OS</span>
                </div>
              </section>
            )}
          </div>
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
    <div className="relative group">
      <select
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-md px-3 py-2.5 pr-9 text-[13.5px] font-medium outline-none transition-all disabled:opacity-60 focus:outline-none"
        style={{
          background: disabled ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.35)",
          border: `1px solid ${accent ? PHOSPHOR_DIM : CHASSIS_BORDER}`,
          color: accent ? PHOSPHOR : "#E8FFF1",
          fontFamily: MONO_FONT,
          letterSpacing: "0.01em",
          cursor: disabled ? "not-allowed" : loading ? "wait" : "pointer",
          boxShadow: accent
            ? `inset 0 0 0 1px ${PHOSPHOR_GLOW}, 0 0 12px -4px ${PHOSPHOR_GLOW}`
            : "inset 0 1px 2px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </select>
      <ChevronDown
        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors"
        style={{ color: accent ? PHOSPHOR : "#6B7280" }}
      />
    </div>
  );
});
