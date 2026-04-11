import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/** Instant tooltip (desktop hover) / tap-popover (mobile). Wraps any element. */
export function Tip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent side={side} className="text-sm px-3 py-2 max-w-[260px] w-auto" sideOffset={4}>
          {label}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
