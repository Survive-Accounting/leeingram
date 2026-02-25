import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, Star } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STARRED_KEY = "asset-factory-starred-course";

export default function ContentFactory() {
  const [starredId, setStarredId] = useState<string | null>(
    () => localStorage.getItem(STARRED_KEY)
  );

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

  const toggleStar = (courseId: string) => {
    if (starredId === courseId) {
      setStarredId(null);
      localStorage.removeItem(STARRED_KEY);
    } else {
      setStarredId(courseId);
      localStorage.setItem(STARRED_KEY, courseId);
    }
  };

  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="text-muted-foreground">Loading...</div>
      </SurviveSidebarLayout>
    );
  }

  // Sort: starred course first
  const sortedCourses = courses ? [...courses].sort((a, b) => {
    if (a.id === starredId) return -1;
    if (b.id === starredId) return 1;
    return 0;
  }) : [];

  return (
    <SurviveSidebarLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Asset Factory</h1>
        <p className="text-sm text-muted-foreground">High-speed chapter planning & lesson production</p>
      </div>

      <div className="space-y-3">
        {sortedCourses.map((course) => {
          const isStarred = course.id === starredId;
          const courseChapters = chapters?.filter((ch) => ch.course_id === course.id) ?? [];

          return (
            <Collapsible key={course.id}>
              <Card
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  isStarred
                    ? "border-amber-400/60 bg-amber-400/[0.06] shadow-[0_0_24px_-4px_rgba(251,191,36,0.25)] scale-[1.02]"
                    : "border-white/10 bg-white/[0.07] opacity-60"
                )}
                style={!starredId ? { opacity: 1 } : undefined}
              >
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className={cn("pb-3", isStarred && "pb-4")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className={cn("h-5 w-5", isStarred ? "text-amber-400" : "text-primary")} />
                        <CardTitle className={cn(isStarred ? "text-xl" : "text-lg")}>
                          {course.course_name}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{courseChapters.length} ch</Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStar(course.id); }}
                          className={cn(
                            "p-1 rounded-md transition-colors",
                            isStarred
                              ? "text-amber-400 hover:text-amber-300"
                              : "text-muted-foreground/40 hover:text-amber-400/70"
                          )}
                          title={isStarred ? "Unstar this course" : "Star as focus course"}
                        >
                          <Star className={cn("h-4 w-4", isStarred && "fill-amber-400")} />
                        </button>
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
