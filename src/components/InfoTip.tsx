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

interface InfoTipProps {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
}

/** Small "?" info icon with tooltip (desktop hover) / popover (mobile tap). */
export function InfoTip({ text, side = "top" }: InfoTipProps) {
  const isMobile = useIsMobile();

  const trigger = (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded-full p-0 text-muted-foreground hover:text-foreground transition-colors"
      style={isMobile ? { minWidth: 32, minHeight: 32 } : undefined}
      tabIndex={-1}
    >
      <Info className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
    </button>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent side={side} className="max-w-xs text-sm px-3 py-2">
          {text}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
