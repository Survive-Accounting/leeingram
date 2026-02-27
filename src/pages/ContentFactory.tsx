import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, Star, ArrowRight, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useProductionSession } from "@/hooks/useProductionSession";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

const STARRED_KEY = "asset-factory-starred-course";

export default function ContentFactory() {
  const navigate = useNavigate();
  const { getSession, clearSession } = useProductionSession();
  const { workspace } = useActiveWorkspace();
  const lastSession = workspace || getSession();

  // Auto-navigate if workspace already has a chapter selected
  useEffect(() => {
    if (workspace?.chapterId) {
      navigate(`/workspace/${workspace.chapterId}`, { replace: true });
    }
  }, []);

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
        <div className="text-foreground/80">Loading...</div>
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
        <h1 className="text-2xl font-bold text-foreground">Variant Generator</h1>
        <p className="text-sm text-muted-foreground">Generate 3 exam-style Survive variants from a selected source problem.</p>
      </div>

      {/* Continue Where You Left Off */}
      {lastSession && lastSession.chapterId && (
        <Card className="mb-5 border-primary/30 bg-primary/[0.05] shadow-[0_0_20px_-6px_hsl(var(--primary)/0.2)]">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Continue Where You Left Off</CardTitle>
              <button
                onClick={() => { clearSession(); window.location.reload(); }}
                className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title="Clear last session"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{lastSession.courseName}</p>
                <p className="text-xs text-muted-foreground">
                  Ch {lastSession.chapterNumber} — {lastSession.chapterName}
                </p>
                {"lastPhase" in lastSession && (lastSession as any).lastPhase && (
                  <Badge variant="outline" className="text-[10px] mt-1">{(lastSession as any).lastPhase}</Badge>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const tab = "activeTab" in lastSession ? (lastSession as any).activeTab : "problems";
                  navigate(`/workspace/${lastSession.chapterId}?tab=${tab}`);
                }}
              >
                Resume Work <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                    ? "border-amber-400/60 bg-background/90 shadow-[0_0_24px_-4px_rgba(251,191,36,0.25)] scale-[1.02]"
                    : "border-white/15 bg-background/80 opacity-70"
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
