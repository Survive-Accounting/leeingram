import { useEffect, useRef, useState } from "react";

const PHOSPHOR = "#7CFFB0";
const PHOSPHOR_DIM = "rgba(124,255,176,0.55)";
const PHOSPHOR_GLOW = "rgba(124,255,176,0.45)";
const PHOSPHOR_MUTED = "rgba(124,255,176,0.35)";

export interface TerminalTool {
  key: string;
  label: string;
  /** Optional small caption shown after the label, e.g. "(coming soon)" */
  hint?: string;
  disabled?: boolean;
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
}: RetroTerminalFrameProps) {
  const [bootStep, setBootStep] = useState(0);

  // Type-in + pulse state for the two reactive lines
  const courseTyped = useTerminalValue(courseLabel);
  const chapterTyped = useTerminalValue(chapterLabel);

  // CRT pulse: one quick brighten when either value changes (skips the very first mount)
  const [crtPulseKey, setCrtPulseKey] = useState(0);
  const firstPulseRef = useRef(true);
  useEffect(() => {
    if (firstPulseRef.current) { firstPulseRef.current = false; return; }
    setCrtPulseKey((k) => k + 1);
  }, [courseLabel, chapterLabel]);

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
        onNudgeChapter?.();
        return;
      }
      onSelectTool(tool.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tools, onSelectTool, canPickTool, onNudgeChapter]);

  const safeCourse = courseLabel?.trim() || "—";
  const safeChapter = chapterLabel?.trim() || "—";

  const promptLabel = !canPickTool
    ? "> Awaiting chapter selection…"
    : loading
    ? "> Loading chapter assets…"
    : "> Select a tool to start studying_";

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
            {/* Scanlines */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
                mixBlendMode: "multiply",
              }}
            />
            {/* Phosphor vignette */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 50%, rgba(124,255,176,0.05) 0%, rgba(0,0,0,0) 55%), radial-gradient(140% 100% at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 60%)",
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
              className="relative h-full w-full px-5 sm:px-8 md:px-12 py-6 sm:py-8 md:py-10 flex flex-col text-left"
              style={{
                fontFamily:
                  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                color: PHOSPHOR,
                fontSize: "clamp(12px, 1.45vw, 15px)",
                lineHeight: 1.7,
                textShadow: `0 0 1px ${PHOSPHOR_GLOW}, 0 0 8px ${PHOSPHOR_GLOW}`,
                letterSpacing: "0.02em",
              }}
            >
              {/* Header chrome — branded logo + readiness status */}
              <div
                className="flex items-center justify-between mb-4 sm:mb-6 pb-2 gap-3"
                style={{
                  borderBottom: `1px dashed ${PHOSPHOR_DIM}`,
                }}
              >
                <img
                  src={LOGO_URL}
                  alt="Survive Accounting"
                  className="h-5 sm:h-6 w-auto object-contain select-none"
                  style={{
                    // Phosphor tint: knock the white logo into the green palette
                    filter:
                      "brightness(0) saturate(100%) invert(92%) sepia(38%) saturate(640%) hue-rotate(76deg) brightness(105%) contrast(101%) drop-shadow(0 0 4px rgba(124,255,176,0.45))",
                    opacity: 0.95,
                  }}
                  draggable={false}
                />
                <span
                  style={{
                    fontSize: "0.78em",
                    color: PHOSPHOR_DIM,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  Ready for Spring '26 finals
                </span>
              </div>

              {welcomeName ? (
                <div
                  style={{
                    opacity: bootStep >= 1 ? 1 : 0,
                    transform: bootStep >= 1 ? "translateY(0)" : "translateY(4px)",
                    transition: "opacity 320ms ease-out, transform 320ms ease-out",
                    marginBottom: "0.6em",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontWeight: 400,
                      fontSize: "clamp(22px, 3.4vw, 34px)",
                      lineHeight: 1.15,
                      letterSpacing: "0.005em",
                      color: "#EAFFF2",
                      textShadow: `0 0 2px ${PHOSPHOR_GLOW}, 0 0 14px ${PHOSPHOR_GLOW}`,
                    }}
                  >
                    {isReturning ? "Welcome back, " : "Welcome, "}
                    <span style={{ color: PHOSPHOR }}>{welcomeName}</span>
                    <span style={{ color: PHOSPHOR_DIM }}>.</span>
                  </div>
                </div>
              ) : (
                <Line show={bootStep >= 1}>
                  {">"} Survive Accounting Beta v1.0
                </Line>
              )}
              <Line show={bootStep >= 2}>
                {">"} Course selected:{" "}
                <span
                  key={`course-${courseTyped.pulseKey}`}
                  className={courseTyped.pulseKey > 0 ? "sa-value-pulse" : undefined}
                  style={{ color: "#E8FFF1" }}
                >
                  {courseTyped.text || safeCourse}
                  {courseTyped.typing && (
                    <span
                      aria-hidden
                      className="inline-block align-[-2px] ml-0.5"
                      style={{
                        width: "0.5em",
                        height: "1em",
                        background: PHOSPHOR,
                        boxShadow: `0 0 6px ${PHOSPHOR_GLOW}`,
                        animation: "sa-cursor-blink 0.6s steps(1) infinite",
                      }}
                    />
                  )}
                </span>
              </Line>
              <Line show={bootStep >= 3}>
                {">"} Chapter selected:{" "}
                <span
                  key={`chapter-${chapterTyped.pulseKey}`}
                  className={chapterTyped.pulseKey > 0 ? "sa-value-pulse" : undefined}
                  style={{ color: "#E8FFF1" }}
                >
                  {chapterTyped.text || safeChapter}
                  {chapterTyped.typing && (
                    <span
                      aria-hidden
                      className="inline-block align-[-2px] ml-0.5"
                      style={{
                        width: "0.5em",
                        height: "1em",
                        background: PHOSPHOR,
                        boxShadow: `0 0 6px ${PHOSPHOR_GLOW}`,
                        animation: "sa-cursor-blink 0.6s steps(1) infinite",
                      }}
                    />
                  )}
                </span>
              </Line>
              <Line show={bootStep >= 4}>{">"}</Line>
              <Line show={bootStep >= 5}>
                <span style={{ color: PHOSPHOR_DIM }}>{promptLabel}</span>
              </Line>

              {/* Tool menu */}
              {tools && tools.length > 0 && (
                <div
                  className="mt-1"
                  style={{
                    opacity: bootStep >= 6 ? 1 : 0,
                    transform: bootStep >= 6 ? "translateY(0)" : "translateY(2px)",
                    transition: "opacity 240ms ease-out, transform 240ms ease-out",
                  }}
                >
                  {tools.map((tool, i) => {
                    const num = i + 1;
                    const isActive = activeToolKey === tool.key;
                    const isDisabled = !!tool.disabled;
                    const interactable = canPickTool && !isDisabled && !loading;
                    return (
                      <button
                        key={tool.key}
                        type="button"
                        onClick={() => {
                          if (isDisabled) return;
                          if (!canPickTool) {
                            onNudgeChapter?.();
                            return;
                          }
                          onSelectTool?.(tool.key);
                        }}
                        className="group block w-full text-left whitespace-pre-wrap px-1 -mx-1 rounded transition-colors"
                        style={{
                          color: isDisabled ? PHOSPHOR_MUTED : PHOSPHOR,
                          cursor: interactable
                            ? "pointer"
                            : isDisabled
                            ? "not-allowed"
                            : "wait",
                          minHeight: "1.7em",
                          background: isActive
                            ? "rgba(124,255,176,0.08)"
                            : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!interactable) return;
                          e.currentTarget.style.background =
                            "rgba(124,255,176,0.10)";
                        }}
                        onMouseLeave={(e) => {
                          if (isActive) return;
                          e.currentTarget.style.background = "transparent";
                        }}
                        disabled={isDisabled}
                        aria-label={`Choose ${tool.label}`}
                      >
                        <span style={{ color: PHOSPHOR_DIM }}>
                          {isActive ? " ▶ " : "   "}
                        </span>
                        <span style={{ color: PHOSPHOR_DIM }}>[{num}]</span>{" "}
                        <span
                          className="group-hover:underline"
                          style={{ textUnderlineOffset: "3px" }}
                        >
                          {tool.label}
                        </span>
                        {tool.hint && (
                          <span
                            style={{
                              color: PHOSPHOR_MUTED,
                              fontSize: "0.85em",
                              marginLeft: "0.5em",
                            }}
                          >
                            {tool.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Prompt cursor at the bottom */}
                  <div
                    className="mt-2"
                    style={{
                      color: PHOSPHOR_DIM,
                      minHeight: "1.7em",
                    }}
                  >
                    {">"}{" "}
                    <span style={{ fontSize: "0.85em" }}>
                      Click a line, or press 1–{tools.length}
                    </span>
                    <span
                      aria-hidden
                      className="inline-block align-[-2px] ml-2"
                      style={{
                        width: "0.55em",
                        height: "1.05em",
                        background: PHOSPHOR,
                        boxShadow: `0 0 6px ${PHOSPHOR_GLOW}`,
                        animation: "sa-cursor-blink 1.05s steps(1) infinite",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* No tools — fall back to a single blinking cursor */}
              {(!tools || tools.length === 0) && (
                <Line show={bootStep >= 6}>
                  {">"}
                  <span
                    aria-hidden
                    className="inline-block align-[-2px] ml-1"
                    style={{
                      width: "0.55em",
                      height: "1.05em",
                      background: PHOSPHOR,
                      boxShadow: `0 0 6px ${PHOSPHOR_GLOW}`,
                      animation: "sa-cursor-blink 1.05s steps(1) infinite",
                    }}
                  />
                </Line>
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

function Line({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className="whitespace-pre-wrap"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(2px)",
        transition: "opacity 220ms ease-out, transform 220ms ease-out",
        minHeight: "1.7em",
      }}
    >
      {children}
    </div>
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
