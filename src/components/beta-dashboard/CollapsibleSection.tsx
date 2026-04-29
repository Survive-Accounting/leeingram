import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const NAVY = "#14213D";

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** Optional small label rendered on the right side of the header (e.g., counts). */
  rightLabel?: ReactNode;
  children: ReactNode;
}

/**
 * Lightweight collapsible wrapper for beta dashboard sections.
 * Lazy-renders children only when opened so heavy sections don't fetch
 * data or run AI calls until Lee actually opens them.
 */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  rightLabel,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 min-w-0">
            {open ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: NAVY }} />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: NAVY }} />
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: NAVY }}>
                {title}
              </div>
              {subtitle && (
                <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
              )}
            </div>
          </div>
          {rightLabel && (
            <div className="text-[11px] text-muted-foreground flex-shrink-0">{rightLabel}</div>
          )}
        </button>
        {open && (
          <div className="px-5 pb-5 pt-1 border-t">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
