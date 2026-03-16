import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactNode } from "react";

/** Instant tooltip that shows above the trigger. Wraps any element. */
export function Tip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
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
