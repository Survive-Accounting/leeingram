/**
 * FormulaCard — Interactive formula display card with component tooltips.
 * Used in admin chapter-qa, cram modal, and solutions viewer.
 */
import { useMemo, Fragment } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export type FormulaComponent = {
  symbol: string;
  tooltip: string;
};

export type FormulaCardData = {
  id: string;
  formula_name: string;
  formula_expression: string;
  formula_explanation?: string | null;
  components?: FormulaComponent[] | null;
};

type FormulaCardProps = {
  formula: FormulaCardData;
  className?: string;
};

// Operators and structural characters that should be muted
const OPERATORS = new Set(["+", "−", "–", "-", "×", "÷", "/", "=", "^", "(", ")", ",", "·"]);

function isOperatorChar(ch: string): boolean {
  return OPERATORS.has(ch);
}

/**
 * Parse formula_expression and wrap component symbols with tooltip triggers.
 * Falls back to plain text if no components provided.
 */
function renderExpression(expression: string, components?: FormulaComponent[] | null) {
  if (!components || components.length === 0) {
    return (
      <span style={{ color: "#CE1126", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 20, fontWeight: 500 }}>
        {expression}
      </span>
    );
  }

  // Sort components by symbol length descending to match longer symbols first
  const sorted = [...components].sort((a, b) => b.symbol.length - a.symbol.length);

  // Build a regex that matches any component symbol as a whole word
  const escaped = sorted.map(c => c.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");

  // Split expression by component symbols
  const parts = expression.split(pattern);

  const symbolMap = new Map(sorted.map(c => [c.symbol, c.tooltip]));

  return (
    <TooltipProvider delayDuration={100}>
      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 20, fontWeight: 500 }}>
        {parts.map((part, i) => {
          const tooltip = symbolMap.get(part);
          if (tooltip) {
            // This is a component symbol — render with tooltip
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 cursor-help" style={{ color: "white", fontWeight: 700 }}>
                    {part}
                    <Info className="inline-block shrink-0" style={{ width: 11, height: 11, color: "rgba(255,255,255,0.45)", verticalAlign: "super", marginTop: -4 }} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                  className="z-[9999]"
                  style={{
                    background: "#14213D",
                    color: "white",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    lineHeight: 1.5,
                    maxWidth: 260,
                    borderRadius: 6,
                    padding: "10px 12px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{part}</span> — {tooltip}
                </TooltipContent>
              </Tooltip>
            );
          }

          // Non-symbol text — render operators muted, other chars as-is
          return (
            <Fragment key={i}>
              {[...part].map((ch, j) => {
                if (isOperatorChar(ch)) {
                  return <span key={j} style={{ color: "rgba(255,255,255,0.5)" }}>{ch}</span>;
                }
                return <span key={j} style={{ color: "rgba(255,255,255,0.5)" }}>{ch}</span>;
              })}
            </Fragment>
          );
        })}
      </span>
    </TooltipProvider>
  );
}

export function FormulaCard({ formula, className = "" }: FormulaCardProps) {
  const components = useMemo(() => {
    if (!formula.components) return null;
    if (Array.isArray(formula.components) && formula.components.length > 0) return formula.components as FormulaComponent[];
    return null;
  }, [formula.components]);

  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background: "#14213D",
        padding: "24px 32px",
      }}
    >
      {/* Formula name */}
      <p
        className="text-center"
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 18,
          color: "white",
          marginBottom: 16,
          fontWeight: 400,
        }}
      >
        {formula.formula_name}
      </p>

      {/* Expression with component tooltips */}
      <div className="text-center" style={{ marginBottom: 16 }}>
        {renderExpression(formula.formula_expression, components)}
      </div>

      {/* Explanation */}
      {formula.formula_explanation && (
        <p
          className="text-center mx-auto"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            fontStyle: "italic",
            maxWidth: 520,
            lineHeight: 1.6,
          }}
        >
          {formula.formula_explanation}
        </p>
      )}
    </div>
  );
}

export default FormulaCard;
