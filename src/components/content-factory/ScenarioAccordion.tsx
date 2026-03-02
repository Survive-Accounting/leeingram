/**
 * ScenarioAccordion — Renders scenario_sections as collapsible accordions.
 * Each scenario contains EntryByDateCard components.
 */
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScenarioAccordionProps {
  scenarios: {
    label: string;
    totalDates: number;
    validatedDates: number;
    allBalanced: boolean;
  }[];
  /** Render prop: given scenario index, renders the date cards */
  renderDates: (scenarioIndex: number) => React.ReactNode;
  /** When only 1 scenario, skip accordion and render flat */
  singleScenarioFlat?: boolean;
}

export function ScenarioAccordion({
  scenarios,
  renderDates,
  singleScenarioFlat = true,
}: ScenarioAccordionProps) {
  // Single scenario: render flat (no accordion wrapper)
  if (singleScenarioFlat && scenarios.length === 1) {
    const sc = scenarios[0];
    return (
      <div className="space-y-2">
        {sc.label !== "Main" && sc.label !== "Journal Entry" && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">{sc.label}</span>
            <ScenarioStatusBadge validated={sc.validatedDates} total={sc.totalDates} allBalanced={sc.allBalanced} />
          </div>
        )}
        {renderDates(0)}
      </div>
    );
  }

  // Multi-scenario: use accordion
  const defaultOpen = scenarios.map((_, i) => `scenario-${i}`);

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
      {scenarios.map((sc, si) => (
        <AccordionItem
          key={si}
          value={`scenario-${si}`}
          className="border border-border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold hover:no-underline">
            <div className="flex items-center gap-2 flex-1">
              <span>{sc.label}</span>
              <ScenarioStatusBadge validated={sc.validatedDates} total={sc.totalDates} allBalanced={sc.allBalanced} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-1.5">
              {renderDates(si)}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ScenarioStatusBadge({
  validated,
  total,
  allBalanced,
}: {
  validated: number;
  total: number;
  allBalanced: boolean;
}) {
  const allDone = validated === total && total > 0;

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={cn(
        "text-[9px] h-4",
        allDone
          ? "text-green-400 border-green-500/30 bg-green-500/10"
          : "text-foreground/60 border-border"
      )}>
        {validated}/{total} validated
      </Badge>
      {allDone ? (
        <CheckCircle2 className="h-3 w-3 text-green-400" />
      ) : !allBalanced ? (
        <AlertTriangle className="h-3 w-3 text-amber-400" />
      ) : null}
    </div>
  );
}
