import { useEffect, useState } from "react";

const PHOSPHOR = "#7CFFB0";
const PHOSPHOR_DIM = "rgba(124,255,176,0.55)";
const PHOSPHOR_GLOW = "rgba(124,255,176,0.45)";

interface RetroTerminalFrameProps {
  courseLabel: string | null;
  chapterLabel: string | null;
}

/**
 * A subtle retro CRT-in-a-laptop entry state. Shown only before the user
 * picks a study tool. Once a tool is selected the parent swaps this out
 * for the real workspace.
 */
export default function RetroTerminalFrame({
  courseLabel,
  chapterLabel,
}: RetroTerminalFrameProps) {
  const [bootStep, setBootStep] = useState(0);

  // Sequential reveal of the boot lines for a tasteful "entering the system" feel.
  useEffect(() => {
    setBootStep(0);
    const timers: number[] = [];
    const steps = [220, 480, 740, 980, 1220];
    steps.forEach((delay, i) => {
      timers.push(window.setTimeout(() => setBootStep(i + 1), delay));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [courseLabel, chapterLabel]);

  const safeCourse = courseLabel?.trim() || "—";
  const safeChapter = chapterLabel?.trim() || "—";

  return (
    <div className="w-full flex justify-center px-2 sm:px-6 py-8 sm:py-12 animate-fade-in">
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
      `}</style>

      <div className="w-full" style={{ maxWidth: 880 }}>
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
              aspectRatio: "16 / 10",
              animation: "sa-crt-flicker 6s ease-in-out infinite",
            }}
          >
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
                fontSize: "clamp(11px, 1.4vw, 15px)",
                lineHeight: 1.7,
                textShadow: `0 0 1px ${PHOSPHOR_GLOW}, 0 0 8px ${PHOSPHOR_GLOW}`,
                letterSpacing: "0.02em",
              }}
            >
              {/* Header chrome */}
              <div
                className="flex items-center justify-between mb-4 sm:mb-6 pb-2"
                style={{
                  borderBottom: `1px dashed ${PHOSPHOR_DIM}`,
                  opacity: 0.85,
                }}
              >
                <span style={{ fontSize: "0.85em" }}>SA-TERM 80x24</span>
                <span style={{ fontSize: "0.85em", color: PHOSPHOR_DIM }}>
                  READY
                </span>
              </div>

              <Line show={bootStep >= 1}>
                {">"} Survive Accounting Beta v1.0
              </Line>
              <Line show={bootStep >= 2}>
                {">"} Course selected:{" "}
                <span style={{ color: "#E8FFF1" }}>{safeCourse}</span>
              </Line>
              <Line show={bootStep >= 3}>
                {">"} Chapter selected:{" "}
                <span style={{ color: "#E8FFF1" }}>{safeChapter}</span>
              </Line>
              <Line show={bootStep >= 4}>{">"}</Line>
              <Line show={bootStep >= 5}>
                {">"} Pick a tool to start studying
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
