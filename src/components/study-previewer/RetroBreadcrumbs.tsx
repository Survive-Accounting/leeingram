import React from "react";
import { Link } from "react-router-dom";

const PHOSPHOR = "#39FF7A";
const PHOSPHOR_DIM = "rgba(57,255,122,0.55)";
const PHOSPHOR_FAINT = "rgba(57,255,122,0.35)";
const TERMINAL_BG = "rgba(8,16,28,0.85)";
const TERMINAL_BORDER = "rgba(57,255,122,0.18)";

const MONO = `"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, Menlo, Consolas, monospace`;

export type BreadcrumbCrumb = {
  label: string;
  to?: string; // route link → renders <Link>
  onClick?: () => void; // in-page action → renders <button>
};

interface RetroBreadcrumbsProps {
  crumbs: BreadcrumbCrumb[];
  /** Optional content rendered on the right side of the bar (e.g. view switcher trigger). */
  rightSlot?: React.ReactNode;
}

/**
 * Retro-terminal styled breadcrumbs used across student-facing study tools.
 * Sits between the page header and the main content. Mobile-safe: truncates
 * the middle crumb on narrow screens, never wraps.
 */
export function RetroBreadcrumbs({ crumbs, rightSlot }: RetroBreadcrumbsProps) {
  return (
    <div
      className="w-full"
      style={{
        background: TERMINAL_BG,
        borderBottom: `1px solid ${TERMINAL_BORDER}`,
        boxShadow: "0 1px 0 rgba(57,255,122,0.04) inset",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 min-w-0 overflow-hidden">
        <span
          aria-hidden="true"
          className="shrink-0 select-none"
          style={{ color: PHOSPHOR_FAINT, fontFamily: MONO, fontSize: 12 }}
        >
          &gt;
        </span>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 min-w-0 overflow-hidden"
          style={{ fontFamily: MONO, fontSize: 12 }}
        >
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const isMiddle = !isLast && i > 0;
            const middleClass = isMiddle ? "truncate min-w-0 max-w-[40vw] sm:max-w-none" : "";
            const lastClass = isLast ? "max-w-[55vw] sm:max-w-none" : "";
            const interactive = !isLast && (c.to || c.onClick);
            const enter = (e: React.MouseEvent<HTMLElement>) =>
              (e.currentTarget.style.color = PHOSPHOR);
            const leave = (e: React.MouseEvent<HTMLElement>) =>
              (e.currentTarget.style.color = PHOSPHOR_DIM);
            return (
              <div key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
                {interactive && c.to ? (
                  <Link
                    to={c.to}
                    className={`hover:underline transition-colors shrink-0 ${middleClass}`}
                    style={{ color: PHOSPHOR_DIM, textDecorationColor: PHOSPHOR_FAINT }}
                    onMouseEnter={enter}
                    onMouseLeave={leave}
                  >
                    {c.label.toLowerCase()}
                  </Link>
                ) : interactive && c.onClick ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className={`hover:underline transition-colors shrink-0 cursor-pointer bg-transparent p-0 border-0 ${middleClass}`}
                    style={{ color: PHOSPHOR_DIM, fontFamily: "inherit", fontSize: "inherit" }}
                    onMouseEnter={enter}
                    onMouseLeave={leave}
                  >
                    {c.label.toLowerCase()}
                  </button>
                ) : (
                  <span
                    className={`truncate min-w-0 ${lastClass}`}
                    style={{ color: isLast ? PHOSPHOR : PHOSPHOR_DIM }}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {c.label.toLowerCase()}
                  </span>
                )}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="shrink-0 select-none"
                    style={{ color: PHOSPHOR_FAINT }}
                  >
                    /
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default RetroBreadcrumbs;
