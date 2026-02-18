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
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { QUESTIONNAIRE_QUESTIONS } from "@/lib/constants";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const OUTPUT_PREVIEW = [
  {
    title: "Lesson Summary",
    description: "A concise 2–3 paragraph explanation of the topic, suitable for an instructor's reference before filming.",
  },
  {
    title: "Problem Breakdown",
    description: "A numbered list of key problems to demonstrate, with notes on what each teaches and common pitfalls.",
  },
  {
    title: "Video Outline",
    description:
      "A 5-segment structure:\n1. Concept Overview (20–30s)\n2. Show Completed Problem & Solution\n3. Rework Problems Step-by-Step\n4. Exam Tips & Shortcuts\n5. Wrap Up & Next Steps",
  },
];

export default function CreateLesson() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<"basics" | "questionnaire">("basics");
  const [courseId, setCourseId] = useState(searchParams.get("courseId") || "");
  const [chapterId, setChapterId] = useState(searchParams.get("chapterId") || "");
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<string[]>(QUESTIONNAIRE_QUESTIONS.map(() => ""));
  const [currentQ, setCurrentQ] = useState(0);

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
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .insert({ course_id: courseId, chapter_id: chapterId, lesson_title: title })
        .select()
        .single();
      if (lessonError) throw lessonError;

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

  const canProceed = courseId && chapterId && title.trim();
  const totalQuestions = QUESTIONNAIRE_QUESTIONS.length;
  const progress = ((currentQ + 1) / totalQuestions) * 100;

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Create Lesson</h1>

      {phase === "basics" && (
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
            <Button onClick={() => setPhase("questionnaire")} disabled={!canProceed}>
              Next: Questionnaire <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "questionnaire" && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Step-by-step questionnaire */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Step 2: Question {currentQ + 1} of {totalQuestions}
                  </CardTitle>
                  <button
                    onClick={() => setPhase("basics")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Back to Basics
                  </button>
                </div>
                <Progress value={progress} className="mt-3 h-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold leading-relaxed">
                    {QUESTIONNAIRE_QUESTIONS[currentQ]}
                  </Label>
                  <Textarea
                    value={answers[currentQ]}
                    onChange={(e) => {
                      const next = [...answers];
                      next[currentQ] = e.target.value;
                      setAnswers(next);
                    }}
                    rows={5}
                    placeholder="Your answer..."
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentQ((q) => q - 1)}
                    disabled={currentQ === 0}
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                  </Button>

                  {currentQ < totalQuestions - 1 ? (
                    <Button
                      size="sm"
                      onClick={() => setCurrentQ((q) => q + 1)}
                    >
                      Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => createMutation.mutate()}
                      disabled={!answers[0]?.trim() || createMutation.isPending}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      {createMutation.isPending ? "Creating..." : "Create Lesson"}
                    </Button>
                  )}
                </div>

                {/* Answer dots */}
                <div className="flex items-center justify-center gap-1.5 pt-2">
                  {QUESTIONNAIRE_QUESTIONS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQ(i)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i === currentQ
                          ? "bg-primary"
                          : answers[i]?.trim()
                          ? "bg-primary/40"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Expected output preview */}
          <div className="lg:col-span-2">
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  What you'll get
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {OUTPUT_PREVIEW.map((section) => (
                  <div key={section.title}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {section.title}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                ))}
                <div className="rounded-md border border-dashed bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground italic">
                    After creating the lesson, you'll generate the AI plan on the lesson detail page using your answers + uploaded chapter resources.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
