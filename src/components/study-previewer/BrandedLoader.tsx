import React from "react";

const PHOSPHOR = "#39FF7A";
const PHOSPHOR_FAINT = "rgba(57,255,122,0.18)";
const NAVY = "#0F1A2E";

interface BrandedLoaderProps {
  /** Optional contextual sub-line below the wordmark, e.g. "Loading Entry Builder…". */
  subtitle?: string;
  /** Visual style: "navy" (dark) or "white" (light embed wrappers). Defaults to navy. */
  surface?: "navy" | "white";
  /** Absolute fill the parent container vs. simply centering in flow. Defaults to true. */
  absolute?: boolean;
}

/**
 * Branded loading screen used across the previewer iframes and embedded tools.
 * Centers the Survive Accounting wordmark + "Built by Lee Ingram" credit with
 * a phosphor-green dual-arc spinner that matches the retro terminal aesthetic.
 *
 * Fades in over 200ms so quick loads don't flash.
 */
export function BrandedLoader({
  subtitle,
  surface = "navy",
  absolute = true,
}: BrandedLoaderProps) {
  const isNavy = surface === "navy";
  const bg = isNavy ? NAVY : "#FFFFFF";
  const wordmarkColor = isNavy ? "rgba(255,255,255,0.92)" : "#14213D";
  const creditColor = isNavy ? "rgba(255,255,255,0.45)" : "rgba(20,33,61,0.55)";
  const subtitleColor = isNavy ? "rgba(255,255,255,0.55)" : "rgba(20,33,61,0.6)";
  const spinnerColor = isNavy ? PHOSPHOR : "#CE1126";
  const trackColor = isNavy ? PHOSPHOR_FAINT : "rgba(206,17,38,0.12)";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={subtitle ? `${subtitle}` : "Loading"}
      className={`${absolute ? "absolute inset-0" : "w-full"} flex flex-col items-center justify-center text-center px-6 z-0 sa-branded-loader`}
      style={{
        background: bg,
        animation: "sa-loader-fade 200ms ease-out both",
      }}
    >
      {/* Spinner — two concentric SVG arcs counter-rotating */}
      <div className="relative" style={{ width: 64, height: 64, marginBottom: 18 }}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0 }}
        >
          {/* Track */}
          <circle cx="32" cy="32" r="26" stroke={trackColor} strokeWidth="2" />
          {/* Outer arc — clockwise 1.4s */}
          <circle
            cx="32"
            cy="32"
            r="26"
            stroke={spinnerColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="60 200"
            style={{
              transformOrigin: "32px 32px",
              animation: "sa-loader-spin 1.4s linear infinite",
              filter: isNavy ? `drop-shadow(0 0 6px ${spinnerColor}aa)` : undefined,
            }}
          />
        </svg>
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0 }}
        >
          {/* Inner arc — counter-clockwise 2.2s */}
          <circle
            cx="32"
            cy="32"
            r="18"
            stroke={spinnerColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="28 120"
            opacity="0.7"
            style={{
              transformOrigin: "32px 32px",
              animation: "sa-loader-spin-rev 2.2s linear infinite",
            }}
          />
        </svg>
      </div>

      <div
        style={{
          fontFamily: '"DM Serif Display", Georgia, serif',
          fontSize: 22,
          lineHeight: 1.1,
          color: wordmarkColor,
          letterSpacing: "0.005em",
        }}
      >
        Survive Accounting
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 10.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: creditColor,
          fontWeight: 500,
        }}
      >
        Built by Lee Ingram
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
            fontSize: 11,
            color: subtitleColor,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      <style>{`
        @keyframes sa-loader-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sa-loader-spin-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes sa-loader-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default BrandedLoader;
