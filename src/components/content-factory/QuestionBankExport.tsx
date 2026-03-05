import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface QuestionBankExportProps {
  exportSetId: string;
  exportSetName: string;
}

type ExportQuestion = {
  id: string;
  order_index: number;
  banked_questions: {
    id: string;
    question_type: string;
    question_text: string;
    answer_a: string;
    answer_b: string;
    answer_c: string;
    answer_d: string;
    answer_e: string;
    correct_answer: string;
    short_explanation: string;
    review_status: string;
    difficulty: number;
    assets: {
      id: string;
      asset_code: string;
      exercise_code: string;
      chapter_number: number;
      video_status: string;
      course_id: string;
      courses: {
        code: string;
      };
    };
  };
};

function escapeCSV(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function padChapter(n: number): string {
  return String(n).padStart(2, "0");
}

function formatQuestionType(qt: string): string {
  // banked_question_type enum values like JE_MC, CALC_MC, etc.
  return qt;
}

function buildGroup(courseCode: string, chapterNumber: number, questionType: string): string {
  return `${courseCode}_CH${padChapter(chapterNumber)}_${formatQuestionType(questionType)}`;
}

function buildQuestionId(
  courseCode: string,
  chapterNumber: number,
  exerciseCode: string,
  questionType: string,
  seq: number
): string {
  return `[${courseCode}_CH${padChapter(chapterNumber)}_${exerciseCode}_${questionType}_${String(seq).padStart(2, "0")}]`;
}

function getExplanation(videoStatus: string): string {
  if (videoStatus === "published") {
    return "Full walkthrough video available in lesson.";
  }
  return "Walkthrough video coming soon.";
}

export function QuestionBankExport({ exportSetId, exportSetName }: QuestionBankExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const { data: questions, isLoading } = useQuery({
    queryKey: ["export-set-questions", exportSetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_set_questions")
        .select(`
          id,
          order_index,
          banked_questions (
            id,
            question_type,
            question_text,
            answer_a,
            answer_b,
            answer_c,
            answer_d,
            answer_e,
            correct_answer,
            short_explanation,
            review_status,
            difficulty,
            assets (
              id,
              asset_code,
              exercise_code,
              chapter_number,
              video_status,
              course_id,
              courses (
                code
              )
            )
          )
        `)
        .eq("export_set_id", exportSetId)
        .order("order_index");
      if (error) throw error;
      return data as unknown as ExportQuestion[];
    },
    enabled: !!exportSetId,
  });

  const approvedQuestions = questions?.filter(
    (q) => q.banked_questions?.review_status === "approved"
  ) ?? [];

  const unapprovedCount = (questions?.length ?? 0) - approvedQuestions.length;

  const handleExport = () => {
    if (!approvedQuestions.length) return;
    setIsExporting(true);

    try {
      // Build sequence counters per asset+type combo
      const seqCounters: Record<string, number> = {};

      const header = "Group,Question Text,Answer 1,Answer 2,Answer 3,Answer 4,Answer 5,Correct Answer,Explanation";

      const rows = approvedQuestions.map((q) => {
        const bq = q.banked_questions;
        const asset = bq.assets;
        const courseCode = asset.courses?.code || "UNKNOWN";
        const chapterNum = asset.chapter_number;
        const exerciseCode = asset.exercise_code;
        const questionType = bq.question_type;

        // Track sequence per asset+type
        const seqKey = `${asset.id}_${questionType}`;
        seqCounters[seqKey] = (seqCounters[seqKey] || 0) + 1;
        const seq = seqCounters[seqKey];

        const group = buildGroup(courseCode, chapterNum, questionType);
        const questionId = buildQuestionId(courseCode, chapterNum, exerciseCode, questionType, seq);
        const questionText = `${questionId}\n\n${bq.question_text}`;
        const explanation = getExplanation(asset.video_status);

        return [
          group,
          questionText,
          bq.answer_a,
          bq.answer_b,
          bq.answer_c,
          bq.answer_d,
          bq.answer_e,
          bq.correct_answer,
          explanation,
        ]
          .map(escapeCSV)
          .join(",");
      });

      const csv = header + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      // Derive file name from first question's course/chapter
      let fileName = "QUESTION_BANK.csv";
      if (approvedQuestions.length > 0) {
        const first = approvedQuestions[0].banked_questions.assets;
        const code = first.courses?.code || "EXPORT";
        fileName = `${code}_CH${padChapter(first.chapter_number)}_QUESTION_BANK.csv`;
      }

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${approvedQuestions.length} approved questions`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading questions…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            Questions ({approvedQuestions.length} approved)
          </p>
          {unapprovedCount > 0 && (
            <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-400/30">
              <AlertCircle className="h-3 w-3 mr-0.5" />
              {unapprovedCount} not approved
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleExport}
          disabled={isExporting || !approvedQuestions.length}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Exporting…
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </>
          )}
        </Button>
      </div>

      {!questions?.length ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No questions in this set yet.</p>
          <p className="text-xs mt-1">Add approved banked questions to export.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {questions.map((q) => {
            const bq = q.banked_questions;
            const isApproved = bq?.review_status === "approved";
            return (
              <div
                key={q.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  isApproved
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-yellow-500/20 bg-yellow-500/[0.03] opacity-60"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {bq?.question_type}
                    </Badge>
                    <Badge
                      variant={isApproved ? "default" : "outline"}
                      className={`text-[10px] px-1.5 py-0 ${
                        isApproved
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                          : "text-yellow-400 border-yellow-400/30"
                      }`}
                    >
                      {bq?.review_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">
                    {bq?.question_text}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {bq?.assets?.asset_code} · Difficulty {bq?.difficulty}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
