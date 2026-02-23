import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Sparkles, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterId: string;
  courseId: string;
  chapterNumber: number;
  targetLessons: number;
}

export function LessonsTab({ chapterId, courseId, chapterNumber, targetLessons }: Props) {
  const qc = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);

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

  const { data: problems } = useQuery({
    queryKey: ["problem-pairs", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problem_pairs")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("type")
        .order("number");
      if (error) throw error;
      return data;
    },
  });

  const autoCreateMutation = useMutation({
    mutationFn: async () => {
      const count = targetLessons;
      const inserts = Array.from({ length: count }, (_, i) => ({
        chapter_id: chapterId,
        course_id: courseId,
        lesson_order: i + 1,
        lesson_title: `Lesson ${i + 1}`,
      }));
      const { error } = await supabase.from("lessons").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-lessons", chapterId] });
      toast.success(`Created ${targetLessons} lessons`);
    },
    onError: (e) => toast.error(e.message),
  });

  const statusFlags = [
    { key: "status_planned", label: "Planned" },
    { key: "status_ready_to_film", label: "Ready" },
    { key: "status_filmed", label: "Filmed" },
    { key: "status_posted", label: "Posted" },
    { key: "status_quiz_created", label: "Quiz" },
  ] as const;

  const toggleStatus = useMutation({
    mutationFn: async ({ lessonId, field, value }: { lessonId: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("lessons").update({ [field]: value }).eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-lessons", chapterId] }),
  });

  return (
    <div>
      {!lessons?.length ? (
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground mb-3">No lessons yet.</p>
          <Button onClick={() => autoCreateMutation.mutate()} disabled={autoCreateMutation.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Auto-create {targetLessons} Lessons
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="outline" onClick={() => autoCreateMutation.mutate()} disabled={autoCreateMutation.isPending}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add More
            </Button>
          </div>
          {lessons.map((lesson) => (
            <Card
              key={lesson.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedLesson(lesson.id)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                  {lesson.lesson_order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lesson.lesson_title}</p>
                  <p className="text-[10px] text-muted-foreground">{lesson.topic || "No topic set"}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {statusFlags.map((sf) => (
                    <div
                      key={sf.key}
                      className="flex flex-col items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={!!(lesson as any)[sf.key]}
                        onCheckedChange={(v) =>
                          toggleStatus.mutate({ lessonId: lesson.id, field: sf.key, value: !!v })
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-[8px] text-muted-foreground">{sf.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lesson Detail Dialog */}
      {selectedLesson && (
        <LessonDetailDialog
          lessonId={selectedLesson}
          chapterId={chapterId}
          problems={problems ?? []}
          onClose={() => setSelectedLesson(null)}
        />
      )}
    </div>
  );
}

function LessonDetailDialog({
  lessonId,
  chapterId,
  problems,
  onClose,
}: {
  lessonId: string;
  chapterId: string;
  problems: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: lesson } = useQuery({
    queryKey: ["lesson-detail", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*").eq("id", lessonId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assignedPairs } = useQuery({
    queryKey: ["lesson-assigned-pairs", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_problem_pairs")
        .select("*, problem_pairs(*)")
        .eq("lesson_id", lessonId)
        .order("sequence_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: outputs } = useQuery({
    queryKey: ["lesson-outputs", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_outputs")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("generated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const updateLesson = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("lessons").update(updates).eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-detail", lessonId] });
      qc.invalidateQueries({ queryKey: ["workspace-lessons", chapterId] });
    },
  });

  const assignProblem = useMutation({
    mutationFn: async (problemPairId: string) => {
      const currentCount = assignedPairs?.length ?? 0;
      const { error } = await supabase.from("lesson_problem_pairs").insert({
        lesson_id: lessonId,
        problem_pair_id: problemPairId,
        sequence_order: currentCount + 1,
      });
      if (error) throw error;
      // Mark as assigned
      await supabase.from("problem_pairs").update({ status: "assigned" }).eq("id", problemPairId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-assigned-pairs", lessonId] });
      qc.invalidateQueries({ queryKey: ["problem-pairs", chapterId] });
      qc.invalidateQueries({ queryKey: ["lesson-problem-pairs", chapterId] });
    },
  });

  const unassignProblem = useMutation({
    mutationFn: async (pairId: string) => {
      const { error } = await supabase
        .from("lesson_problem_pairs")
        .delete()
        .eq("lesson_id", lessonId)
        .eq("problem_pair_id", pairId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-assigned-pairs", lessonId] });
      qc.invalidateQueries({ queryKey: ["lesson-problem-pairs", chapterId] });
    },
  });

  const generateOutputs = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-outputs", {
        body: {
          lessonId,
          topic: lesson?.topic ?? "",
          conceptExplanation: lesson?.concept_explanation ?? "",
          mustMemorize: lesson?.must_memorize ?? "",
          shortcuts: lesson?.shortcuts ?? "",
          traps: lesson?.traps ?? "",
          problems: assignedPairs?.map((ap: any) => ({
            code: ap.problem_pairs?.problem_code,
            description: ap.problem_pairs?.description,
            notes: ap.problem_pairs?.notes,
          })) ?? [],
        },
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["lesson-outputs", lessonId] });
      toast.success("Outputs generated!");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const assignedIds = new Set(assignedPairs?.map((ap: any) => ap.problem_pair_id) ?? []);
  const unassigned = problems.filter((p) => !assignedIds.has(p.id));

  if (!lesson) return null;

  const fields = [
    { key: "lesson_title", label: "Title", type: "input" },
    { key: "topic", label: "Topic", type: "input" },
    { key: "concept_explanation", label: "Concept Explanation", type: "textarea" },
    { key: "must_memorize", label: "Must Memorize", type: "textarea" },
    { key: "shortcuts", label: "Shortcuts / Mnemonics", type: "textarea" },
    { key: "traps", label: "Common Traps", type: "textarea" },
  ] as const;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lesson {lesson.lesson_order}: {lesson.lesson_title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "col-span-2" : ""}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === "input" ? (
                  <Input
                    defaultValue={(lesson as any)[f.key] ?? ""}
                    onBlur={(e) => updateLesson.mutate({ [f.key]: e.target.value })}
                    className="h-9"
                  />
                ) : (
                  <Textarea
                    defaultValue={(lesson as any)[f.key] ?? ""}
                    onBlur={(e) => updateLesson.mutate({ [f.key]: e.target.value })}
                    className="min-h-[60px] text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Assign Problems */}
          <div>
            <p className="text-sm font-medium mb-2">Assigned Problems</p>
            {assignedPairs?.length ? (
              <div className="space-y-1 mb-2">
                {assignedPairs.map((ap: any) => (
                  <div key={ap.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono font-medium">{ap.problem_pairs?.problem_code}</span>
                      <span className="text-xs text-muted-foreground">{ap.problem_pairs?.description || ""}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-destructive hover:text-destructive"
                      onClick={() => unassignProblem.mutate(ap.problem_pair_id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-2">No problems assigned yet.</p>
            )}

            {unassigned.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {unassigned.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-mono"
                    onClick={() => assignProblem.mutate(p.id)}
                  >
                    + {p.problem_code}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Generate & Outputs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Generated Outputs</p>
              <Button size="sm" onClick={generateOutputs} disabled={generating}>
                {generating ? (
                  <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="mr-1 h-3.5 w-3.5" /> Generate Outputs</>
                )}
              </Button>
            </div>

            {outputs ? (
              <OutputsDisplay outputs={outputs} lessonId={lessonId} />
            ) : (
              <p className="text-xs text-muted-foreground">No outputs yet. Fill in lesson details and assign problems, then generate.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutputsDisplay({ outputs, lessonId }: { outputs: any; lessonId: string }) {
  const qc = useQueryClient();

  const updateOutput = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("lesson_outputs").update(updates).eq("id", outputs.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lesson-outputs", lessonId] }),
  });

  const sections = [
    { key: "lesson_summary", label: "Lesson Summary" },
    { key: "rewritten_exam_problems", label: "Rewritten Exam Problems" },
    { key: "problem_breakdown", label: "Problem Breakdown" },
    { key: "video_outline", label: "Video Outline" },
    { key: "canva_slide_blocks", label: "Canva Slide Blocks" },
    { key: "slide_script", label: "Slide Script" },
  ];

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div key={s.key}>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">{s.label}</Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => {
                navigator.clipboard.writeText(outputs[s.key] || "");
                toast.success("Copied!");
              }}
            >
              Copy
            </Button>
          </div>
          <Textarea
            defaultValue={outputs[s.key] || ""}
            onBlur={(e) => updateOutput.mutate({ [s.key]: e.target.value })}
            className="min-h-[80px] text-xs font-mono"
          />
        </div>
      ))}
    </div>
  );
}
