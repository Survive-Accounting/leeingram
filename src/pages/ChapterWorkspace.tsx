import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ProblemBankTab } from "@/components/content-factory/ProblemBankTab";
import { LessonsTab } from "@/components/content-factory/LessonsTab";
import { ExportsTab } from "@/components/content-factory/ExportsTab";
import { useProductionSession } from "@/hooks/useProductionSession";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function ChapterWorkspace() {
  const { chapterId } = useParams<{chapterId: string;}>();
  const [searchParams] = useSearchParams();
  const { saveSession } = useProductionSession();
  const { setWorkspace } = useActiveWorkspace();
  const initialTab = searchParams.get("tab") || "problems";
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("chapters").
      select("*, courses(*)").
      eq("id", chapterId!).
      single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId
  });


  const { data: chapterProblems } = useQuery({
    queryKey: ["chapter-problems-stats", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("pipeline_status")
        .eq("chapter_id", chapterId!);
      if (error) throw error;
      return data as { pipeline_status: string }[];
    },
    enabled: !!chapterId,
  });

  const course = chapter?.courses as {course_name: string;id: string;} | undefined;
  const chapterNum = chapter?.chapter_number ?? 0;

  // Determine last active phase from stats
  const determinePhase = () => {
    const counts: Record<string, number> = {};
    chapterProblems?.forEach((p) => { counts[p.pipeline_status] = (counts[p.pipeline_status] || 0) + 1; });
    if ((counts["deployed"] ?? 0) > 0) return "Deployed";
    if ((counts["ready_to_film"] ?? 0) > 0) return "Ready to Film";
    if ((counts["approved"] ?? 0) > 0) return "Approved";
    if ((counts["generated"] ?? 0) > 0) return "Generated";
    return "Imported";
  };

  // Persist session whenever chapter/tab changes
  useEffect(() => {
    if (chapter && course) {
      saveSession({
        courseId: course.id,
        courseName: course.course_name,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name,
        chapterNumber: chapterNum,
        activeTab,
        lastPhase: determinePhase()
      });
      // Also update active workspace
      setWorkspace({
        courseId: course.id,
        courseName: course.course_name,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name,
        chapterNumber: chapterNum
      });
    }
  }, [chapter, activeTab]);

  if (!chapter || !course) {
    return (
      <SurviveSidebarLayout>
        <div className="text-foreground/80">Loading workspace...</div>
      </SurviveSidebarLayout>);

  }

  const totalProblems = chapterProblems?.length ?? 0;
  const pCounts: Record<string, number> = {};
  chapterProblems?.forEach((p) => { pCounts[p.pipeline_status] = (pCounts[p.pipeline_status] || 0) + 1; });

  const STAGES = ["imported", "generated", "approved", "banked", "ready_to_film", "deployed"] as const;
  const stageLabels: Record<string, string> = {
    imported: "IMPORTED", generated: "GENERATED", approved: "APPROVED",
    banked: "BANKED", ready_to_film: "READY TO FILM", deployed: "DEPLOYED",
  };

  const stats = STAGES.map((s) => ({
    label: stageLabels[s], value: pCounts[s] ?? 0, max: totalProblems || 1,
  }));


  return (
    <SurviveSidebarLayout>
      <div className="mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{course.course_name}</p>
        <h1 className="text-xl font-bold text-primary-foreground">
          Ch {chapterNum} — {chapter.chapter_name}
        </h1>
      </div>

      {/* Progress strip */}
      <div className="grid grid-cols-6 gap-2 mb-5">
        {stats.map((s) =>
        <div key={s.label} className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <Progress value={s.value / s.max * 100} className="h-1.5" />
            <p className="text-xs font-medium text-foreground mt-0.5">{s.value}</p>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="lw-status">LearnWorlds Status</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          <ProblemBankTab chapterId={chapterId!} chapterNumber={chapterNum} courseId={course.id} />
        </TabsContent>

        <TabsContent value="lw-status">
          <LessonsTab chapterId={chapterId!} courseId={course.id} chapterNumber={chapterNum} targetLessons={chapter.target_lessons ?? 5} />
        </TabsContent>

        <TabsContent value="exports">
          <ExportsTab chapterId={chapterId!} chapterNumber={chapterNum} />
        </TabsContent>
      </Tabs>
    </SurviveSidebarLayout>);

}