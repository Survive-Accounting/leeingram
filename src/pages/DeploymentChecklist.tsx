import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Rocket, CheckSquare, Square } from "lucide-react";

const CHECKLIST = [
  { label: "Upload video to final destination", done: false },
  { label: "Connect video to LearnWorlds activity", done: false },
  { label: "Update eBook / activity links", done: false },
  { label: "Paste final LW URLs back into Lovable", done: false },
  { label: "Verify sheet links", done: false },
  { label: "Verify quiz links", done: false },
  { label: "Mark chapter deployment complete", done: false },
];

export default function DeploymentChecklist() {
  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Deployment Checklist
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            VA completion checklist — guided steps for final deployment.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          {CHECKLIST.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/20 transition-colors">
              {item.done
                ? <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground italic">
          Interactive checklist coming soon — this is a placeholder for the VA deployment workflow.
        </p>
      </div>
    </SurviveSidebarLayout>
  );
}
