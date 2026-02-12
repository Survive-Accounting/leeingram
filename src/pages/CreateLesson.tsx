import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { QUESTIONNAIRE_QUESTIONS } from "@/lib/constants";
import { Link } from "react-router-dom";

export default function CreateLesson() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [courseId, setCourseId] = useState(searchParams.get("courseId") || "");
  const [chapterId, setChapterId] = useState(searchParams.get("chapterId") || "");
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<string[]>(QUESTIONNAIRE_QUESTIONS.map(() => ""));

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("course_id", courseId)
        .order("chapter_number");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create lesson
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .insert({ course_id: courseId, chapter_id: chapterId, lesson_title: title })
        .select()
        .single();
      if (lessonError) throw lessonError;

      // Create lesson plan with questionnaire answers
      const questionnaireObj: Record<string, string> = {};
      QUESTIONNAIRE_QUESTIONS.forEach((q, i) => {
        questionnaireObj[q] = answers[i];
      });

      const { error: planError } = await supabase.from("lesson_plans").insert({
        lesson_id: lesson.id,
        questionnaire_answers: questionnaireObj,
      });
      if (planError) throw planError;

      return lesson;
    },
    onSuccess: (lesson) => {
      toast.success("Lesson created!");
      navigate(`/lesson/${lesson.id}`);
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const canProceedStep1 = courseId && chapterId && title.trim();
  const canSubmit = answers[0]?.trim(); // At least first question answered

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Create Lesson</h1>

      {step === 1 && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Step 1: Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={(v) => { setCourseId(v); setChapterId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chapter</Label>
              <Select value={chapterId} onValueChange={setChapterId} disabled={!courseId}>
                <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
                <SelectContent>
                  {chapters?.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      Ch {ch.chapter_number} — {ch.chapter_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lesson Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Adjusting Entries Walkthrough" />
            </div>
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Next: Questionnaire
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Step 2: Lesson Planning Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {QUESTIONNAIRE_QUESTIONS.map((q, i) => (
              <div key={i} className="space-y-1.5">
                <Label className="text-sm font-medium">{q}</Label>
                <Textarea
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  rows={3}
                  placeholder="Your answer..."
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Lesson"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
