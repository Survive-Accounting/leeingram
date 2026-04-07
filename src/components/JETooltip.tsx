import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JETooltipProps {
  text: string;
  /** Optional dollar amount to display below the explanation */
  amount?: number;
  /** Optional: themed for SolutionsViewer (inline styles) vs admin (tailwind) */
  variant?: "solutions" | "admin";
}

export function JETooltip({ text, amount, variant = "admin" }: JETooltipProps) {
  const isSolutions = variant === "solutions";

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity ml-1 align-middle"
          aria-label="More info"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[260px] text-xs leading-relaxed z-[100] text-left"
        style={isSolutions ? { background: "#FFFFFF", color: "#1A1A1A", border: "1px solid #E0E0E0", textAlign: "left" } : { textAlign: "left" }}
      >
        <span>{text}</span>
        {amount != null && (
          <>
            <br />
            <span className="text-[10px] opacity-60 font-mono mt-0.5 inline-block">
              = ${amount.toLocaleString("en-US")}
            </span>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
