import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface StepGroup {
  title: string;
  steps: string[];
}

const STEP_GROUPS: StepGroup[] = [
  {
    title: "Generate Practice Problem",
    steps: [
      "Upload Source Exercise / Problem",
      "Generate Similar Survive Problem",
      "Generate Solution",
      "Generate Journal Entry (if applicable)",
      "Tag Topic + Chapter + Source Ref",
    ],
  },
  {
    title: "Prepare for LearnWorlds Import",
    steps: [
      "Select Assets for Export",
      "Export CSV for Question Bank",
      "Export Chapter Asset Index (.docx)",
      "Import CSV into LearnWorlds",
      "Sync Questions to Assessment",
    ],
  },
  {
    title: "Filming Control Panel",
    steps: [
      "Record Micro Video",
      "Upload to Vimeo Folder",
      "Attach Video URL to Asset",
      "Mark Asset as Filmed",
      "Export Updated Chapter Index (.docx)",
    ],
  },
];

export function WorkflowStepsPanel() {
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({ 0: true, 1: false, 2: false });
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleGroup = (idx: number) =>
    setOpenGroups((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const toggleCheck = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside
      className="w-64 shrink-0 border-r border-white/10 py-4 px-3 overflow-y-auto space-y-3"
      style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.3)" }}
    >
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-1 mb-1">
        Workflow Guide
      </h2>

      {STEP_GROUPS.map((group, gIdx) => {
        const isOpen = !!openGroups[gIdx];
        const groupDone = group.steps.filter((_, sIdx) => checked[`${gIdx}-${sIdx}`]).length;

        return (
          <div
            key={gIdx}
            className="rounded-lg border border-white/8 bg-white/[0.03] overflow-hidden"
          >
            {/* Group header */}
            <button
              onClick={() => toggleGroup(gIdx)}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
              )}
              <span className="text-xs font-medium text-white/80 flex-1">{group.title}</span>
              <span className="text-[10px] tabular-nums text-white/30">
                {groupDone}/{group.steps.length}
              </span>
            </button>

            {/* Progress bar */}
            <div className="h-0.5 bg-white/5">
              <div
                className="h-0.5 bg-primary/60 transition-all duration-300"
                style={{ width: `${(groupDone / group.steps.length) * 100}%` }}
              />
            </div>

            {/* Steps */}
            {isOpen && (
              <div className="px-2 py-2 space-y-0.5">
                {group.steps.map((step, sIdx) => {
                  const key = `${gIdx}-${sIdx}`;
                  const done = !!checked[key];
                  return (
                    <label
                      key={sIdx}
                      className={cn(
                        "flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:bg-white/5",
                        done && "opacity-40"
                      )}
                    >
                      <Checkbox
                        checked={done}
                        onCheckedChange={() => toggleCheck(key)}
                        className="mt-0.5 shrink-0"
                      />
                      <span
                        className={cn(
                          "text-xs leading-relaxed",
                          done ? "line-through text-white/40" : "text-white/70"
                        )}
                      >
                        {sIdx + 1}. {step}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
