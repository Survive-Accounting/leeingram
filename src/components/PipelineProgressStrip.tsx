import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "imported", label: "Import", path: "/problem-bank" },
  { key: "generated", label: "Generate", path: "/content" },
  { key: "reviewed", label: "Review", path: "/question-review" },
  { key: "approved", label: "Teaching Assets", path: "/assets-library" },
  { key: "mc_generated", label: "MC Generator", path: "/export-sets" },
  { key: "video", label: "Video Queue", path: "/filming" },
  { key: "deployed", label: "Deploy", path: "/deployment" },
] as const;

const STAGE_ORDER: Record<string, number> = {
  imported: 0, generated: 1, reviewed: 2, approved: 3, mc_generated: 4, video: 5, deployed: 6,
};

function getActiveStageIdx(pathname: string): number {
  const idx = STAGES.findIndex(
    (s) => pathname === s.path || pathname.startsWith(s.path + "/")
  );
  if (pathname.startsWith("/workspace/")) return 1;
  return idx;
}

const STAGE_INSTRUCTIONS: Record<string, string> = {
  "/problem-bank": "Import textbook screenshots for variant generation.",
  "/content": "Generate variants from imported source problems.",
  "/question-review": "Review generated questions — approve or reject.",
  "/assets-library": "Finalized assets ready for production.",
  "/export-sets": "Generate MC quiz sets from approved assets.",
  "/filming": "Record walkthrough videos for assets.",
  "/deployment": "Deploy quizzes and videos to LearnWorlds.",
};

export function PipelineProgressStrip() {
  const { workspace } = useActiveWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: problems } = useQuery({
    queryKey: ["pipeline-strip-problems", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("pipeline_status")
        .eq("chapter_id", workspace!.chapterId);
      if (error) throw error;
      return data as { pipeline_status: string }[];
    },
    enabled: !!workspace?.chapterId,
  });

  if (!workspace?.chapterId || !workspace?.courseName) return null;

  let highestReached = -1;
  if (problems) {
    problems.forEach((p) => {
      const idx = STAGE_ORDER[p.pipeline_status];
      if (idx !== undefined && idx > highestReached) highestReached = idx;
    });
  }

  const activeStageIdx = getActiveStageIdx(location.pathname);
  const isPhase1 = activeStageIdx >= 0 && activeStageIdx <= 3;
  const phase1Stages = STAGES.slice(0, 4);
  const phase2Stages = STAGES.slice(4);

  const instruction = Object.entries(STAGE_INSTRUCTIONS).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + "/")
  )?.[1];

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border px-6 pt-3 pb-3">
      {/* Chapter header */}
      <div className="flex items-center gap-3 mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{workspace.courseName}</p>
          <h2 className="text-sm font-bold text-foreground">
            Ch {workspace.chapterNumber} — {workspace.chapterName}
          </h2>
        </div>
        {instruction && (
          <p className="ml-auto text-xs text-muted-foreground italic hidden sm:block">
            {instruction}
          </p>
        )}
      </div>

      {/* Two-phase progress */}
      <div className="flex gap-4 items-end">
        {/* Phase 1 */}
        <div className="flex-1">
          <p className="text-[8px] uppercase tracking-widest text-primary/60 font-bold mb-1">Phase 1 · Asset Creation</p>
          <div className="grid grid-cols-4 gap-1">
            {phase1Stages.map((stage, idx) => {
              const isFilled = idx <= highestReached;
              const isActivePage = idx === activeStageIdx;
              return (
                <button key={stage.key} onClick={() => navigate(stage.path)} className="text-center group cursor-pointer">
                  <p className={cn("text-[9px] uppercase tracking-wider mb-1 transition-colors", isActivePage ? "text-foreground font-bold" : "text-muted-foreground/50 group-hover:text-muted-foreground")}>{stage.label}</p>
                  <div className={cn("h-2 rounded-full overflow-hidden transition-all", isActivePage ? "ring-1 ring-primary/50" : "")}>
                    <div className="h-full w-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all duration-500", isFilled ? (isActivePage ? "bg-primary" : "bg-primary/40") : "bg-transparent")} style={{ width: isFilled ? "100%" : "0%" }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border shrink-0" />

        {/* Phase 2 */}
        <div className="flex-1">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground/40 font-bold mb-1">Phase 2 · Content Production</p>
          <div className="grid grid-cols-3 gap-1">
            {phase2Stages.map((stage, idx) => {
              const globalIdx = idx + 4;
              const isFilled = globalIdx <= highestReached;
              const isActivePage = globalIdx === activeStageIdx;
              return (
                <button key={stage.key} onClick={() => navigate(stage.path)} className="text-center group cursor-pointer">
                  <p className={cn("text-[9px] uppercase tracking-wider mb-1 transition-colors", isActivePage ? "text-foreground font-bold" : "text-muted-foreground/50 group-hover:text-muted-foreground")}>{stage.label}</p>
                  <div className={cn("h-2 rounded-full overflow-hidden transition-all", isActivePage ? "ring-1 ring-primary/50" : "")}>
                    <div className="h-full w-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all duration-500", isFilled ? (isActivePage ? "bg-primary" : "bg-primary/40") : "bg-transparent")} style={{ width: isFilled ? "100%" : "0%" }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
