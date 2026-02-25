import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";
import { ProblemBankTab } from "@/components/content-factory/ProblemBankTab";
import { LessonsTab } from "@/components/content-factory/LessonsTab";
import { ExportsTab } from "@/components/content-factory/ExportsTab";
import { useProductionSession } from "@/hooks/useProductionSession";

export default function ChapterWorkspace() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const { saveSession } = useProductionSession();
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


  // Use chapter_problems for status tracking
  const { data: chapterProblems } = useQuery({
    queryKey: ["chapter-problems-stats", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("status")
        .eq("chapter_id", chapterId!);
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const { data: chapterAssets } = useQuery({
    queryKey: ["chapter-assets-stats", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id")
        .eq("chapter_id", chapterId!);
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const course = chapter?.courses as { course_name: string; id: string } | undefined;
  const chapterNum = chapter?.chapter_number ?? 0;

  // Determine last active phase from stats
  const determinePhase = () => {
    if ((chapterAssets?.length ?? 0) > 0) return "Approved";
    if ((chapterProblems?.filter(p => p.status === "generated" || p.status === "approved").length ?? 0) > 0) return "Generated";
    if ((chapterProblems?.length ?? 0) > 0) return "Source";
    return "Source";
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
        lastPhase: determinePhase(),
      });
    }
  }, [chapter, activeTab]);

  if (!chapter || !course) {
    return (
      <SurviveSidebarLayout>
        <div className="text-muted-foreground">Loading workspace...</div>
      </SurviveSidebarLayout>
    );
  }

  const totalSource = chapterProblems?.length ?? 0;
  const generated = chapterProblems?.filter((p) => p.status === "generated" || p.status === "approved").length ?? 0;
  const approved = chapterAssets?.length ?? 0;

  const stats = [
    { label: "SOURCE", value: totalSource, max: totalSource || 1 },
    { label: "GENERATED", value: generated, max: totalSource || 1 },
    { label: "APPROVED", value: approved, max: totalSource || 1 },
    { label: "LW READY", value: 0, max: totalSource || 1 },
    { label: "FILM READY", value: 0, max: totalSource || 1 },
    { label: "FILMED", value: 0, max: totalSource || 1 },
    { label: "DEPLOYED", value: 0, max: totalSource || 1 },
  ];

  return (
    <SurviveSidebarLayout>
      <div className="mb-3">
        <Link to="/content" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Asset Factory
        </Link>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{course.course_name}</p>
        <h1 className="text-xl font-bold text-foreground">
          Ch {chapterNum} — {chapter.chapter_name}
        </h1>
      </div>

      {/* Progress strip */}
      <div className="grid grid-cols-7 gap-2 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <Progress value={(s.value / s.max) * 100} className="h-1.5" />
            <p className="text-xs font-medium text-foreground mt-0.5">{s.value}</p>
          </div>
        ))}
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
    </SurviveSidebarLayout>
  );
}
