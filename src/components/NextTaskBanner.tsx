import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ArrowRight, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const JOB_DESC_LINKS: Record<string, string> = {
  content_creation_va: "https://docs.google.com/document/d/1NFVw0i96s3USCwbbN0Xqr60P4RrbTQoV7p7kH52A0FY/edit?usp=sharing",
  sheet_prep_va: "https://docs.google.com/document/d/1Y_zjOWtl0u28vA9kKZIYsEfSA98YJjXHIgiqIi1RMUI/edit?usp=sharing",
  lead_va: "https://docs.google.com/document/d/16NnmFOqK0L2ig2fun2Z27SrU8g162kNoiu8WLb3TDUk/edit?usp=sharing",
};

const ROUTE_TASKS: Record<string, { task: string; adminOnly?: boolean; countQuery?: string; sopLabel?: string }> = {
  "/problem-bank": {
    task: "Paste textbook problem screenshots for each source item.",
    countQuery: "imported",
    sopLabel: "Import SOP",
  },
  "/content": {
    task: "Generate Survive Teaching Assets from ready source problems.",
    countQuery: "generated",
    sopLabel: "Generate SOP",
  },
  "/review": {
    task: "Review generated variants — approve good ones, send back the rest.",
    sopLabel: "Review SOP",
  },
  "/assets-library": {
    task: "Verify each asset's Google Sheet is set up correctly for tutoring and filming.",
    sopLabel: "Assets SOP",
  },
  "/question-review": {
    task: "Review auto-generated MC questions — approve or reject each one.",
    adminOnly: true,
    countQuery: "review",
    sopLabel: "MC Review SOP",
  },
  "/quizzes-ready": {
    task: "Download quiz CSV files for LearnWorlds import.",
    adminOnly: true,
    sopLabel: "Quiz Export SOP",
  },
  "/video-pending": {
    task: "Record walkthrough videos for each teaching asset.",
    adminOnly: true,
    sopLabel: "Video Recording SOP",
  },
  "/videos-ready": {
    task: "Attach completed videos and prepare assets for deployment.",
    adminOnly: true,
    sopLabel: "Video Attach SOP",
  },
  "/deployment": {
    task: "Complete the deployment checklist to publish content to LearnWorlds.",
    adminOnly: true,
    sopLabel: "Deploy SOP",
  },
};

export function NextTaskBanner() {
  const location = useLocation();
  const { workspace } = useActiveWorkspace();
  const { isVa, vaAccount, primaryRole } = useVaAccount();
  const { impersonating } = useImpersonation();

  const activeRole = impersonating?.role
    ? (impersonating.role === "va_test" ? "content_creation_va" : impersonating.role)
    : primaryRole;

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

  const jobDescLink = JOB_DESC_LINKS[activeRole] || JOB_DESC_LINKS.lead_va;

  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">This Task</p>
              {config.adminOnly && isVa && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" /> Instructor only
                </span>
              )}
            </div>
            <p className="text-sm text-foreground mt-0.5">
              {config.task}
              {pendingCount !== undefined && pendingCount > 0 && (
                <span className="ml-2 text-muted-foreground">
                  {pendingCount} {pendingCount === 1 ? "item" : "items"} remaining.
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-7 text-[11px] px-3"
          asChild
        >
          <a href={jobDescLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1" /> Read Job Description
          </a>
        </Button>
      </div>
    </div>
  );
}
