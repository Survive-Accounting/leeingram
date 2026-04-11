import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

interface JETooltipProps {
  text: string;
  /** Optional calculation formula to display below the explanation */
  calculationFormula?: string;
  /** Optional dollar amount — only shown if no calculationFormula is provided */
  amount?: number;
  /** Optional: themed for SolutionsViewer (inline styles) vs admin (tailwind) */
  variant?: "solutions" | "admin";
}

export function JETooltip({ text, calculationFormula, amount, variant = "admin" }: JETooltipProps) {
  const isSolutions = variant === "solutions";
  const isMobile = useIsMobile();

  const trigger = (
    <button
      type="button"
      className="inline-flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity ml-1 align-middle"
      style={isMobile ? { minWidth: 32, minHeight: 32 } : undefined}
      aria-label="More info"
      onClick={(e) => e.stopPropagation()}
    >
      <Info className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
    </button>
  );

  const content = (
    <>
      <span>{text}</span>
      {calculationFormula ? (
        <>
          <br />
          <span className="text-[10px] opacity-70 font-mono mt-0.5 inline-block">
            {calculationFormula}
          </span>
        </>
      ) : amount != null ? (
        <>
          <br />
          <span className="text-[10px] opacity-60 font-mono mt-0.5 inline-block">
            = ${amount.toLocaleString("en-US")}
          </span>
        </>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="top"
          className="max-w-[280px] text-sm leading-relaxed z-[100] text-left px-3 py-2"
          style={isSolutions ? { background: "#FFFFFF", color: "#1A1A1A", border: "1px solid #E0E0E0" } : undefined}
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[280px] text-xs leading-relaxed z-[100] text-left"
        style={isSolutions ? { background: "#FFFFFF", color: "#1A1A1A", border: "1px solid #E0E0E0", textAlign: "left" } : { textAlign: "left" }}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
