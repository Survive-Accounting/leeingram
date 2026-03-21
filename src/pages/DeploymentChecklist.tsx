import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Rocket, CheckSquare, Square } from "lucide-react";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const DEFAULT_CHECKLIST = [
  {
    title: "Upload Final Video",
    description:
      "Upload the edited walkthrough video to the final storage location (Google Drive or LearnWorlds). This makes the video available for linking inside the course.",
    done: false,
  },
  {
    title: "Attach Video to LearnWorlds Lesson",
    description:
      "Open the correct LearnWorlds activity and attach the uploaded video so students can watch it directly inside the course.",
    done: false,
  },
  {
    title: "Update eBook / Lesson Links",
    description:
      "Update links inside the LearnWorlds eBook or lesson so students can easily navigate between problems, videos, and quizzes.",
    done: false,
  },
  {
    title: "Save Final LearnWorlds URLs",
    description:
      "Copy the final LearnWorlds lesson links and paste them back into the pipeline dashboard for tracking and reuse.",
    done: false,
  },
  {
    title: "Verify Google Sheet Links",
    description:
      "Open each problem's Google Sheet and confirm the sheet link works correctly for student access.",
    done: false,
  },
  {
    title: "Verify Quiz Links",
    description:
      "Open the LearnWorlds quiz and confirm it loads the correct questions.",
    done: false,
  },
  {
    title: "Mark Chapter Deployment Complete",
    description:
      "When all steps are verified, mark the chapter as Deployment Complete to indicate the chapter is fully live.",
    done: false,
  },
];

const SHEET_PREP_CHECKLIST = [
  {
    title: "Verify Master Sheet Formatting",
    description:
      "Find tasks in the VA Instructions tab in the sheet.",
    done: false,
  },
  {
    title: "Prepare Student Practice Sheet",
    description:
      "Find tasks in the VA Instructions tab in the sheet.",
    done: false,
  },
  {
    title: "Prepare Promo / Free Sheet",
    description:
      "Find tasks in the VA Instructions tab in the sheet.",
    done: false,
  },
  {
    title: "Test All Sheet Links",
    description:
      "Find tasks in the VA Instructions tab in the sheet.",
    done: false,
  },
  {
    title: "Copy LearnWorlds Embed Link",
    description:
      "Coming soon.",
    done: false,
  },
  {
    title: "Attach Google Sheet to LearnWorlds Lesson",
    description:
      "Coming soon.",
    done: false,
  },
  {
    title: "Save LearnWorlds Activity URL",
    description:
      "Coming soon.",
    done: false,
  },
  {
    title: "Mark Asset Sheet Prep Complete",
    description:
      "Coming soon.",
    done: false,
  },
];

export default function DeploymentChecklist() {
  const { vaAccount, isVa } = useVaAccount();
  const { impersonating } = useImpersonation();

  const effectiveRole = impersonating?.role || vaAccount?.role || null;
  const isSheetPrep = effectiveRole === "sheet_prep_va";
  
  // VA placeholder (non-sheet-prep VAs)
  const showPlaceholder = (isVa || !!impersonating) && !isSheetPrep;
  if (showPlaceholder) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="max-w-md w-full rounded-xl p-8 text-center space-y-4" style={{ backgroundColor: "#14213D" }}>
            <h2 className="text-xl font-bold text-white">Deployment Queue</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              This Phase 2 step is where completed content is published to LearnWorlds for students. Tasks related to this step are coming soon! Thank you for your help building Survive Accounting.
            </p>
            <p className="text-xs text-white/40 mt-4">— Lee Ingram</p>
          </div>
        </div>
      </SurviveSidebarLayout>
    );
  }

  const checklist = isSheetPrep ? SHEET_PREP_CHECKLIST : DEFAULT_CHECKLIST;
  const heading = isSheetPrep ? "Sheet Prep Deployment Checklist" : "Deployment Checklist";
  const subtitle = isSheetPrep
    ? "Follow each step to prepare and deploy Google Sheets for this chapter."
    : "Follow each step in order to deploy this chapter to LearnWorlds.";

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> {heading}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-1">
          {checklist.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-lg px-4 py-4 hover:bg-muted/30 transition-colors"
            >
              <div className="pt-0.5">
                {item.done ? (
                  <CheckSquare className="h-5 w-5 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
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