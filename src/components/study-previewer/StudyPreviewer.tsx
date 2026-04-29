import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Lock, Target, NotebookPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolKey } from "@/components/dashboard/StudyToolCards";
import RetroTerminalFrame, {
  type TerminalTool,
} from "@/components/study-previewer/RetroTerminalFrame";
import { BrandedLoader } from "@/components/study-previewer/BrandedLoader";
import JEHelperPanel from "@/components/study-previewer/JEHelperPanel";
import {
  useChapterEntryAssets,
  usePrefetchStudyConsole,
} from "@/hooks/useStudyConsoleData";

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
  {
    key: "practice",
    label: "Practice Problem Helper",
    description: "Guided explanations for 2,500+ textbook-style problems.",
    cta: "Open helper",
    icon: Target,
  },
  {
    key: "je",
    label: "Journal Entry Helper",
    description: "Understand JEs instead of memorizing them.",
    cta: "Open helper",
    icon: NotebookPen,
  },
];

const COMING_SOON_IDEAS = [
  "Flashcard Drill",
  "Concept Helper",
  "Formula Guide",
  "Exam Cram Sheet",
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

  /** Dashboard-only: campus name shown as a read-only terminal line. */
  campusLabel?: string | null;
  /** Dashboard-only: enables simplified read-only Course/Campus context lines and
   *  "Choose Textbook Chapter" wording. Off by default so the landing preview
   *  retains the full course-picker experience. */
  dashboardMode?: boolean;
  /** Dashboard-only: optional short beta note rendered under the welcome. */
  betaNote?: string | null;

  /** Fires when chapter selection or active tool changes — for breadcrumbs etc. */
  onSelectionChange?: (state: {
    chapter: PreviewChapter | null;
    activeTool: ToolKey | null;
  }) => void;
  /** External signal to clear the active tool only (chapter stays selected). */
  closeToolSignal?: number;
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
  onSelectionChange,
  closeToolSignal,
}: StudyPreviewerProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  // chapterLoading is derived below from the TanStack RPC fetch state.
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [viewerAssetCode, setViewerAssetCode] = useState<string | null>(null);
  const [jeAssetCode, setJeAssetCode] = useState<string | null>(null);
  const [crtPulseKey, setCrtPulseKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [iframeReloadKey, setIframeReloadKey] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showSlowStatus, setShowSlowStatus] = useState(false);
  const [stageLockHeight, setStageLockHeight] = useState<number | null>(null);
  

  const chapterDropdownRef = useRef<HTMLSelectElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const courseChosen = courses
    ? !!selectedCourseId
    : !!fixedCourseLabel;
  // chapterChosen is computed below, after chapterLoading is derived.

  // Restore from localStorage on mount — only restore the chapter id; the
  // first-asset codes will be filled in by the TanStack RPC hook below.
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

  // Single source of truth for the chapter's first-asset codes via RPC.
  // Cached for the session by TanStack — switching chapters back and forth
  // never re-queries.
  const { data: entryAssets, isFetching: entryAssetsFetching } =
    useChapterEntryAssets(selectedChapterId ?? null);
  const { prefetchChapterEntryAssets } = usePrefetchStudyConsole();

  // Mirror the RPC result into the local viewer state used by the iframe.
  useEffect(() => {
    if (!entryAssets) return;
    setViewerAssetCode(entryAssets.first_asset_name);
    setJeAssetCode(entryAssets.first_je_asset_name ?? entryAssets.first_asset_name);
  }, [entryAssets]);

  // Chapter is "loading" only while the RPC is in-flight for the *current*
  // selection AND we don't yet have data. No artificial delay.
  const chapterLoading = !!selectedChapterId && !entryAssets && entryAssetsFetching;
  const chapterChosen = !!selectedChapterId && !chapterLoading;

  useEffect(() => {
    if (resetSignal === undefined) return;
    setSelectedChapterId(null);
    setActiveTool(null);
    setViewerAssetCode(null);
    setJeAssetCode(null);
  }, [resetSignal]);

  // Listen for navigation intents bubbled up from the V2 viewer iframe so the
  // breadcrumb home/chapter clicks return the student to the previewer's
  // terminal screen instead of navigating inside the iframe.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "sa-viewer-go-home") {
        setActiveTool(null);
        setSelectedChapterId(null);
        setViewerAssetCode(null);
        setJeAssetCode(null);
        if (persistChapterKey) {
          try { localStorage.removeItem(persistChapterKey); } catch { /* ignore */ }
        }
      } else if (type === "sa-viewer-go-chapter") {
        // Keep the chapter selected; just close the active tool so the student
        // lands on the per-chapter tool selector.
        setActiveTool(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [persistChapterKey]);

  const handleChapterChange = (chId: string) => {
    if (!chId) {
      setSelectedChapterId(null);
      setViewerAssetCode(null);
      setJeAssetCode(null);
      setActiveTool(null);
      if (persistChapterKey) {
        try { localStorage.removeItem(persistChapterKey); } catch { /* ignore */ }
      }
      return;
    }
    // Always reset any open tool — switching chapters returns the user to the
    // terminal tool-selection state for the new chapter.
    setActiveTool(null);
    // Optimistically clear stale codes so the iframe doesn't briefly show the
    // previous chapter's first asset. The RPC hook will repopulate on success.
    setViewerAssetCode(null);
    setJeAssetCode(null);
    setSelectedChapterId(chId);

    if (persistChapterKey) {
      try { localStorage.setItem(persistChapterKey, chId); } catch { /* ignore */ }
    }

    // Prefetch the next chapter's entry assets so consecutive switches are
    // instant.
    const idx = chapters.findIndex((c) => c.id === chId);
    const next = chapters[idx + 1];
    if (next) prefetchChapterEntryAssets(next.id);
  };

  // Course changes from the inline terminal selector — reset chapter + tool so
  // the user is dropped back at the chapter-pick state for the new course.
  const handleCourseChange = (courseId: string) => {
    setActiveTool(null);
    setSelectedChapterId(null);
    setViewerAssetCode(null);
    setJeAssetCode(null);
    if (persistChapterKey) {
      try { localStorage.removeItem(persistChapterKey); } catch { /* ignore */ }
    }
    onCourseChange?.(courseId);
  };

  const handleSelectTool = (key: ToolKey) => {
    if (key === "practice" && onRequestUnlock && !onRequestUnlock("open_workspace")) {
      return;
    }
    // Lock the stage to the retro terminal's current height so the new viewer
    // takes over IN PLACE without pushing the page down.
    const currentHeight = workspaceRef.current?.offsetHeight ?? null;
    if (currentHeight) setStageLockHeight(currentHeight);
    // Reset viewer load state for the new tool
    setIframeLoaded(false);
    setIframeError(false);
    // Show skeleton immediately so the chassis paints with content the moment
    // the retro layer hides — no perceived "monitor disappeared" gap.
    setShowSkeleton(true);
    setShowSlowStatus(false);
    // Fire the CRT refresh pulse on the retro layer
    setCrtPulseKey((k) => k + 1);
    setActiveTool(key);
    // Gentle conditional scroll — only if the workspace top is off-screen.
    setTimeout(() => {
      const el = workspaceRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.top > window.innerHeight * 0.6) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  // Subtle status at >2s, error at >12s. Skeleton renders immediately on click.
  useEffect(() => {
    if (!activeTool || iframeLoaded || iframeError) return;
    const t2 = window.setTimeout(() => setShowSlowStatus(true), 2000);
    const t3 = window.setTimeout(() => {
      if (!iframeLoaded) setIframeError(true);
    }, 12000);
    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [activeTool, iframeReloadKey, viewerAssetCode, iframeLoaded, iframeError]);

  // Release the locked stage height once we leave a tool, or as a safety net
  // shortly after activation in case onLoad never fires (e.g., placeholder tools).
  useEffect(() => {
    if (!activeTool) {
      setStageLockHeight(null);
      return;
    }
    const safety = window.setTimeout(() => setStageLockHeight(null), 800);
    return () => window.clearTimeout(safety);
  }, [activeTool]);

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId],
  );

  // Emit selection state up so the parent can render breadcrumbs.
  useEffect(() => {
    onSelectionChange?.({ chapter: selectedChapter, activeTool });
  }, [selectedChapter, activeTool, onSelectionChange]);

  // External signal to close the active tool only (chapter stays selected).
  useEffect(() => {
    if (closeToolSignal === undefined) return;
    setActiveTool(null);
  }, [closeToolSignal]);

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

        /* Crossfade stage: retro terminal ↔ modern viewer share the same frame.
           Tuned to feel instant — no perceptible "monitor disappeared" gap. */
        .sa-stage { position: relative; }
        .sa-stage-layer {
          transition:
            opacity 90ms linear,
            transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }
        .sa-stage-overlay {
          position: absolute;
          inset: 0;
        }
        .sa-stage-hidden {
          opacity: 0;
          transform: scale(0.998);
          pointer-events: none;
        }
        .sa-stage-visible {
          opacity: 1;
          transform: scale(1);
        }

        /* One-shot CRT refresh pulse — a quick scanline sweep + soft flash on the retro layer */
        @keyframes sa-crt-pulse-flash {
          0%   { opacity: 0; }
          25%  { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes sa-crt-pulse-sweep {
          0%   { transform: translateY(-100%); opacity: 0.0; }
          15%  { opacity: 0.7; }
          100% { transform: translateY(100%); opacity: 0.0; }
        }
        .sa-crt-pulse {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
          overflow: hidden;
          border-radius: inherit;
        }
        .sa-crt-pulse::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(124,255,176,0.12);
          mix-blend-mode: screen;
          animation: sa-crt-pulse-flash 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sa-crt-pulse::after {
          content: "";
          position: absolute;
          left: 0; right: 0;
          height: 28%;
          background: linear-gradient(180deg,
            rgba(124,255,176,0) 0%,
            rgba(124,255,176,0.18) 50%,
            rgba(124,255,176,0) 100%);
          mix-blend-mode: screen;
          animation: sa-crt-pulse-sweep 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
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

      {/* Console wrapper — transparent; lets the hero section background show through */}
      <div className="relative sa-rise" style={{ animationDelay: "0ms" }}>

        <div className="relative">
          {/* Workspace stage — retro terminal + modern viewer crossfade in the same frame */}
          <div
            ref={workspaceRef}
            className="sa-stage sa-rise"
            style={{
              animationDelay: "240ms",
              minHeight: stageLockHeight ? `${stageLockHeight}px` : undefined,
            }}
          >
            {/* Prefetch the v2 viewer route once we know the asset, so click feels instant */}
            {viewerAssetCode && !activeTool && (
              <link
                rel="prefetch"
                href={`/v2/solutions/${encodeURIComponent(viewerAssetCode)}`}
              />
            )}

            {/* Layer 1 — Retro terminal launchpad (in flow when no tool, overlay when transitioning out) */}
            <div
              className={`sa-stage-layer ${activeTool ? "sa-stage-overlay sa-stage-hidden" : "sa-stage-visible"}`}
              aria-hidden={!!activeTool}
              style={{ position: activeTool ? "absolute" : "relative", inset: activeTool ? 0 : undefined }}
            >
              {/* One-shot CRT refresh pulse triggered on tool selection */}
              {crtPulseKey > 0 && (
                <div key={`crt-${crtPulseKey}`} className="sa-crt-pulse" aria-hidden />
              )}
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
                chapterSelector={
                  courseChosen ? (
                    <SelectShell
                      ref={chapterDropdownRef}
                      value={selectedChapterId ?? ""}
                      onChange={handleChapterChange}
                      accent={false}
                      compact
                      disabled={chapterLoading || chapters.length === 0}
                      loading={chapterLoading}
                    >
                      <option value="">
                        {chapters.length === 0 ? "Loading chapters…" : "Choose chapter…"}
                      </option>
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          Ch {ch.chapter_number} — {ch.chapter_name}
                        </option>
                      ))}
                    </SelectShell>
                  ) : null
                }
                courseSelector={
                  courses ? (
                    <SelectShell
                      value={selectedCourseId ?? ""}
                      onChange={handleCourseChange}
                      accent={false}
                      compact
                    >
                      <option value="">Choose course…</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </SelectShell>
                  ) : null
                }
                canChangeCourse={!!courses && courses.length > 1}
                canChangeChapter={chapterChosen && chapters.length > 1}
                comingSoonIdeas={COMING_SOON_IDEAS}
                onShareFeedback={onOpenFeedback}
                onSelectTool={(key) => {
                  if (key === "feedback") {
                    onOpenFeedback();
                    return;
                  }
                  handleSelectTool(key as ToolKey);
                }}
              />
            </div>

            {/* Layer 2 — Modern laptop chassis with the V2 viewer inside */}
            {activeTool && (
              <section
                className="sa-stage-layer sa-stage-visible"
                aria-label={
                  activeTool === "practice"
                    ? "Practice Problem Helper"
                    : "Journal Entry Helper"
                }
              >
                <div className="w-full flex justify-center px-2 sm:px-6 py-6 sm:py-10 animate-fade-in">
                  <div className="w-full" style={{ maxWidth: 980 }}>
                    {/* Modern laptop lid */}
                    <div
                      className="relative rounded-t-[18px] p-3 sm:p-4"
                      style={{
                        background: "linear-gradient(180deg, #1F1F23 0%, #141417 100%)",
                        border: "1px solid #2A2A30",
                        boxShadow:
                          "0 30px 60px -25px rgba(0,0,0,0.6), 0 10px 24px -10px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Camera dot */}
                      <div
                        aria-hidden
                        className="absolute left-1/2 -translate-x-1/2 top-1.5 rounded-full"
                        style={{ width: 4, height: 4, background: "#3A3A42" }}
                      />

                      {/* Modern bright screen */}
                      <div
                        className="relative rounded-md overflow-hidden bg-white"
                        style={{
                          border: "1px solid rgba(0,0,0,0.08)",
                          minHeight: "clamp(380px, 56vw, 560px)",
                        }}
                      >
                        {activeTool === "practice" && viewerAssetCode && !iframeError && (
                          <>
                            {/* Branded loader sits behind the iframe and is covered as the iframe paints */}
                            {!iframeLoaded && (
                              <BrandedLoader
                                surface="navy"
                                subtitle={showSlowStatus ? "Preparing tool…" : undefined}
                              />
                            )}

                            <iframe
                              key={`${viewerAssetCode}-${iframeReloadKey}`}
                              src={`/v2/solutions/${encodeURIComponent(viewerAssetCode)}`}
                              title="Practice Problem Helper"
                              className="w-full block border-0 relative z-10"
                              style={{
                                height: "min(85vh, 980px)",
                                background: "#fff",
                              }}
                              onLoad={() => { setIframeLoaded(true); setStageLockHeight(null); }}
                              onError={() => setIframeError(true)}
                            />
                          </>
                        )}

                        {activeTool === "practice" && viewerAssetCode && iframeError && (
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3"
                            style={{ background: "#fff" }}
                            role="alert"
                          >
                            <p className="text-[13.5px]" style={{ color: "#475569" }}>
                              Tool didn't load. Try again.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setIframeError(false);
                                setIframeLoaded(false);
                                setShowSkeleton(false);
                                setShowSlowStatus(false);
                                setIframeReloadKey((k) => k + 1);
                              }}
                              className="inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
                              style={{
                                color: "#14213D",
                                background: "#F1F5F9",
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              Retry
                            </button>
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
                          <JEHelperPanel
                            chapter={selectedChapter}
                            onShareFeedback={onOpenFeedback}
                            onGoHome={() => {
                              setActiveTool(null);
                              setSelectedChapterId(null);
                              setViewerAssetCode(null);
                              setJeAssetCode(null);
                              if (persistChapterKey) {
                                try { localStorage.removeItem(persistChapterKey); } catch { /* ignore */ }
                              }
                            }}
                            onGoChapter={() => setActiveTool(null)}
                          />
                        )}
                      </div>

                    </div>
                  </div>
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
  compact?: boolean;
  children: React.ReactNode;
}

const SelectShell = forwardRef<HTMLSelectElement, SelectShellProps>(function SelectShell(
  { value, onChange, accent, disabled, loading, compact, children },
  ref,
) {
  const phosphorBorder = "rgba(124,255,176,0.35)";
  const phosphorGlow = "rgba(124,255,176,0.45)";
  return (
    <div className="relative group">
      <select
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={
          compact
            ? "w-full appearance-none rounded-[4px] pl-2 pr-7 py-1 text-[12.5px] outline-none transition-all disabled:opacity-60 focus:outline-none"
            : "w-full appearance-none rounded-md px-3 py-2.5 pr-9 text-[13.5px] font-medium outline-none transition-all disabled:opacity-60 focus:outline-none"
        }
        style={{
          background: compact
            ? "rgba(8,28,16,0.55)"
            : disabled
            ? "rgba(0,0,0,0.25)"
            : "rgba(0,0,0,0.35)",
          border: `1px solid ${compact ? phosphorBorder : accent ? PHOSPHOR_DIM : CHASSIS_BORDER}`,
          color: compact ? "#E8FFF1" : accent ? PHOSPHOR : "#E8FFF1",
          fontFamily: MONO_FONT,
          letterSpacing: "0.01em",
          cursor: disabled ? "not-allowed" : loading ? "wait" : "pointer",
          boxShadow: compact
            ? `inset 0 0 0 1px rgba(124,255,176,0.10), 0 0 8px -3px ${phosphorGlow}`
            : accent
            ? `inset 0 0 0 1px ${PHOSPHOR_GLOW}, 0 0 12px -4px ${PHOSPHOR_GLOW}`
            : "inset 0 1px 2px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </select>
      <ChevronDown
        className={
          compact
            ? "absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none transition-colors"
            : "absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors"
        }
        style={{ color: compact ? PHOSPHOR : accent ? PHOSPHOR : "#6B7280" }}
      />
    </div>
  );
});
