import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "imported", label: "IMPORTED", path: "/problem-bank" },
  { key: "generated", label: "GENERATED", path: "/content" },
  { key: "approved", label: "APPROVED", path: "/assets-library" },
  { key: "banked", label: "BANKED", path: "/question-review" },
  { key: "deployed", label: "DEPLOYED", path: "/filming" },
] as const;

// Order index for "completion" logic
const STAGE_ORDER: Record<string, number> = {
  imported: 0,
  generated: 1,
  approved: 2,
  banked: 3,
  deployed: 4,
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

  // Compute the highest stage reached (any problem at that stage = stage complete)
  let highestReached = -1;
  if (problems) {
    problems.forEach((p) => {
      const idx = STAGE_ORDER[p.pipeline_status];
      if (idx !== undefined && idx > highestReached) highestReached = idx;
    });
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/") ||
    (path === "/content" && location.pathname.startsWith("/workspace/"));

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border px-6 pt-4 pb-3">
      {/* Course + Chapter header */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
        {workspace.courseName}
      </p>
      <h2 className="text-base font-bold text-foreground mb-3">
        Ch {workspace.chapterNumber} — {workspace.chapterName}
      </h2>

      {/* Stage progress bars */}
      <div className="grid grid-cols-6 gap-1">
        {STAGES.map((stage, idx) => {
          const isFilled = idx <= highestReached;
          const isCurrentPage = isActive(stage.path);

          return (
            <button
              key={stage.key}
              onClick={() => navigate(stage.path)}
              className="text-center group cursor-pointer"
            >
              <p
                className={cn(
                  "text-[9px] uppercase tracking-wider mb-1 transition-colors",
                  isCurrentPage
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground group-hover:text-foreground/70"
                )}
              >
                {stage.label}
              </p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isFilled ? "bg-primary" : "bg-transparent"
                  )}
                  style={{ width: isFilled ? "100%" : "0%" }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
