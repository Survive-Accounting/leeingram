import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
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
      <AppLayout>
        <div className="text-muted-foreground">Loading workspace...</div>
      </AppLayout>
    );
  }

  const course = chapter.courses as { course_name: string; id: string };
  const chapterNum = chapter.chapter_number;

  const totalProblems = problems?.length ?? 0;
  const reviewedProblems = problems?.filter((p) => p.status === "reviewed" || p.status === "assigned").length ?? 0;
  const totalLessons = lessons?.length ?? 0;
  const readyToFilm = lessons?.filter((l) => l.status_ready_to_film).length ?? 0;
  const filmed = lessons?.filter((l) => l.status_filmed).length ?? 0;
  const posted = lessons?.filter((l) => l.status_posted).length ?? 0;

  const stats = [
    { label: "Problems", value: totalProblems, max: totalProblems || 1 },
    { label: "Reviewed", value: reviewedProblems, max: totalProblems || 1 },
    { label: "Lessons", value: totalLessons, max: chapter.target_lessons ?? 5 },
    { label: "Ready", value: readyToFilm, max: totalLessons || 1 },
    { label: "Filmed", value: filmed, max: totalLessons || 1 },
    { label: "Posted", value: posted, max: totalLessons || 1 },
  ];

  return (
    <AppLayout>
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
          <TabsTrigger value="problems">Problem Bank</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          <ProblemBankTab chapterId={chapterId!} chapterNumber={chapterNum} />
        </TabsContent>

        <TabsContent value="lessons">
          <LessonsTab chapterId={chapterId!} courseId={course.id} chapterNumber={chapterNum} targetLessons={chapter.target_lessons ?? 5} />
        </TabsContent>

        <TabsContent value="exports">
          <ExportsTab chapterId={chapterId!} chapterNumber={chapterNum} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
