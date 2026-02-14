import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ContentFactory() {
  const { data: courses, isLoading: coursesLoading } = useQuery({
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
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .order("chapter_number");
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

  const getChapterLessonCount = (chapterId: string) =>
    lessons?.filter((l) => l.chapter_id === chapterId).length ?? 0;

  if (coursesLoading) {
    return (
      <AppLayout>
        <div className="text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Factory</h1>
          <p className="text-sm text-muted-foreground">Manage your accounting course lessons</p>
        </div>
        <Button asChild>
          <Link to="/create-lesson">
            <Plus className="mr-1 h-4 w-4" /> Create Lesson
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {courses?.map((course) => {
          const courseChapters = chapters?.filter((ch) => ch.course_id === course.id) ?? [];
          const totalLessons = courseChapters.reduce(
            (sum, ch) => sum + getChapterLessonCount(ch.id),
            0
          );

          return (
            <Collapsible key={course.id}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{course.course_name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                        </Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-1 pt-0">
                    {courseChapters.map((ch) => {
                      const count = getChapterLessonCount(ch.id);
                      return (
                        <Link
                          key={ch.id}
                          to={`/chapter/${ch.id}`}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                        >
                          <span className="text-foreground">
                            Ch {ch.chapter_number} — {ch.chapter_name}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            {count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {count}
                              </Badge>
                            )}
                            <ChevronRight className="h-3.5 w-3.5" />
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
    </AppLayout>
  );
}
