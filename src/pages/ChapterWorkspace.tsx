import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProblemBankTab } from "@/components/content-factory/ProblemBankTab";
import { ChapterActivityLog } from "@/components/content-factory/ChapterActivityLog";
import { GenerationRunsPanel } from "@/components/content-factory/GenerationRunsPanel";
import { useProductionSession } from "@/hooks/useProductionSession";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useBuildRun, type BuildRun } from "@/hooks/useBuildRun";
import { Timer } from "lucide-react";
import { toast } from "sonner";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function BuildRunSummary({ run }: { run: BuildRun }) {
  if (!run.total_seconds && run.status !== "completed" && run.status !== "abandoned") return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Last Build Run</span>
        {run.status === "abandoned" && <span className="text-[10px] text-muted-foreground">(abandoned)</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <div className="text-muted-foreground">Total time</div>
        <div className="text-foreground font-medium">{run.total_seconds ? formatElapsed(run.total_seconds) : "—"}</div>
        <div className="text-muted-foreground">Avg per done</div>
        <div className="text-foreground font-medium">{run.avg_seconds_per_terminal ? formatElapsed(run.avg_seconds_per_terminal) : "—"}</div>
        <div className="text-muted-foreground">Imported</div>
        <div className="text-foreground">{run.import_count}</div>
        <div className="text-muted-foreground">Approved</div>
        <div className="text-foreground">{run.approved_count}</div>
        <div className="text-muted-foreground">Needs Fix</div>
        <div className="text-foreground">{run.needs_fix_count}</div>
        {run.ended_at && (
          <>
            <div className="text-muted-foreground">Completed at</div>
            <div className="text-foreground">{new Date(run.ended_at).toLocaleString()}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChapterWorkspace() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const { saveSession } = useProductionSession();
  const { setWorkspace } = useActiveWorkspace();
  const { activeRun, isRunning } = useBuildRun();
  const qc = useQueryClient();
  const initialTab = searchParams.get("tab") || "problems";
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*, courses(*)")
        .eq("id", chapterId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const course = chapter?.courses as { course_name: string; id: string; code: string } | undefined;
  const chapterNum = chapter?.chapter_number ?? 0;

  useEffect(() => {
    if (chapter && course) {
      saveSession({
        courseId: course.id,
        courseName: course.course_name,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name,
        chapterNumber: chapterNum,
        activeTab,
        lastPhase: "Generated",
      });
      setWorkspace({
        courseId: course.id,
        courseName: course.course_name,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name,
        chapterNumber: chapterNum,
      });
    }
  }, [chapter, activeTab]);

  if (!chapter || !course) {
    return (
      <SurviveSidebarLayout>
        <div className="text-foreground/80">Loading workspace...</div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <Timer className="h-3 w-3 animate-pulse" /> Running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="generation">Generation Runs</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          <ProblemBankTab chapterId={chapterId!} chapterNumber={chapterNum} courseId={course.id} />
        </TabsContent>

        <TabsContent value="generation">
          <GenerationRunsPanel chapterId={chapterId!} courseId={course.id} />
        </TabsContent>

        <TabsContent value="activity">
          <ChapterActivityLog chapterId={chapterId!} />
        </TabsContent>
      </Tabs>

      {/* Build Run Summary */}
      {activeRun && (activeRun.status === "completed" || activeRun.status === "abandoned") && (
        <div className="mt-4">
          <BuildRunSummary run={activeRun} />
        </div>
      )}
    </SurviveSidebarLayout>
  );
}
