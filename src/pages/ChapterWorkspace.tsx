import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";
import { ProblemBankTab } from "@/components/content-factory/ProblemBankTab";
import { LessonsTab } from "@/components/content-factory/LessonsTab";
import { ExportsTab } from "@/components/content-factory/ExportsTab";

export default function ChapterWorkspace() {
  const { chapterId } = useParams<{ chapterId: string }>();

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

  const { data: problems } = useQuery({
    queryKey: ["problem-pairs", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problem_pairs")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("type")
        .order("number");
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  // Lessons query kept for LW Status tab
  const { data: lessons } = useQuery({
    queryKey: ["workspace-lessons", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("lesson_order");
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  if (!chapter) {
    return (
      <SurviveSidebarLayout>
        <div className="text-muted-foreground">Loading workspace...</div>
      </SurviveSidebarLayout>
    );
  }

  const course = chapter.courses as { course_name: string; id: string };
  const chapterNum = chapter.chapter_number;

  const totalProblems = problems?.length ?? 0;
  const reviewedProblems = problems?.filter((p) => p.status === "reviewed" || p.status === "assigned").length ?? 0;
  const approvedProblems = problems?.filter((p) => p.status === "approved").length ?? 0;
  const lwReady = problems?.filter((p) => p.status === "lw_ready").length ?? 0;
  const filmed = problems?.filter((p) => p.status === "filmed").length ?? 0;
  const deployed = problems?.filter((p) => p.status === "deployed").length ?? 0;

  const stats = [
    { label: "Source", value: totalProblems, max: totalProblems || 1 },
    { label: "Approved", value: approvedProblems, max: totalProblems || 1 },
    { label: "LW Ready", value: lwReady, max: totalProblems || 1 },
    { label: "Film Ready", value: reviewedProblems, max: totalProblems || 1 },
    { label: "Filmed", value: filmed, max: totalProblems || 1 },
    { label: "Deployed", value: deployed, max: totalProblems || 1 },
  ];

  return (
    <SurviveSidebarLayout>
      <div className="mb-3">
        <Link to="/content" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Content Factory
        </Link>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{course.course_name}</p>
        <h1 className="text-xl font-bold text-foreground">
          Ch {chapterNum} — {chapter.chapter_name}
        </h1>
      </div>

      {/* Progress strip */}
      <div className="grid grid-cols-6 gap-2 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            <Progress value={(s.value / s.max) * 100} className="h-1.5" />
            <p className="text-xs font-medium text-foreground mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="problems" className="space-y-3">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="lw-status">LearnWorlds Status</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          <ProblemBankTab chapterId={chapterId!} chapterNumber={chapterNum} />
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
