import React from "react";

const PHOSPHOR = "#7CFFB0";
const PHOSPHOR_DIM = "rgba(124,255,176,0.55)";
const PHOSPHOR_GLOW = "rgba(124,255,176,0.45)";
const PHOSPHOR_FAINT = "rgba(124,255,176,0.18)";
const CRT_BG =
  "radial-gradient(120% 80% at 50% 30%, #052810 0%, #03130A 60%, #010904 100%)";
const MONO =
  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

interface BrandedLoaderProps {
  /** Optional contextual sub-line below the credit, e.g. "Loading problem…". */
  subtitle?: string;
  /** Kept for API compat; both surfaces now render the same CRT look so the
   *  loader visually continues the retro screen until the tool itself paints. */
  surface?: "navy" | "white";
  /** Absolute fill the parent container vs. simply centering in flow. Defaults to true. */
  absolute?: boolean;
}

/**
 * Branded loader styled to look like the same retro CRT screen used in the
 * study previewer. Centers Lee's circular headshot with a phosphor spinner
 * orbiting it, "Built by Lee Ingram" credit underneath, and an optional
 * monospace subtitle. No "Survive Accounting" wordmark — color-saturated UI
 * (navy/red) only appears once the underlying tool paints.
 */
export function BrandedLoader({
  subtitle,
  // surface is intentionally accepted for API compat but not used — both
  // surfaces render the same CRT look now.
  surface: _surface = "navy",
  absolute = true,
}: BrandedLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={subtitle ? subtitle : "Loading"}
      className={`${absolute ? "absolute inset-0" : "w-full"} relative flex flex-col items-center justify-center text-center px-6 z-0 overflow-hidden sa-branded-loader`}
      style={{
        background: CRT_BG,
        animation: "sa-loader-fade 200ms ease-out both",
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
      {/* Aperture grille */}
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
      {/* Edge vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            "inset 0 0 60px rgba(0,0,0,0.45), inset 0 0 140px rgba(0,0,0,0.35)",
        }}
      />

      {/* Phosphor spinner */}
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0 }}
        >
          <circle cx="36" cy="36" r="30" stroke={PHOSPHOR_FAINT} strokeWidth="1.5" />
          <circle
            cx="36"
            cy="36"
            r="30"
            stroke={PHOSPHOR}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="50 160"
            style={{
              transformOrigin: "36px 36px",
              animation: "sa-loader-spin 1.6s linear infinite",
              filter: `drop-shadow(0 0 6px ${PHOSPHOR_GLOW})`,
            }}
          />
        </svg>
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 12,
            fontFamily: MONO,
            fontSize: 11,
            color: "rgba(124,255,176,0.45)",
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
