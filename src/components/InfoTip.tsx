import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTipProps {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
}

/** Small "?" info icon with tooltip. Drop next to any label that needs explanation. */
export function InfoTip({ text, side = "top" }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
