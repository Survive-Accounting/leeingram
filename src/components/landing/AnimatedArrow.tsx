/**
 * Stripe-style animated arrow.
 * Default: shows ›  (chevron only, ~10px wide)
 * Hover (parent .group:hover): expands to → (full arrow, stem fades in from left)
 *
 * Usage:
 *   <button className="group ...">
 *     Get Started <AnimatedArrow />
 *   </button>
 */
export default function AnimatedArrow({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex items-center ml-1 ${className}`}
      style={{ width: 10, height: "1em", transition: "width 200ms ease-out" }}
    >
      <span
        className="animated-arrow-inner"
        style={{
          position: "relative",
          display: "inline-block",
          width: "100%",
          height: "100%",
          lineHeight: 1,
        }}
      >
        {/* Stem — hidden by default, slides in from left on hover */}
        <span
          className="animated-arrow-stem"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            height: "1.5px",
            width: 0,
            background: "currentColor",
            transform: "translateY(-50%)",
            opacity: 0,
            transition: "width 200ms ease-out, opacity 200ms ease-out",
          }}
        />
        {/* Arrow head ›  — always visible, sits at right edge */}
        <span
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.9em",
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          ›
        </span>
      </span>
      <style>{`
        .group:hover > .animated-arrow-inner > .animated-arrow-stem,
        .group:focus-visible > .animated-arrow-inner > .animated-arrow-stem {
          width: 12px;
          opacity: 1;
        }
      `}</style>
    </span>
  );
}
