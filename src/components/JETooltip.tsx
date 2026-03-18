import { useState, useRef, useEffect } from "react";
import { HelpCircle, X } from "lucide-react";

interface JETooltipProps {
  text: string;
  /** Optional: themed for SolutionsViewer (inline styles) vs admin (tailwind) */
  variant?: "solutions" | "admin";
}

export function JETooltip({ text, variant = "admin" }: JETooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const isSolutions = variant === "solutions";

  return (
    <span className="relative inline-flex items-center ml-1" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        onMouseEnter={() => setOpen(true)}
        className="inline-flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity"
        aria-label="More info"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-[260px]"
          style={isSolutions ? {
            background: "#FFFFFF",
            border: "1px solid #E0E0E0",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "10px 12px",
          } : undefined}
          {...(!isSolutions ? { className: "absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-[260px] bg-popover border border-border rounded-lg shadow-lg p-2.5" } : {})}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-[12px] leading-[1.5] flex-1"
              style={isSolutions ? { color: "#1A1A1A" } : undefined}
            >
              {text}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="shrink-0 mt-0.5 opacity-50 hover:opacity-100"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: isSolutions ? "6px solid #FFFFFF" : "6px solid hsl(var(--popover))",
            }}
          />
        </div>
      )}
    </span>
  );
}
