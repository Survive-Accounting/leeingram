import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { Info, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const PHOSPHOR = "#7CFFB0";
const PHOSPHOR_DIM = "rgba(124,255,176,0.55)";
const PHOSPHOR_GLOW = "rgba(124,255,176,0.45)";
const PHOSPHOR_MUTED = "rgba(124,255,176,0.35)";

export interface TerminalTool {
  key: string;
  label: string;
  /** One-line descriptor shown under the title inside the terminal card. */
  description?: string;
  /** Subtle action cue rendered at the bottom of the card (e.g. "Open helper"). */
  cta?: string;
  /** Outline icon component (lucide-react) shown in the card header. */
  icon?: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
  /** Optional small caption shown after the label, e.g. "(coming soon)" */
  hint?: string;
  disabled?: boolean;
  /** Visual variant. "ghost" = dashed border, faded — implies user can shape it. */
  variant?: "default" | "ghost";
}

interface RetroTerminalFrameProps {
  courseLabel: string | null;
  chapterLabel: string | null;
  /** Optional tool list — when present, renders selectable lines inside the terminal. */
  tools?: TerminalTool[];
  /** Called when a user clicks a tool line or hits its number key. */
  onSelectTool?: (key: string) => void;
  /** Currently active tool key (highlighted with ▶). */
  activeToolKey?: string | null;
  /** Whether tool selection is allowed yet. */
  canPickTool?: boolean;
  /** True while the chapter data is loading. */
  loading?: boolean;
  /** Called when a user attempts to pick a tool before a chapter is chosen. */
  onNudgeChapter?: () => void;
  /** Optional first name for a personalized welcome line at the top of the terminal. */
  welcomeName?: string | null;
  /** When true, greets as returning ("Welcome back"); otherwise as new ("Welcome"). */
  isReturning?: boolean;
  /** Transient header notice (e.g. "Pick a chapter first"). When set, replaces the readiness badge and blinks. */
  notice?: string | null;
  /** Optional inline chapter selector rendered inside the terminal once a course is chosen. */
  chapterSelector?: React.ReactNode;
  /** Optional inline course selector rendered inside the terminal when "Change" is clicked. */
  courseSelector?: React.ReactNode;
  /** When true, course is changeable via inline "Change" affordance. */
  canChangeCourse?: boolean;
  /** When true, chapter is changeable via inline "Change" affordance. */
  canChangeChapter?: boolean;
  /** Optional list of upcoming tool ideas — rendered as chips in the secondary "coming soon" section. */
  comingSoonIdeas?: string[];
  /** Click handler for the secondary Share Feedback link. */
  onShareFeedback?: () => void;
  /** Dashboard-only: campus name to display as a read-only terminal line. When set,
   *  course is also rendered as a read-only line (no dropdown, no lock icon). */
  campusLabel?: string | null;
  /** Dashboard-only: when true, render the simplified read-only Course/Campus context
   *  lines and use "Choose Textbook Chapter" wording instead of "Choose Chapter". */
  dashboardMode?: boolean;
  /** Dashboard-only: optional short beta note rendered under the welcome line. */
  betaNote?: string | null;
}

/**
 * Retro CRT-in-a-laptop. Acts as the launchpad: shows boot lines for the
 * selected course/chapter and (when tools are passed in) lets the user
 * pick a study tool directly inside the terminal.
 */
export default function RetroTerminalFrame({
  courseLabel,
  chapterLabel,
  tools,
  onSelectTool,
  activeToolKey,
  canPickTool = true,
  loading = false,
  onNudgeChapter,
  welcomeName,
  isReturning = false,
  notice = null,
  chapterSelector = null,
  courseSelector = null,
  canChangeCourse = false,
  canChangeChapter = false,
  comingSoonIdeas,
  onShareFeedback,
  campusLabel = null,
  dashboardMode = false,
  betaNote = null,
}: RetroTerminalFrameProps) {
  const [bootStep, setBootStep] = useState(0);
  const [editingCourse, setEditingCourse] = useState(false);
  const [editingChapter, setEditingChapter] = useState(false);

  // Auto-exit edit mode whenever the underlying label changes (i.e. user picked something).
  const prevCourseRef = useRef(courseLabel);
  const prevChapterRef = useRef(chapterLabel);
  useEffect(() => {
    if (prevCourseRef.current !== courseLabel) {
      prevCourseRef.current = courseLabel;
      setEditingCourse(false);
    }
  }, [courseLabel]);
  useEffect(() => {
    if (prevChapterRef.current !== chapterLabel) {
      prevChapterRef.current = chapterLabel;
      setEditingChapter(false);
    }
  }, [chapterLabel]);

  // Type-in + pulse state for the two reactive lines
  const courseTyped = useTerminalValue(courseLabel);
  const chapterTyped = useTerminalValue(chapterLabel);

  // CRT pulse: one quick brighten when either value changes (skips the very first mount)
  const [crtPulseKey, setCrtPulseKey] = useState(0);
  // CRT sweep: stronger phosphor band sweep, fired on tool click / hand-off
  const [crtSweepKey, setCrtSweepKey] = useState(0);
  // Track which row was just clicked so it briefly flashes
  const [flashedToolKey, setFlashedToolKey] = useState<string | null>(null);
  const [chapterError, setChapterError] = useState(false);

  // Clear the inline chapter error as soon as a chapter is picked.
  useEffect(() => {
    if (canPickTool) setChapterError(false);
  }, [canPickTool]);

  const nudgeChapter = () => {
    setChapterError(true);
    onNudgeChapter?.();
  };
  const firstPulseRef = useRef(true);
  useEffect(() => {
    if (firstPulseRef.current) { firstPulseRef.current = false; return; }
    setCrtPulseKey((k) => k + 1);
  }, [courseLabel, chapterLabel]);

  const triggerToolPulse = (toolKey: string) => {
    setCrtPulseKey((k) => k + 1);
    setCrtSweepKey((k) => k + 1);
    setFlashedToolKey(toolKey);
    window.setTimeout(() => setFlashedToolKey(null), 540);
  };

  // Sequential reveal of the boot lines for a tasteful "entering the system" feel.
  useEffect(() => {
    setBootStep(0);
    const timers: number[] = [];
    const steps = [180, 380, 580, 760, 940, 1120];
    steps.forEach((delay, i) => {
      timers.push(window.setTimeout(() => setBootStep(i + 1), delay));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [courseLabel, chapterLabel, tools?.length]);

  // Number-key shortcuts (1..9)
  useEffect(() => {
    if (!tools || !onSelectTool) return;
    const handler = (e: KeyboardEvent) => {
      // ignore when user is typing in inputs
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const n = parseInt(e.key, 10);
      if (!Number.isFinite(n) || n < 1 || n > tools.length) return;
      const tool = tools[n - 1];
      if (!tool || tool.disabled) return;
      if (!canPickTool) {
        nudgeChapter();
        return;
      }
      triggerToolPulse(tool.key);
      onSelectTool(tool.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tools, onSelectTool, canPickTool, onNudgeChapter]);

  const safeCourse = courseLabel?.trim() || "—";
  const safeChapter = chapterLabel?.trim() || "—";

  const promptLabel = !canPickTool
    ? "> Select a chapter to start studying"
    : loading
    ? "> Loading chapter assets"
    : "> Select a study tool";

  const LOGO_URL =
    "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";

  return (
    <div className="w-full flex justify-center px-2 sm:px-6 py-6 sm:py-10 animate-fade-in">
      <style>{`
        @keyframes sa-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes sa-crt-flicker {
          0%, 100% { opacity: 1; }
          48% { opacity: 0.97; }
          50% { opacity: 0.93; }
          52% { opacity: 0.99; }
        }
        /* Quick phosphor glow pulse on a refreshed value */
        @keyframes sa-phosphor-pulse {
          0%   { color: #FFFFFF; text-shadow: 0 0 6px #7CFFB0, 0 0 18px rgba(124,255,176,0.85); }
          60%  { color: #EAFFF2; text-shadow: 0 0 3px rgba(124,255,176,0.6), 0 0 10px rgba(124,255,176,0.5); }
          100% { color: #E8FFF1; text-shadow: 0 0 1px rgba(124,255,176,0.45), 0 0 8px rgba(124,255,176,0.45); }
        }
        .sa-value-pulse { animation: sa-phosphor-pulse 720ms cubic-bezier(0.22,1,0.36,1) both; }
        /* Signal-received: brief soft phosphor wash across the whole line */
        @keyframes sa-line-flash {
          0%   { background: rgba(124,255,176,0); box-shadow: inset 0 0 0 0 rgba(124,255,176,0); }
          18%  { background: rgba(124,255,176,0.10); box-shadow: inset 0 0 0 1px rgba(124,255,176,0.28), 0 0 14px rgba(124,255,176,0.18); }
          100% { background: rgba(124,255,176,0); box-shadow: inset 0 0 0 0 rgba(124,255,176,0); }
        }
        .sa-line-flash { animation: sa-line-flash 780ms cubic-bezier(0.22,1,0.36,1) both; }
        /* Very slow scanline drift — adds ambient life without flicker. 3px travel = perfect seamless loop. */
        @keyframes sa-scanline-drift {
          0%   { background-position: 0 0; }
          100% { background-position: 0 3px; }
        }
        .sa-crt-scanlines { animation: sa-scanline-drift 9s linear infinite; }
        /* Soft scanline brightness pulse on the whole CRT after an update */
        @keyframes sa-crt-pulse {
          0%   { box-shadow: inset 0 0 0 0 rgba(124,255,176,0); filter: brightness(1); }
          25%  { box-shadow: inset 0 0 80px 4px rgba(124,255,176,0.10); filter: brightness(1.06); }
          100% { box-shadow: inset 0 0 0 0 rgba(124,255,176,0); filter: brightness(1); }
        }
        .sa-crt-pulse-overlay {
          position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
          animation: sa-crt-pulse 520ms ease-out both;
        }
        /* Phosphor scanline sweep — a soft band that travels top→bottom once */
        @keyframes sa-crt-sweep {
          0%   { transform: translateY(-40%); opacity: 0; }
          15%  { opacity: 0.9; }
          100% { transform: translateY(140%); opacity: 0; }
        }
        .sa-crt-sweep-overlay {
          position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
          overflow: hidden;
        }
        .sa-crt-sweep-overlay::before {
          content: ""; position: absolute; left: 0; right: 0; top: 0;
          height: 38%;
          background: linear-gradient(
            180deg,
            rgba(124,255,176,0) 0%,
            rgba(124,255,176,0.10) 45%,
            rgba(180,255,210,0.18) 50%,
            rgba(124,255,176,0.10) 55%,
            rgba(124,255,176,0) 100%
          );
          filter: blur(2px);
          animation: sa-crt-sweep 620ms cubic-bezier(0.22,1,0.36,1) both;
        }
        /* Brief row highlight when a tool is activated */
        @keyframes sa-row-flash {
          0%   { background: rgba(124,255,176,0.22); box-shadow: inset 0 0 0 1px rgba(124,255,176,0.45); }
          100% { background: rgba(124,255,176,0); box-shadow: inset 0 0 0 1px rgba(124,255,176,0); }
        }
        .sa-row-flash { animation: sa-row-flash 520ms ease-out both; }
        /* Blinking attention notice — sits just outside the CRT palette */
        @keyframes sa-notice-blink {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50%      { opacity: 0.55; transform: translateY(-1px); }
        }
        .sa-notice-blink { animation: sa-notice-blink 1.05s ease-in-out infinite; }
        /* Polished staggered reveal for the tool cards once a chapter is selected */
        @keyframes sa-tool-reveal {
          0%   { opacity: 0; transform: translateY(6px) scale(0.985); filter: blur(3px); }
          60%  { filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .sa-toolgrid-reveal > * {
          animation: sa-tool-reveal 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sa-toolgrid-reveal > *:nth-child(1) { animation-delay: 60ms; }
        .sa-toolgrid-reveal > *:nth-child(2) { animation-delay: 160ms; }
        .sa-toolgrid-reveal > *:nth-child(3) { animation-delay: 260ms; }
      `}</style>

      <div className="w-full" style={{ maxWidth: 980 }}>
        {/* Laptop lid */}
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

          {/* CRT screen */}
          <div
            className="relative rounded-md overflow-hidden"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 30%, #052810 0%, #03130A 60%, #010904 100%)",
              border: "1px solid #0A1A12",
              minHeight: "clamp(380px, 56vw, 560px)",
              animation: "sa-crt-flicker 6s ease-in-out infinite",
            }}
          >
            {/* CRT pulse on value updates */}
            {crtPulseKey > 0 && (
              <div key={`crt-pulse-${crtPulseKey}`} className="sa-crt-pulse-overlay" aria-hidden />
            )}
            {/* CRT sweep on tool launch / hand-off to viewer */}
            {crtSweepKey > 0 && (
              <div key={`crt-sweep-${crtSweepKey}`} className="sa-crt-sweep-overlay" aria-hidden />
            )}
            {/* Horizontal scanlines — slow drift for ambient life */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none sa-crt-scanlines"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
                mixBlendMode: "multiply",
              }}
            />
            {/* Aperture grille — faint vertical RGB-style shadow mask for phosphor texture */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(124,255,176,0.035) 0px, rgba(124,255,176,0.035) 1px, transparent 1px, transparent 3px)",
                mixBlendMode: "screen",
                opacity: 0.55,
              }}
            />
            {/* Top phosphor bloom — gentle warm-up glow at the top of the tube */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(120% 60% at 50% 0%, rgba(124,255,176,0.07) 0%, rgba(124,255,176,0) 55%)",
                mixBlendMode: "screen",
              }}
            />
            {/* Phosphor vignette — soft center glow + bottom darkening */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 50%, rgba(124,255,176,0.05) 0%, rgba(0,0,0,0) 55%), radial-gradient(140% 100% at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 60%)",
              }}
            />
            {/* Edge vignette — gentle corner darkening for tube curvature feel */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow:
                  "inset 0 0 60px rgba(0,0,0,0.45), inset 0 0 140px rgba(0,0,0,0.35)",
              }}
            />
            {/* Subtle screen glare */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%)",
              }}
            />

            {/* Terminal content */}
            <div
              className="relative h-full w-full px-4 sm:px-7 md:px-10 py-5 sm:py-7 md:py-8 flex flex-col text-left"
              style={{
                fontFamily:
                  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                color: PHOSPHOR,
                fontSize: "clamp(12px, 1.45vw, 15px)",
                lineHeight: 1.55,
                textShadow: `0 0 1px ${PHOSPHOR_GLOW}, 0 0 8px ${PHOSPHOR_GLOW}`,
                letterSpacing: "0.02em",
              }}
            >
              {/* Persistent top-left product label — same hardware, every state */}
              <div
                style={{
                  fontFamily:
                    "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                  color: PHOSPHOR_DIM,
                  fontSize: "0.78em",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "1.1em",
                  textShadow: `0 0 4px ${PHOSPHOR_GLOW}`,
                }}
              >
                Accounting Study Tools{" "}
                <span style={{ opacity: 0.7 }}>(Spring '26 Beta)</span>
              </div>

              {/* Headline — only when we have a personalized welcome; otherwise the section heading above the screen carries the title */}
              {welcomeName && (
                <div
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontWeight: 400,
                    fontSize: "clamp(20px, 3vw, 30px)",
                    lineHeight: 1.15,
                    letterSpacing: "0.005em",
                    color: "#EAFFF2",
                    textShadow: `0 0 2px ${PHOSPHOR_GLOW}, 0 0 14px ${PHOSPHOR_GLOW}`,
                    marginBottom: "1.1em",
                  }}
                >
                  {isReturning ? "Welcome back, " : "Welcome, "}
                  <span style={{ color: PHOSPHOR }}>{welcomeName}</span>
                  <span style={{ color: PHOSPHOR_DIM }}>.</span>
                </div>
              )}

              {/* Optional short beta note (dashboard only) */}
              {dashboardMode && betaNote && (
                <div
                  style={{
                    color: PHOSPHOR_DIM,
                    fontFamily:
                      "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                    fontSize: "0.82em",
                    lineHeight: 1.55,
                    marginBottom: "1.1em",
                    opacity: 0.85,
                    maxWidth: 520,
                  }}
                >
                  {betaNote}
                </div>
              )}

              {/* Course / Campus context — dashboard mode renders simple read-only
                  terminal lines; landing keeps the original course dropdown. */}
              {dashboardMode ? (
                <div className="mb-3 sm:mb-3.5" style={{ lineHeight: 1.7 }}>
                  <div
                    style={{
                      color: PHOSPHOR_DIM,
                      fontFamily:
                        "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                      fontSize: "0.95em",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {">"} Course:{" "}
                    <span style={{ color: "#E8FFF1" }}>
                      {courseLabel || "Not specified"}
                    </span>
                  </div>
                  <div
                    style={{
                      color: PHOSPHOR_DIM,
                      fontFamily:
                        "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                      fontSize: "0.95em",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {">"} Campus:{" "}
                    <span style={{ color: "#E8FFF1" }}>
                      {campusLabel || "Not specified"}
                    </span>
                  </div>
                </div>
              ) : courseSelector ? (
                <div className="mb-3 sm:mb-3.5">
                  <div
                    style={{
                      color: PHOSPHOR_DIM,
                      fontSize: "0.92em",
                      marginBottom: 4,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {">"} Choose Course
                  </div>
                  <div style={{ maxWidth: 360 }}>{courseSelector}</div>
                </div>
              ) : courseLabel ? (
                <div className="mb-3 sm:mb-3.5">
                  <div
                    style={{
                      color: PHOSPHOR_DIM,
                      fontSize: "0.92em",
                      marginBottom: 4,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {">"} Course
                  </div>
                  <div
                    className="w-full rounded-[4px] px-2 py-1 text-[12.5px] flex items-center justify-between"
                    style={{
                      maxWidth: 360,
                      background: "rgba(8,28,16,0.55)",
                      border: `1px solid ${PHOSPHOR_MUTED}`,
                      color: "#E8FFF1",
                      fontFamily:
                        "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                    }}
                  >
                    <span className="truncate">{courseLabel}</span>
                    <Lock className="h-3 w-3 ml-2 shrink-0" style={{ color: PHOSPHOR_MUTED }} />
                  </div>
                </div>
              ) : null}


              {/* Chapter picker — disabled until course chosen */}
              <div className="mb-1">
                <div
                  style={{
                    color: courseLabel ? PHOSPHOR_DIM : PHOSPHOR_MUTED,
                    fontSize: "0.92em",
                    marginBottom: 4,
                    letterSpacing: "0.02em",
                    transition: "color 240ms ease-out",
                  }}
                >
                  {">"} {dashboardMode ? "Choose Textbook Chapter" : "Choose Chapter"}
                </div>
                <div style={{ maxWidth: 360, opacity: courseLabel ? 1 : 0.5 }}>
                  {chapterSelector ?? (
                    <div
                      className="w-full rounded-[4px] px-2 py-1 text-[12.5px] flex items-center justify-between"
                      style={{
                        background: "rgba(8,28,16,0.4)",
                        border: `1px solid ${PHOSPHOR_MUTED}`,
                        color: PHOSPHOR_MUTED,
                        fontFamily:
                          "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                      }}
                    >
                      <span>Choose course first…</span>
                      <Lock className="h-3 w-3 ml-2 shrink-0" />
                    </div>
                  )}
                </div>
                {/* Inline error — appears only after a chapter-required action */}
                {chapterError && !canPickTool && (
                  <div
                    role="alert"
                    className="mt-2"
                    style={{
                      color: "#FFB86B",
                      fontSize: 11,
                      letterSpacing: "0.03em",
                      fontFamily:
                        "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
                    }}
                  >
                    {">"} {dashboardMode ? "Choose a textbook chapter first." : "Please choose a chapter first."}
                  </div>
                )}
              </div>


              {/* Tool grid — always visible. Buttons mute until course + chapter chosen. */}
              {tools && tools.length > 0 && (
                <div
                  key={`toolgrid-${activeToolKey ?? "idle"}-${canPickTool ? "ready" : "wait"}`}
                  className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 sa-toolgrid-reveal"
                >
                  {tools.map((tool) => {
                    const isActive = activeToolKey === tool.key;
                    const isDisabled = !!tool.disabled;
                    const locked = !canPickTool || loading;
                    const interactable = canPickTool && !isDisabled && !loading;
                    const Icon = tool.icon;
                    const isGhost = tool.variant === "ghost";

                    const idleBg = isGhost
                      ? "transparent"
                      : "linear-gradient(180deg, rgba(8,28,16,0.92) 0%, rgba(4,16,9,0.96) 100%)";
                    const hoverBg = isGhost
                      ? "rgba(124,255,176,0.04)"
                      : "linear-gradient(180deg, rgba(14,46,26,0.95) 0%, rgba(6,22,13,0.98) 100%)";
                    const activeBg = isGhost
                      ? "rgba(124,255,176,0.06)"
                      : "linear-gradient(180deg, rgba(20,60,36,0.95) 0%, rgba(8,28,16,0.98) 100%)";

                    const idleBorder = isGhost
                      ? "rgba(124,255,176,0.18)"
                      : locked
                      ? "rgba(124,255,176,0.10)"
                      : "rgba(124,255,176,0.22)";
                    const hoverBorder = isGhost
                      ? "rgba(124,255,176,0.40)"
                      : "rgba(124,255,176,0.55)";
                    const activeBorder = isGhost
                      ? "rgba(124,255,176,0.55)"
                      : "rgba(124,255,176,0.75)";
                    const borderStyle = isGhost ? "dashed" : "solid";

                    const idleShadow = isGhost
                      ? "none"
                      : "inset 0 1px 0 rgba(180,255,210,0.06), inset 0 -1px 0 rgba(0,0,0,0.55), 0 4px 10px rgba(0,0,0,0.45)";
                    const hoverShadow = isGhost
                      ? "0 0 14px rgba(124,255,176,0.10)"
                      : "inset 0 1px 0 rgba(180,255,210,0.10), 0 0 0 1px rgba(124,255,176,0.30), 0 6px 16px rgba(0,0,0,0.55), 0 0 22px rgba(124,255,176,0.18)";
                    const activeShadow = isGhost
                      ? "0 0 18px rgba(124,255,176,0.15)"
                      : "inset 0 0 0 1px rgba(124,255,176,0.55), 0 0 28px rgba(124,255,176,0.30), 0 6px 16px rgba(0,0,0,0.55)";

                    return (
                      <button
                        key={tool.key}
                        type="button"
                        onClick={() => {
                          if (isDisabled) return;
                          if (!canPickTool) {
                            nudgeChapter();
                            return;
                          }
                          triggerToolPulse(tool.key);
                          onSelectTool?.(tool.key);
                        }}
                        disabled={isDisabled}
                        aria-label={`Choose ${tool.label}`}
                        aria-disabled={locked}
                        className={`group relative text-left rounded-md transition-all ${flashedToolKey === tool.key ? "sa-row-flash" : ""}`}
                        style={{
                          padding: "12px 12px 10px",
                          background: isActive ? activeBg : idleBg,
                          border: `1px ${borderStyle} ${isActive ? activeBorder : idleBorder}`,
                          boxShadow: isActive ? activeShadow : idleShadow,
                          color: PHOSPHOR,
                          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                          cursor: interactable
                            ? "pointer"
                            : isDisabled
                            ? "not-allowed"
                            : locked
                            ? "not-allowed"
                            : "wait",
                          opacity: isDisabled ? 0.45 : locked ? 0.78 : isGhost ? 0.72 : 1,
                          transform: isActive ? "translateY(1px)" : "translateY(0)",
                          transition:
                            "background 160ms ease-out, border-color 160ms ease-out, box-shadow 200ms ease-out, transform 120ms ease-out, opacity 200ms ease-out",
                          minHeight: 122,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                        onMouseEnter={(e) => {
                          if (!interactable) return;
                          const el = e.currentTarget;
                          el.style.background = hoverBg;
                          el.style.borderColor = hoverBorder;
                          el.style.boxShadow = hoverShadow;
                          el.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          if (isActive) return;
                          const el = e.currentTarget;
                          el.style.background = idleBg;
                          el.style.borderColor = idleBorder;
                          el.style.boxShadow = idleShadow;
                          el.style.transform = "translateY(0)";
                        }}
                      >
                        {/* Header row: icon + lock indicator */}
                        <div className="flex items-center justify-between">
                          {Icon ? (
                            <Icon
                              size={16}
                              strokeWidth={1.75}
                              aria-hidden
                              style={{
                                color: locked ? PHOSPHOR_MUTED : PHOSPHOR,
                                filter: locked
                                  ? "none"
                                  : `drop-shadow(0 0 4px ${PHOSPHOR_GLOW})`,
                              }}
                            />
                          ) : (
                            <span aria-hidden style={{ width: 16, height: 16 }} />
                          )}
                          {/* lock icon removed — cards stay inviting; inline error guides instead */}
                        </div>

                        {/* Title */}
                        <div
                          style={{
                            color: locked ? PHOSPHOR_DIM : PHOSPHOR,
                            fontSize: 12.5,
                            fontWeight: 700,
                            lineHeight: 1.25,
                            letterSpacing: "0.01em",
                            textShadow: locked ? "none" : `0 0 6px ${PHOSPHOR_GLOW}`,
                          }}
                        >
                          {tool.label}
                        </div>

                        {/* Description */}
                        {tool.description && (
                          <div
                            style={{
                              color: PHOSPHOR_MUTED,
                              fontSize: 10,
                              lineHeight: 1.45,
                              fontFamily:
                                "'JetBrains Mono', 'IBM Plex Mono', monospace",
                            }}
                          >
                            {tool.description}
                          </div>
                        )}

                        {/* Action cue */}
                        <div
                          className="mt-auto flex items-center gap-1.5"
                          style={{
                            paddingTop: 6,
                            borderTop: `1px dashed ${locked ? "rgba(124,255,176,0.10)" : "rgba(124,255,176,0.22)"}`,
                            color: locked ? PHOSPHOR_MUTED : PHOSPHOR_DIM,
                            fontSize: 10.5,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          <span>{tool.cta || "Open"}</span>
                          <span
                            aria-hidden
                            className="transition-transform"
                            style={{
                              color: locked ? PHOSPHOR_MUTED : PHOSPHOR,
                              textShadow: locked ? "none" : `0 0 6px ${PHOSPHOR_GLOW}`,
                            }}
                          >
                            ▸
                          </span>
                          {tool.hint && (
                            <span
                              className="ml-auto"
                              style={{
                                color: PHOSPHOR_MUTED,
                                textTransform: "none",
                                letterSpacing: 0,
                                fontSize: 10,
                              }}
                            >
                              {tool.hint}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Secondary "more tools coming" section — visually lighter than the primary tools above */}
              {(comingSoonIdeas?.length || onShareFeedback) && (
                <div
                  className="mt-5 rounded-md"
                  style={{
                    padding: "10px 12px 12px",
                    border: `1px dashed rgba(124,255,176,0.22)`,
                    background: "transparent",
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                  }}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                      <div
                        style={{
                          color: PHOSPHOR_DIM,
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                        }}
                      >
                        {">"} More study tools are coming
                      </div>
                      <div
                        style={{
                          color: PHOSPHOR_MUTED,
                          fontSize: 10,
                          lineHeight: 1.5,
                        }}
                      >
                        Help shape what we build next.
                      </div>
                    </div>
                    {onShareFeedback && (
                      <button
                        type="button"
                        onClick={onShareFeedback}
                        className="transition-colors"
                        style={{
                          color: PHOSPHOR,
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          padding: "6px 10px",
                          borderRadius: 4,
                          border: `1px solid rgba(124,255,176,0.35)`,
                          background: "rgba(124,255,176,0.06)",
                          textShadow: `0 0 6px ${PHOSPHOR_GLOW}`,
                          cursor: "pointer",
                          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(124,255,176,0.12)";
                          e.currentTarget.style.borderColor = "rgba(124,255,176,0.6)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(124,255,176,0.06)";
                          e.currentTarget.style.borderColor = "rgba(124,255,176,0.35)";
                        }}
                      >
                        Share Feedback ▸
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>

        {/* Laptop base */}
        <div
          className="relative mx-auto rounded-b-[14px]"
          style={{
            height: 14,
            width: "104%",
            marginLeft: "-2%",
            background:
              "linear-gradient(180deg, #1F1F23 0%, #0E0E11 100%)",
            border: "1px solid #2A2A30",
            borderTop: "none",
            boxShadow: "0 18px 30px -12px rgba(0,0,0,0.5)",
          }}
        >
          {/* Hinge notch */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 top-0 rounded-b-md"
            style={{
              width: 90,
              height: 6,
              background:
                "linear-gradient(180deg, #0A0A0C 0%, #1A1A1E 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Line({
  show,
  children,
  flashKey,
}: {
  show: boolean;
  children: React.ReactNode;
  flashKey?: string | number;
}) {
  const flashing = flashKey !== undefined && flashKey !== "" && flashKey !== 0;
  return (
    <div
      className={`relative whitespace-pre-wrap ${flashing ? "sa-line-flash" : ""}`}
      key={flashing ? `flash-${flashKey}` : undefined}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(2px)",
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
        minHeight: "1.7em",
        // Negative margin + padding so the highlight bleeds slightly past the
        // text without shifting layout.
        marginLeft: "-0.4em",
        marginRight: "-0.4em",
        paddingLeft: "0.4em",
        paddingRight: "0.4em",
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
}

function ChangeLink({ onClick, label = "change" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 sm:ml-3 align-middle inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-all focus:outline-none focus-visible:ring-1"
      style={{
        background: "transparent",
        border: `1px dashed ${PHOSPHOR_MUTED}`,
        color: PHOSPHOR_DIM,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
        fontSize: "0.72em",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textShadow: `0 0 4px ${PHOSPHOR_GLOW}`,
        cursor: "pointer",
        opacity: 0.85,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.color = PHOSPHOR;
        el.style.borderColor = PHOSPHOR_DIM;
        el.style.opacity = "1";
        el.style.boxShadow = `0 0 10px ${PHOSPHOR_GLOW}`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.color = PHOSPHOR_DIM;
        el.style.borderColor = PHOSPHOR_MUTED;
        el.style.opacity = "0.85";
        el.style.boxShadow = "none";
      }}
    >
      <span aria-hidden style={{ color: PHOSPHOR_MUTED }}>[</span>
      {label}
      <span aria-hidden style={{ color: PHOSPHOR_MUTED }}>]</span>
    </button>
  );
}

/**
 * Quick terminal-style "type-in" of a label whenever it changes.
 * Returns the currently visible substring, a typing flag (drives the inline
 * cursor), and a pulseKey that bumps on each new value (drives the glow pulse).
 * Skips animation on first mount so the initial reveal stays calm.
 */
function useTerminalValue(value: string | null) {
  const safe = (value ?? "").trim();
  const [text, setText] = useState(safe);
  const [typing, setTyping] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    // First mount: snap, no animation.
    if (prevRef.current === null) {
      prevRef.current = safe;
      setText(safe);
      return;
    }
    if (prevRef.current === safe) return;
    prevRef.current = safe;

    // No value yet → just clear, no typing effect.
    if (!safe) {
      setText("");
      setTyping(false);
      return;
    }

    // Type the new value in quickly, then pulse.
    setTyping(true);
    setText("");
    const total = safe.length;
    // Cap total animation around ~280ms regardless of length
    const perChar = Math.max(8, Math.min(22, Math.floor(280 / Math.max(total, 1))));
    const timers: number[] = [];
    for (let i = 1; i <= total; i++) {
      timers.push(window.setTimeout(() => setText(safe.slice(0, i)), i * perChar));
    }
    timers.push(
      window.setTimeout(() => {
        setTyping(false);
        setPulseKey((k) => k + 1);
      }, total * perChar + 40),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [safe]);

  return { text, typing, pulseKey };
}
