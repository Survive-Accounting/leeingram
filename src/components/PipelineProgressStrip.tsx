import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "imported", label: "Imported", path: "/problem-bank" },
  { key: "generated", label: "Generated", path: "/content" },
  { key: "approved", label: "Approved", path: "/assets-library" },
  { key: "banked", label: "Banked", path: "/question-review" },
  { key: "deployed", label: "Deployed", path: "/filming" },
] as const;

const STAGE_ORDER: Record<string, number> = {
  imported: 0, generated: 1, approved: 2, banked: 3, deployed: 4,
};

// Map current path to the active stage index
function getActiveStageIdx(pathname: string): number {
  const idx = STAGES.findIndex(
    (s) => pathname === s.path || pathname.startsWith(s.path + "/")
  );
  if (pathname.startsWith("/workspace/")) return 1; // content/generated
  return idx;
}

const STAGE_INSTRUCTIONS: Record<string, string> = {
  "/problem-bank": "Import textbook screenshots for variant generation.",
  "/content": "Generate and speed-review problem variants.",
  "/assets-library": "Approve assets and send to banked generation.",
  "/question-review": "Review generated questions and approve or reject.",
  "/filming": "Record walkthrough videos and prepare deployment.",
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

  // Find instruction for current page
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

      {/* Stage progress */}
      <div className="grid grid-cols-5 gap-1">
        {STAGES.map((stage, idx) => {
          const isFilled = idx <= highestReached;
          const isActivePage = idx === activeStageIdx;

          return (
            <button
              key={stage.key}
              onClick={() => navigate(stage.path)}
              className="text-center group cursor-pointer"
            >
              <p
                className={cn(
                  "text-[9px] uppercase tracking-wider mb-1 transition-colors",
                  isActivePage
                    ? "text-foreground font-bold"
                    : "text-muted-foreground/50 group-hover:text-muted-foreground"
                )}
              >
                {stage.label}
              </p>
              <div className={cn(
                "h-2 rounded-full overflow-hidden transition-all",
                isActivePage ? "ring-1 ring-primary/50" : ""
              )}>
                <div className="h-full w-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isFilled
                        ? isActivePage ? "bg-primary" : "bg-primary/40"
                        : "bg-transparent"
                    )}
                    style={{ width: isFilled ? "100%" : "0%" }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
