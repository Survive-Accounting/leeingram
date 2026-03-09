import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { ArrowRight } from "lucide-react";

const ROUTE_TASKS: Record<string, { task: string; countQuery?: string }> = {
  "/problem-bank": { task: "Import textbook screenshots for this chapter.", countQuery: "imported" },
  "/content": { task: "Generate variants from imported problems.", countQuery: "generated" },
  "/review": { task: "Review generated variants — approve or send back." },
  "/assets-library": { task: "Manage approved teaching assets for production." },
  "/question-review": { task: "Review MC questions generated from teaching assets.", countQuery: "review" },
  "/quizzes-ready": { task: "Download quiz CSV files for LearnWorlds import." },
  "/video-pending": { task: "Assets waiting for walkthrough video recording." },
  "/videos-ready": { task: "Assets with completed videos ready for deployment." },
  "/deployment": { task: "Deploy quizzes and videos to LearnWorlds." },
};

export function NextTaskBanner() {
  const location = useLocation();
  const { workspace } = useActiveWorkspace();

  const routeConfig = Object.entries(ROUTE_TASKS).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + "/")
  );

  const { data: pendingCount } = useQuery({
    queryKey: ["next-task-count", workspace?.chapterId, routeConfig?.[1]?.countQuery],
    queryFn: async () => {
      const chId = workspace!.chapterId;
      const type = routeConfig![1].countQuery;
      if (type === "imported") {
        const { count } = await supabase.from("chapter_problems").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("pipeline_status", "imported");
        return count ?? 0;
      }
      if (type === "generated") {
        const { count } = await supabase.from("chapter_problems").select("id", { count: "exact", head: true }).eq("chapter_id", chId).eq("pipeline_status", "imported");
        return count ?? 0;
      }
      if (type === "review") {
        const { count } = await supabase.from("banked_questions").select("id", { count: "exact", head: true }).eq("review_status", "pending");
        return count ?? 0;
      }
      return 0;
    },
    enabled: !!workspace?.chapterId && !!routeConfig?.[1]?.countQuery,
  });

  if (!routeConfig) return null;
  const [, config] = routeConfig;

  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3.5">
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Next Task</p>
          <p className="text-sm text-white mt-0.5">
            {config.task}
            {pendingCount !== undefined && pendingCount > 0 && (
              <span className="ml-2 text-white/60">
                {pendingCount} {pendingCount === 1 ? "item" : "items"} remaining.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
