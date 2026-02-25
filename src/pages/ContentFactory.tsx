import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ContentFactory() {
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*").order("chapter_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: problemPairs } = useQuery({
    queryKey: ["all-problem-pairs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("problem_pairs").select("id, chapter_id");
      if (error) throw error;
      return data;
    },
  });

  const getChapterLessons = (chapterId: string) => lessons?.filter((l) => l.chapter_id === chapterId) ?? [];
  const getChapterProblems = (chapterId: string) => problemPairs?.filter((p) => p.chapter_id === chapterId).length ?? 0;

  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="text-muted-foreground">Loading...</div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Asset Factory</h1>
        <p className="text-sm text-muted-foreground">High-speed chapter planning & lesson production</p>
      </div>

      <div className="space-y-3">
        {courses?.map((course) => {
          const courseChapters = chapters?.filter((ch) => ch.course_id === course.id) ?? [];

          return (
            <Collapsible key={course.id}>
              <Card className="overflow-hidden border-white/10 bg-white/[0.07]">
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{course.course_name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{courseChapters.length} ch</Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-1 pt-0">
                    {courseChapters.map((ch) => {
                      const chLessons = getChapterLessons(ch.id);
                      const probCount = getChapterProblems(ch.id);
                      const filmedPct = chLessons.length
                        ? Math.round((chLessons.filter((l) => l.status_filmed).length / chLessons.length) * 100)
                        : 0;

                      return (
                        <Link
                          key={ch.id}
                          to={`/workspace/${ch.id}`}
                          className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent group"
                        >
                          <span className="text-foreground">
                            Ch {ch.chapter_number} — {ch.chapter_name}
                          </span>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {probCount > 0 && (
                              <Badge variant="outline" className="text-[10px]">{probCount} prob</Badge>
                            )}
                            {chLessons.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">{chLessons.length} lessons</Badge>
                            )}
                            {filmedPct > 0 && (
                              <span className="text-[10px]">{filmedPct}% filmed</span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </Link>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </SurviveSidebarLayout>
  );
}
