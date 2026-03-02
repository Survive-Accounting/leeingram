import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProblemBankTab } from "@/components/content-factory/ProblemBankTab";
import { ChapterActivityLog } from "@/components/content-factory/ChapterActivityLog";
import { GenerationRunsPanel } from "@/components/content-factory/GenerationRunsPanel";
import { useProductionSession } from "@/hooks/useProductionSession";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

export default function ChapterWorkspace() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const { saveSession } = useProductionSession();
  const { setWorkspace } = useActiveWorkspace();
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
    </SurviveSidebarLayout>
  );
}
