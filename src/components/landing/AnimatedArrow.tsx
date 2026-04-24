/**
 * Stripe-style animated arrow.
 * Default: shows ›  (chevron only, ~10px wide)
 * Hover (parent with class "group" hovered): expands to → with stem sliding in from left.
 *
 * Usage:
 *   <button className="group ...">
 *     Get Started <AnimatedArrow />
 *   </button>
 */
export default function AnimatedArrow() {
  return (
    <>
      <style>{`
        .sa-arrow {
          position: relative;
          display: inline-block;
          width: 10px;
          height: 1em;
          margin-left: 6px;
          vertical-align: middle;
          transition: width 200ms ease-out;
        }
        .sa-arrow__stem {
          position: absolute;
          left: 0;
          top: 50%;
          height: 1.5px;
          width: 0;
          background: currentColor;
          transform: translateY(-50%);
          opacity: 0;
          transition: width 200ms ease-out, opacity 200ms ease-out;
          border-radius: 2px;
        }
        .sa-arrow__head {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-55%);
          font-size: 1em;
          font-weight: 400;
          line-height: 1;
        }
        .group:hover .sa-arrow,
        .group:focus-visible .sa-arrow {
          width: 22px;
        }
        .group:hover .sa-arrow__stem,
        .group:focus-visible .sa-arrow__stem {
          width: 14px;
          opacity: 1;
        }
      `}</style>
      <span className="sa-arrow" aria-hidden="true">
        <span className="sa-arrow__stem" />
        <span className="sa-arrow__head">›</span>
      </span>
    </>
  );
}
