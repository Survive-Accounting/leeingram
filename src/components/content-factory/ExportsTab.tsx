import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterId: string;
  chapterNumber: number;
}

export function ExportsTab({ chapterId, chapterNumber }: Props) {
  const { data: lessons } = useQuery({
    queryKey: ["workspace-lessons", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("lesson_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: outputs } = useQuery({
    queryKey: ["all-lesson-outputs", chapterId],
    queryFn: async () => {
      if (!lessons?.length) return [];
      const ids = lessons.map((l) => l.id);
      const { data, error } = await supabase
        .from("lesson_outputs")
        .select("*")
        .in("lesson_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: !!lessons?.length,
  });

  const { data: allPairs } = useQuery({
    queryKey: ["export-lesson-pairs", chapterId],
    queryFn: async () => {
      if (!lessons?.length) return [];
      const ids = lessons.map((l) => l.id);
      const { data, error } = await supabase
        .from("lesson_problem_pairs")
        .select("*, problem_pairs(*)")
        .in("lesson_id", ids)
        .order("sequence_order");
      if (error) throw error;
      return data;
    },
    enabled: !!lessons?.length,
  });

  const getOutputs = (lessonId: string) => outputs?.find((o) => o.lesson_id === lessonId);
  const getPairs = (lessonId: string) => allPairs?.filter((p) => p.lesson_id === lessonId) ?? [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const buildMasterPlan = () => {
    if (!lessons?.length) return "";
    let plan = `CHAPTER ${chapterNumber} — MASTER PLAN\n${"=".repeat(40)}\n\n`;
    lessons.forEach((l) => {
      const lPairs = getPairs(l.id);
      const codes = lPairs.map((p: any) => p.problem_pairs?.problem_code).join(", ");
      const flags = [
        l.status_planned && "✓ Planned",
        l.status_ready_to_film && "✓ Ready",
        l.status_filmed && "✓ Filmed",
        l.status_posted && "✓ Posted",
      ].filter(Boolean).join(" | ");
      plan += `Lesson ${l.lesson_order}: ${l.lesson_title}\n`;
      plan += `  Problems: ${codes || "none"}\n`;
      plan += `  Status: ${flags || "not started"}\n\n`;
    });
    return plan;
  };

  const outputSections = [
    { key: "lesson_summary", label: "Summary" },
    { key: "rewritten_exam_problems", label: "Exam Problems" },
    { key: "problem_breakdown", label: "Breakdown" },
    { key: "video_outline", label: "Video Outline" },
    { key: "canva_slide_blocks", label: "Slide Blocks" },
    { key: "slide_script", label: "Script" },
  ];

  return (
    <div className="space-y-4">
      {/* Master Plan */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Chapter Master Plan</CardTitle>
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(buildMasterPlan())}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded p-3 max-h-60 overflow-y-auto">
            {buildMasterPlan() || "No lessons yet."}
          </pre>
        </CardContent>
      </Card>

      {/* Per-lesson exports */}
      {lessons?.map((lesson) => {
        const lo = getOutputs(lesson.id);
        return (
          <Card key={lesson.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Lesson {lesson.lesson_order}: {lesson.lesson_title}
                {lo ? (
                  <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 ml-auto">Generated</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] ml-auto">No outputs</Badge>
                )}
              </CardTitle>
            </CardHeader>
            {lo && (
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {outputSections.map((s) => (
                    <Button
                      key={s.key}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={!(lo as any)[s.key]}
                      onClick={() => copyToClipboard((lo as any)[s.key] || "")}
                    >
                      <Copy className="mr-1 h-3 w-3" /> {s.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Future placeholder */}
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <p>🔗 Push to LearnWorlds — <span className="italic">coming soon</span></p>
          <p className="text-xs mt-1">Auto-create Course Sections — <span className="italic">planned</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
