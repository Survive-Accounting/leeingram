import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Index() {
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
        <div className="text-foreground/80">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Factory</h1>
          <p className="text-sm text-foreground/80">Manage your accounting course lessons</p>
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
              <Card className="overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <CollapsibleTrigger className="w-full text-left group">
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
                        <ChevronDown className="h-4 w-4 text-foreground/70 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
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

      {/* Future Integration Placeholders */}
      <div className="mt-8 rounded-lg border border-dashed border-border bg-background/90 p-4">
        <p className="text-xs font-medium text-foreground/70">Future integrations planned:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Google Drive / Sheets API", "Vimeo transcript import", "Descript automation", "LearnWorlds publishing"].map(
            (name) => (
              <Badge key={name} variant="outline" className="text-xs text-foreground/70">
                {name}
              </Badge>
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
}
