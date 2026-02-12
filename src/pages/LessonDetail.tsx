import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, FileSpreadsheet, ExternalLink, Loader2, Send, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { LESSON_STATUSES, QUESTIONNAIRE_QUESTIONS } from "@/lib/constants";
import type { LessonStatus } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type LessonStatusEnum = Database["public"]["Enums"]["lesson_status"];

export default function LessonDetail() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ lessonPlan: "", problemList: "", videoOutline: "" });

  const { data: lesson } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, chapters(*), courses(*)")
        .eq("id", lessonId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  const { data: lessonPlan } = useQuery({
    queryKey: ["lesson-plan", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("*")
        .eq("lesson_id", lessonId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  const { data: googleSheet } = useQuery({
    queryKey: ["google-sheet", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_sheets")
        .select("*")
        .eq("lesson_id", lessonId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  const { data: styleGuide } = useQuery({
    queryKey: ["style-guide"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("style_guide")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      return data?.style_guide || "";
    },
    enabled: !!session,
  });

  const { data: previousPlans } = useQuery({
    queryKey: ["previous-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_plans")
        .select("generated_lesson_plan, lesson_id, lessons(lesson_title)")
        .not("generated_lesson_plan", "is", null)
        .order("created_at", { ascending: false })
        .limit(2);
      return data?.map((p: any) => ({
        title: p.lessons?.lesson_title || "",
        lessonPlan: p.generated_lesson_plan || "",
      })) || [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: LessonStatusEnum) => {
      const { error } = await supabase
        .from("lessons")
        .update({ lesson_status: newStatus })
        .eq("id", lessonId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      toast.success("Status updated");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (refinePrompt?: string) => {
      const body: any = {
        lessonTitle: lesson!.lesson_title,
        questionnaire: lessonPlan!.questionnaire_answers,
        chapterId: lesson!.chapter_id,
        styleGuide: styleGuide || "",
        previousPlans: previousPlans || [],
      };

      if (refinePrompt) {
        body.refinementPrompt = refinePrompt;
        body.currentPlan = {
          lessonPlan: lessonPlan!.generated_lesson_plan,
          problemList: lessonPlan!.generated_problem_list,
          videoOutline: lessonPlan!.generated_video_outline,
        };
      }

      const response = await supabase.functions.invoke("generate-lesson-plan", { body });
      if (response.error) throw new Error(response.error.message);
      const result = response.data;

      // Save refinement history
      const history = (lessonPlan as any)?.refinement_history || [];
      const newHistory = refinePrompt
        ? [...history, { prompt: refinePrompt, timestamp: new Date().toISOString() }]
        : history;

      const { error } = await supabase
        .from("lesson_plans")
        .update({
          generated_lesson_plan: result.lessonPlan,
          generated_problem_list: result.problemList,
          generated_video_outline: result.videoOutline,
          refinement_history: newHistory,
        })
        .eq("id", lessonPlan!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plan", lessonId] });
      setRefinementPrompt("");
      toast.success("Lesson plan updated!");
    },
    onError: (e) => toast.error("Generation failed: " + e.message),
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lesson_plans")
        .update({
          generated_lesson_plan: editValues.lessonPlan,
          generated_problem_list: editValues.problemList,
          generated_video_outline: editValues.videoOutline,
        })
        .eq("id", lessonPlan!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plan", lessonId] });
      setEditingSection(null);
      toast.success("Saved!");
    },
  });

  const sheetMutation = useMutation({
    mutationFn: async () => {
      const placeholderUrl = `https://docs.google.com/spreadsheets/d/placeholder_${Date.now()}/edit`;
      const { error } = await supabase.from("google_sheets").insert({
        lesson_id: lessonId!,
        sheet_url: placeholderUrl,
      });
      if (error) throw error;

      await supabase
        .from("lessons")
        .update({ lesson_status: "Sheet Generated" as LessonStatusEnum })
        .eq("id", lessonId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-sheet", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      toast.success("Google Sheet placeholder created!");
    },
  });

  const startEditing = () => {
    setEditValues({
      lessonPlan: lessonPlan?.generated_lesson_plan || "",
      problemList: lessonPlan?.generated_problem_list || "",
      videoOutline: lessonPlan?.generated_video_outline || "",
    });
    setEditingSection("all");
  };

  if (!lesson || !lessonPlan) {
    return (
      <AppLayout>
        <div className="text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  const chapter = lesson.chapters as { chapter_name: string; chapter_number: number; id: string };
  const course = lesson.courses as { course_name: string };
  const answers = lessonPlan.questionnaire_answers as Record<string, string>;
  const currentStatusIndex = LESSON_STATUSES.indexOf(lesson.lesson_status as LessonStatus);
  const hasGenerated = !!lessonPlan.generated_lesson_plan;

  return (
    <AppLayout>
      <div className="mb-4">
        <Link
          to={`/chapter/${chapter.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Ch {chapter.chapter_number}
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {course.course_name} › Ch {chapter.chapter_number}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{lesson.lesson_title}</h1>
        </div>
        <Select
          value={lesson.lesson_status}
          onValueChange={(v) => statusMutation.mutate(v as LessonStatusEnum)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LESSON_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline Indicator */}
      <div className="mb-6 flex gap-1">
        {LESSON_STATUSES.map((s, i) => (
          <div
            key={s}
            className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${
              i <= currentStatusIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Questionnaire Answers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Questionnaire Answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {QUESTIONNAIRE_QUESTIONS.map((q) => (
              <div key={q}>
                <p className="text-xs font-medium text-muted-foreground">{q}</p>
                <p className="mt-0.5 text-sm text-foreground">{answers[q] || "—"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Generated Content */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">AI Lesson Plan</CardTitle>
              <div className="flex gap-2">
                {hasGenerated && !editingSection && (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                {editingSection && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditingSection(null)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => saveEditMutation.mutate()} disabled={saveEditMutation.isPending}>
                      <Save className="mr-1 h-3.5 w-3.5" /> Save
                    </Button>
                  </>
                )}
                {!editingSection && (
                  <Button
                    size="sm"
                    onClick={() => generateMutation.mutate(undefined)}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="mr-1 h-3.5 w-3.5" /> {hasGenerated ? "Regenerate" : "Generate"}</>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {hasGenerated ? (
                editingSection ? (
                  <>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">LESSON SUMMARY</p>
                      <Textarea
                        value={editValues.lessonPlan}
                        onChange={(e) => setEditValues((v) => ({ ...v, lessonPlan: e.target.value }))}
                        rows={8}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">PROBLEM BREAKDOWN</p>
                      <Textarea
                        value={editValues.problemList}
                        onChange={(e) => setEditValues((v) => ({ ...v, problemList: e.target.value }))}
                        rows={8}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">VIDEO OUTLINE</p>
                      <Textarea
                        value={editValues.videoOutline}
                        onChange={(e) => setEditValues((v) => ({ ...v, videoOutline: e.target.value }))}
                        rows={8}
                        className="text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">LESSON SUMMARY</p>
                      <p className="whitespace-pre-wrap text-sm">{lessonPlan.generated_lesson_plan}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">PROBLEM BREAKDOWN</p>
                      <p className="whitespace-pre-wrap text-sm">{lessonPlan.generated_problem_list}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">VIDEO OUTLINE</p>
                      <p className="whitespace-pre-wrap text-sm">{lessonPlan.generated_video_outline}</p>
                    </div>
                  </>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click "Generate" to create an AI lesson plan from your questionnaire answers.
                </p>
              )}

              {/* Refinement Chat */}
              {hasGenerated && !editingSection && (
                <div className="border-t pt-4">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">REFINE THIS PLAN</p>
                  <div className="flex gap-2">
                    <Textarea
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      placeholder="e.g. Make the tone more conversational, add more emphasis on the timeline visual..."
                      rows={2}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      className="shrink-0 self-end"
                      onClick={() => generateMutation.mutate(refinementPrompt)}
                      disabled={!refinementPrompt.trim() || generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Sheet */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Google Sheet</CardTitle>
              {!googleSheet && (
                <Button size="sm" variant="outline" onClick={() => sheetMutation.mutate()} disabled={sheetMutation.isPending}>
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Generate Sheet
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {googleSheet ? (
                <a
                  href={googleSheet.sheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Sheet
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No sheet generated yet.</p>
              )}
              <p className="mt-2 text-xs italic text-muted-foreground">
                Future: will connect to Google Sheets API using a template.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
