import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, HelpCircle } from "lucide-react";
import { SEMESTERS } from "./RoadmapConstants";

interface SemesterVision {
  campuses: number;
  greekOrgs: number;
  students: number;
}

export function VisionSection() {
  const [visions, setVisions] = useState<Record<string, SemesterVision>>({});
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({});

  const toggleSemester = (sem: string) => {
    setExpandedSemesters((prev) => ({ ...prev, [sem]: !prev[sem] }));
  };

  const updateVision = (sem: string, field: keyof SemesterVision, value: string) => {
    const num = parseInt(value) || 0;
    setVisions((prev) => ({
      ...prev,
      [sem]: { campuses: 0, greekOrgs: 0, students: 0, ...prev[sem], [field]: num },
    }));
  };

  const calcRevenue = (v: SemesterVision) => {
    return (v.greekOrgs * 5000) + (v.campuses * 5000);
  };

  return (
    <div className="mt-2 space-y-1 rounded-xl border border-border p-3 bg-muted/30">
      {SEMESTERS.map((sem) => {
        const isOpen = expandedSemesters[sem];
        const v = visions[sem] || { campuses: 0, greekOrgs: 0, students: 0 };
        const revenue = calcRevenue(v);

        return (
          <Collapsible key={sem} open={isOpen} onOpenChange={() => toggleSemester(sem)}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 px-2 rounded hover:bg-accent/40 transition-colors cursor-pointer text-left">
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              <span className="text-xs font-medium text-foreground">{sem}</span>
              {revenue > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-auto">${revenue.toLocaleString()}</Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-4 gap-2 p-2 pl-7">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground"># Campuses</Label>
                  <Input type="number" min={0} className="h-7 text-xs" value={v.campuses || ""} onChange={(e) => updateVision(sem, "campuses", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground"># Greek Orgs</Label>
                  <Input type="number" min={0} className="h-7 text-xs" value={v.greekOrgs || ""} onChange={(e) => updateVision(sem, "greekOrgs", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground"># Students</Label>
                  <Input type="number" min={0} className="h-7 text-xs" value={v.students || ""} onChange={(e) => updateVision(sem, "students", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">$ Revenue</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-2.5 w-2.5 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-xs">
                          <p>$5,000 per Greek org + $5,000 additional miscellaneous revenue per campus</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="h-7 flex items-center text-xs font-medium text-foreground px-2 bg-muted rounded-md border border-border">
                    ${revenue.toLocaleString()}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
