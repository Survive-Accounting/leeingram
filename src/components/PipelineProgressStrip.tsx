import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveEffectiveRole, ROLE_LABELS, type EffectiveRole } from "@/lib/rolePermissions";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STAGES = [
  { key: "imported", label: "Import", path: "/problem-bank", tip: "Paste textbook screenshots and tag source problems for this chapter." },
  { key: "generated", label: "Generate", path: "/content", tip: "AI generates Survive Teaching Asset variants from imported source problems." },
  { key: "reviewed", label: "Review", path: "/review", tip: "Review generated variants — approve, reject, or flag for fixes." },
  { key: "approved", label: "Teaching Assets", path: "/assets-library", tip: "Approved assets ready for sheet prep, quizzes, and video production." },
  { key: "topics", label: "Topic Generator", path: "/phase2-review", tip: "Generate core exam topics from approved teaching assets." },
  { key: "quiz_queue", label: "Quiz Queue", path: "/quiz-queue", tip: "Generate and review quiz questions for each topic." },
  { key: "video_queue", label: "Video Queue", path: "/video-queue", tip: "Record walkthrough videos for each topic." },
  { key: "deployed", label: "Deployment", path: "/deployment", tip: "Final deployment of quizzes and videos to LearnWorlds." },
] as const;

const STAGE_ORDER: Record<string, number> = {
  imported: 0, generated: 1, reviewed: 2, approved: 3, topics: 4, quiz_queue: 5, video_queue: 6, deployed: 7,
};

/** Which pipeline steps each role owns */
const ROLE_ACTIVE_STAGES: Record<EffectiveRole, string[]> = {
  content_creation_va: ["/problem-bank", "/content", "/review", "/assets-library"],
  sheet_prep_va: ["/assets-library", "/deployment"],
  lead_va: ["/problem-bank", "/content", "/review", "/assets-library", "/quiz-queue", "/video-queue", "/deployment"],
  admin: STAGES.map(s => s.path),
};

function getActiveStageIdx(pathname: string): number {
  const idx = STAGES.findIndex(
    (s) => pathname === s.path || pathname.startsWith(s.path + "/")
  );
  if (pathname.startsWith("/workspace/")) return 1;
  return idx;
}

const STAGE_INSTRUCTIONS: Record<string, string> = {
  "/problem-bank": "Paste textbook problem screenshots for each source item.",
  "/content": "Generate variants from imported source problems.",
  "/review": "Review generated variants — approve or send back.",
  "/assets-library": "Finalized assets ready for production.",
  "/phase2-review": "Generate and manage core exam topics from teaching assets.",
  "/quiz-queue": "Generate and review quiz questions for each topic.",
  "/video-queue": "Record walkthrough videos for each topic.",
  "/deployment": "Deploy quizzes and videos to LearnWorlds.",
};

export function PipelineProgressStrip() {
  const { workspace } = useActiveWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const { isVa, vaAccount } = useVaAccount();
  const { impersonating } = useImpersonation();

  const effectiveRole = resolveEffectiveRole(impersonating?.role, vaAccount?.role, isVa);
  const isAdmin = effectiveRole === "admin";
  const roleInfo = ROLE_LABELS[effectiveRole];
  const activePaths = ROLE_ACTIVE_STAGES[effectiveRole];

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
  const phase1Stages = STAGES.slice(0, 4);
  const phase2Stages = STAGES.slice(4);
  const phase2Cols = phase2Stages.length;

  const instruction = Object.entries(STAGE_INSTRUCTIONS).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + "/")
  )?.[1];

  const isStageActive = (path: string) => activePaths.includes(path);

  const renderStage = (stage: typeof STAGES[number], idx: number, globalIdx: number) => {
    const isFilled = globalIdx <= highestReached;
    const isActivePage = globalIdx === activeStageIdx;
    const active = isStageActive(stage.path);

    if (!active) {
      return (
        <div key={stage.key} className="text-center opacity-50 cursor-default select-none">
          <p className="text-[8px] uppercase tracking-wider mb-1 text-muted-foreground/60">{stage.label}</p>
          <div className="h-1.5 rounded-full bg-muted/40" />
        </div>
      );
    }

    return (
      <Tooltip key={stage.key}>
        <TooltipTrigger asChild>
          <button onClick={() => navigate(stage.path)} className="text-center group cursor-pointer">
            <p className={cn(
              "uppercase tracking-wider mb-1 transition-colors",
              isActivePage ? "text-foreground font-bold text-[10px]" : "text-muted-foreground/60 group-hover:text-muted-foreground text-[9px]"
            )}>{stage.label}</p>
            <div className={cn("h-2 rounded-full overflow-hidden transition-all", isActivePage ? "ring-1 ring-primary/50" : "")}>
              <div className="h-full w-full bg-muted">
                <div className={cn("h-full rounded-full transition-all duration-500", isFilled ? (isActivePage ? "bg-primary" : "bg-primary/40") : "bg-transparent")} style={{ width: isFilled ? "100%" : "0%" }} />
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {stage.tip}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border px-6 pt-3 pb-3">
      {/* Role label + Chapter header */}
      <div className="flex items-center gap-3 mb-3">
        <div>
          {!isAdmin && (
            <p className="text-[9px] text-primary font-bold uppercase tracking-widest mb-0.5">
              {roleInfo.role} · {roleInfo.phase}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{workspace.courseName}</p>
          <h2 className="text-sm font-bold text-foreground">
            Ch {workspace.chapterNumber} — {workspace.chapterName}
          </h2>
        </div>
      </div>

      {/* Two-phase progress */}
      <div className="flex gap-4 items-end">
        {/* Phase 1 */}
        <div className="flex-1">
          <p className="text-[8px] uppercase tracking-widest text-primary/60 font-bold mb-1">Phase 1 · Teaching Asset Creation</p>
          <div className="grid grid-cols-4 gap-1">
            {phase1Stages.map((stage, idx) => renderStage(stage, idx, idx))}
          </div>
        </div>

        {/* Phase 2 — hidden for content_creation_va */}
        {effectiveRole !== "content_creation_va" && (
          <>
            {/* Divider */}
            <div className="h-8 w-px bg-border shrink-0" />

            <div className="flex-1">
              <p className="text-[8px] uppercase tracking-widest text-muted-foreground/40 font-bold mb-1">Phase 2 · Content Production</p>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${phase2Cols}, minmax(0, 1fr))` }}>
                {phase2Stages.map((stage, idx) => renderStage(stage, idx, idx + 4))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
