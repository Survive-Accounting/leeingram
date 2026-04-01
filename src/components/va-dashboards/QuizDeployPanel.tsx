import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import {
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  CheckCircle2,
  ListChecks,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboardFallback";


/* ── Types ── */
interface TopicWithMeta {
  id: string;
  topic_name: string;
  topic_number: number | null;
  chapter_id: string;
  course_id: string | null;
  lw_imported: boolean;
  lw_imported_at: string | null;
}

interface BankedQ {
  id: string;
  teaching_asset_id: string | null;
  question_type: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  answer_e: string;
  correct_answer: string;
  short_explanation: string;
  difficulty: number;
  review_status: string;
  topic_id: string | null;
}

/* ── Helpers ── */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function questionBankName(
  courseCode: string,
  chapterNum: number,
  topicNum: number | null,
  _topicName: string,
): string {
  return `${courseCode}-Ch${pad2(chapterNum)}-T${pad2(topicNum ?? 0)}-V1`;
}

function letterToNumber(letter: string): string {
  const map: Record<string, string> = { A: "1", B: "2", C: "3", D: "4", E: "5" };
  const upper = (letter || "").trim().toUpperCase();
  return map[upper] || (/^\d+$/.test(upper) ? upper : "1");
}

const BASE = "https://learn.surviveaccounting.com";

function iframeTag(path: string, height: number): string {
  return `<iframe src="${BASE}${path}" width="100%" height="${height}" frameborder="0" style="border:none;overflow:hidden;"></iframe>`;
}

/* ── XLSX builder ── */
function buildDebugJSON(
  questions: BankedQ[],
  topicName: string,
): object {
  // Derive question mix from actual data
  const jeRecallCount = questions.filter(q => q.question_type === "je_recall").length;
  const mcQuestions = questions.filter(q => q.question_type === "mc");
  // We can't perfectly distinguish calc vs conceptual from stored data, so report totals
  const calcMcCount = mcQuestions.length;
  const totalJeEntries = jeRecallCount; // approximate from output
  let mixSource: "hardcoded" | "claude" = "hardcoded";
  if (jeRecallCount === 0) mixSource = "claude";

  const questionMix = {
    je_count_approx: totalJeEntries,
    calc_mc: calcMcCount,
    conceptual_mc: 0,
    je_recall: jeRecallCount,
    total: questions.length,
    mix_source: mixSource,
    note: "calc_mc and conceptual_mc cannot be distinguished from stored data; showing combined MC count as calc_mc",
  };

  const rows = questions.map((q, i) => {
    const corAns = letterToNumber(q.correct_answer);
    const corNum = parseInt(corAns, 10);
    const isJE = q.question_type === "je_recall";
    const choiceHeight = isJE ? 150 : 60;
    const answers = [q.answer_a, q.answer_b, q.answer_c, q.answer_d];
    const correctOptionValue = answers[corNum - 1] || null;

    // Correct answer validation
    let correctAnswerValidation = "pass";
    if (corNum >= 1 && corNum <= 4) {
      if (!correctOptionValue) {
        correctAnswerValidation = `fail: answer ${corNum} is null`;
      }
    } else {
      correctAnswerValidation = `fail: correct_answer_number ${corAns} is out of range`;
    }

    const row: Record<string, any> = {
      row_index: String(i + 1),
      question_id: q.id,
      question_type: q.question_type,
      group: topicName,
      type: "TMC",
      question_text: q.question_text,
      question_iframe: iframeTag(`/quiz-question/${q.id}`, 120),
      correct_answer_number: corAns,
      correct_answer_validation: correctAnswerValidation,
      answer1_text: q.answer_a || null,
      answer1_iframe: iframeTag(`/quiz-choice/${q.id}/1`, choiceHeight),
      answer2_text: q.answer_b || null,
      answer2_iframe: iframeTag(`/quiz-choice/${q.id}/2`, choiceHeight),
      answer3_text: q.answer_c || null,
      answer3_iframe: iframeTag(`/quiz-choice/${q.id}/3`, choiceHeight),
      answer4_text: q.answer_d || null,
      answer4_iframe: iframeTag(`/quiz-choice/${q.id}/4`, choiceHeight),
      explanation_text: q.short_explanation || null,
      explanation_iframe: iframeTag(`/quiz-explanation/${q.id}`, 600),
    };

    // Flag null/empty fields
    const nullFields = Object.entries(row)
      .filter(([k, v]) => k !== "correct_answer_validation" && (v === null || v === ""))
      .map(([k]) => k);
    row.null_or_empty_fields = nullFields;

    return row;
  });

  return { question_mix: questionMix, questions: rows };
}

async function buildTopicXLSX(
  questions: BankedQ[],
  topicName: string,
): Promise<Blob> {
  const XLSX = await import("xlsx");
  const header = [
    "Group", "Type", "Question", "CorAns",
    "Answer1", "Answer2", "Answer3", "Answer4",
    "CorrectExplanation", "IncorrectExplanation",
  ];

  console.log(`[XLSX Export] Topic: "${topicName}", Questions: ${questions.length}`);
  console.log(`[XLSX Export] Question IDs:`, questions.map(q => q.id));

  const rows = questions.map((q, i) => {
    const corAns = letterToNumber(q.correct_answer);
    const questionIframe = iframeTag(`/quiz-question/${q.id}`, 120);
    const answer1 = iframeTag(`/quiz-choice/${q.id}/1`, q.question_type === "je_recall" ? 150 : 60);
    const answer2 = iframeTag(`/quiz-choice/${q.id}/2`, q.question_type === "je_recall" ? 150 : 60);
    const answer3 = iframeTag(`/quiz-choice/${q.id}/3`, q.question_type === "je_recall" ? 150 : 60);
    const answer4 = iframeTag(`/quiz-choice/${q.id}/4`, q.question_type === "je_recall" ? 150 : 60);
    const explanationIframe = iframeTag(`/quiz-explanation/${q.id}`, 600);

    // Log iframe URLs
    console.log(`[XLSX Export] Q${i + 1} (${q.id}):`, {
      type: q.question_type,
      questionUrl: `${BASE}/quiz-question/${q.id}`,
      choiceUrls: [1, 2, 3, 4].map(n => `${BASE}/quiz-choice/${q.id}/${n}`),
      explanationUrl: `${BASE}/quiz-explanation/${q.id}`,
    });

    // Log null/empty fields
    const fields = { question_text: q.question_text, answer_a: q.answer_a, answer_b: q.answer_b, answer_c: q.answer_c, answer_d: q.answer_d, explanation: q.short_explanation };
    const nullFields = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k);
    if (nullFields.length > 0) {
      console.warn(`[XLSX Export] Q${i + 1} (${q.id}) has null/empty fields:`, nullFields);
    }

    return [
      topicName, "TMC", questionIframe, corAns,
      answer1, answer2, answer3, answer4,
      explanationIframe, explanationIframe,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ── Copy Button component ── */
function CopyBtn({
  label,
  text,
  className,
  variant = "outline",
  size = "sm",
}: {
  label: React.ReactNode;
  text: string;
  className?: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        "h-7 text-[10px] px-2 rounded-full transition-all",
        copied && "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
        className,
      )}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3" /> : label}
    </Button>
  );
}

/* ── Question Row ── */
/** Check if an MC option looks like it contains explanation text instead of a short value */
function isSuspiciousOption(val: string | undefined | null): boolean {
  if (!val || val.length <= 30) return false;
  // If it starts with $ or a digit, it's likely a numeric answer
  if (/^[\$\d]/.test(val.trim())) return false;
  return true;
}

/** Check if correct_answer points to a null option */
function hasNullCorrectAnswer(q: BankedQ): boolean {
  const map: Record<string, string> = { A: q.answer_a, B: q.answer_b, C: q.answer_c, D: q.answer_d };
  const letter = (q.correct_answer || "").trim().toUpperCase();
  const val = map[letter];
  return !val || val.trim() === "";
}

function QuestionRow({ q, index }: { q: BankedQ; index: number }) {
  const isJE = q.question_type === "je_recall";

  // Only flag MC questions for suspicious options
  const suspiciousAnswers = !isJE && [q.answer_a, q.answer_b, q.answer_c, q.answer_d].some(isSuspiciousOption);
  const nullCorrect = hasNullCorrectAnswer(q);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 px-3 border-b border-border/30 last:border-0 text-xs">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">
          Q{index + 1}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 shrink-0",
            isJE ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300",
          )}
        >
          {isJE ? "JE" : "MC"}
        </Badge>
        {suspiciousAnswers && (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[9px] shrink-0">
            ⚠ Check answers
          </Badge>
        )}
        {nullCorrect && (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[9px] shrink-0">
            ⚠ Null correct answer
          </Badge>
        )}
        <span className="text-muted-foreground truncate">
          {q.question_text.slice(0, 80)}
          {q.question_text.length > 80 ? "…" : ""}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        <CopyBtn
          label={<><Copy className="h-3 w-3 mr-0.5" />Q</>}
          text={iframeTag(`/quiz-question/${q.id}`, 120)}
        />
        {["1", "2", "3", "4"].map((num, i) => (
          <CopyBtn
            key={num}
            label={["A", "B", "C", "D"][i]}
            text={iframeTag(`/quiz-choice/${q.id}/${num}`, isJE ? 150 : 60)}
            className="w-7 px-0"
          />
        ))}
        <CopyBtn
          label={<><Copy className="h-3 w-3 mr-0.5" />FB</>}
          text={iframeTag(`/quiz-explanation/${q.id}`, 600)}
        />
      </div>
    </div>
  );
}

/* ── Instructions Panel ── */
function InstructionsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1">
          <ListChecks className="h-3.5 w-3.5" />
          <span>Step-by-step instructions</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mt-2 text-xs space-y-1.5">
          <ol className="list-decimal list-inside space-y-1.5 text-foreground/80">
            <li>
              Copy the <strong>Question Bank Name</strong> above → create a new
              Question Bank in LearnWorlds with this exact name
            </li>
            <li>
              Click <strong>"Export XLSX"</strong> → import the file into the
              Question Bank you just created
            </li>
            <li>
              Verify questions render correctly in LW preview (all content loads via iframes automatically)
            </li>
            <li>
              Click <strong>"Mark as Imported"</strong> when done
            </li>
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Topic Card ── */
function TopicCard({
  topic,
  questions,
  courseCode,
  chapterNum,
  onImported,
  readOnly,
}: {
  topic: TopicWithMeta;
  questions: BankedQ[];
  courseCode: string;
  chapterNum: number;
  onImported: () => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(!topic.lw_imported);
  const bankName = questionBankName(
    courseCode,
    chapterNum,
    topic.topic_number,
    topic.topic_name,
  );
  const fileName = `${bankName}.xlsx`;

  const handleExport = async () => {
    const blob = await buildTopicXLSX(questions, topic.topic_name);
    saveAs(blob, fileName);
    toast.success(`Downloaded ${fileName}`);
  };

  const handleDebugJSON = () => {
    const debug = buildDebugJSON(questions, topic.topic_name);
    const blob = new Blob([JSON.stringify(debug, null, 2)], { type: "application/json" });
    saveAs(blob, `${bankName}_debug.json`);
    toast.success("Debug JSON downloaded");
  };

  const handleMarkImported = async () => {
    await supabase
      .from("chapter_topics")
      .update({
        lw_imported: true,
        lw_imported_at: new Date().toISOString(),
      } as any)
      .eq("id", topic.id);
    toast.success("Topic marked as imported");
    onImported();
  };

  const handleCopyBankName = async () => {
    await copyToClipboard(bankName);
    toast.success("Copied!", { duration: 1500 });
  };

  return (
    <Card
      className={cn(
        "transition-all",
        topic.lw_imported && "opacity-50 bg-muted/30",
      )}
    >
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1.5 shrink-0">
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {topic.topic_name}
                </span>
              </button>
            </CollapsibleTrigger>

            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px]">
              {questions.length} approved
            </Badge>

            {topic.lw_imported && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-[9px]">
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Imported
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* Bank name chip */}
              <button
                onClick={handleCopyBankName}
                className="text-[9px] font-mono bg-muted/50 border border-border rounded-full px-2.5 py-1 hover:bg-muted transition-colors cursor-pointer"
                title="Click to copy"
              >
                {bankName}
              </button>

              {/* Debug JSON */}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] text-muted-foreground"
                onClick={handleDebugJSON}
              >
                Debug JSON
              </Button>

              {/* Export */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={handleExport}
              >
                <Download className="h-3 w-3 mr-1" /> Export XLSX
              </Button>

              {/* Mark imported */}
              {!topic.lw_imported && !readOnly && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Imported
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Mark as fully imported?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This confirms all questions for{" "}
                        <strong>{topic.topic_name}</strong> have been imported
                        into LearnWorlds.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMarkImported}>
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Instructions */}
          {!topic.lw_imported && (
            <div className="mt-2 ml-6">
              <InstructionsPanel />
            </div>
          )}
        </div>

        {/* Question list */}
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-3">
            <div className="border border-border/50 rounded-lg overflow-hidden">
              {questions.map((q, i) => (
                <QuestionRow key={q.id} q={q} index={i} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/* ══════════════════════════════════════════
   MAIN PANEL — accepts optional chapterIds filter
   ══════════════════════════════════════════ */
interface QuizDeployPanelProps {
  /** If provided, only show topics for these chapters */
  filterChapterIds?: string[];
  /** Hide header when embedded in another page */
  hideHeader?: boolean;
  /** Read-only mode — hide "Mark Imported" */
  readOnly?: boolean;
}

export function QuizDeployPanel({ filterChapterIds, hideHeader, readOnly }: QuizDeployPanelProps) {
  const qc = useQueryClient();
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["quiz-deploy-data", filterChapterIds?.join(",") ?? "all"],
    queryFn: async () => {
      const PAGE = 1000;
      let allQuestions: any[] = [];
      let from = 0;
      while (true) {
        let query = supabase
          .from("topic_quiz_questions")
          .select(
            `id, topic_id, question_type, question_text,
             option_a, option_b, option_c, option_d,
             correct_answer, explanation_correct, review_status,
             example_asset_id, chapter_id`,
          )
          .eq("review_status", "approved");

        if (filterChapterIds && filterChapterIds.length > 0) {
          query = query.in("chapter_id", filterChapterIds);
        }

        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error) throw error;
        allQuestions = allQuestions.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      const topicIds = [
        ...new Set(allQuestions.map((q: any) => q.topic_id).filter(Boolean)),
      ] as string[];
      if (topicIds.length === 0) return { questions: allQuestions, topics: [], chapters: [], courses: [] };

      const { data: topics, error: tErr } = await supabase
        .from("chapter_topics")
        .select("id, topic_name, topic_number, chapter_id, course_id, lw_imported, lw_imported_at, is_active")
        .in("id", topicIds);
      if (tErr) throw tErr;

      const chapterIds = [...new Set((topics || []).map((t: any) => t.chapter_id))] as string[];

      const { data: chapters, error: cErr } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .in("id", chapterIds);
      if (cErr) throw cErr;

      const courseIds = [...new Set((chapters || []).map((c: any) => c.course_id))] as string[];
      const { data: courses, error: coErr } = await supabase
        .from("courses")
        .select("id, code, course_name")
        .in("id", courseIds);
      if (coErr) throw coErr;

      return {
        questions: allQuestions,
        topics: topics || [],
        chapters: chapters || [],
        courses: courses || [],
      };
    },
  });

  const { questions, topics, chapters, courses } = rawData || {
    questions: [],
    topics: [],
    chapters: [],
    courses: [],
  };

  const hierarchy = useMemo(() => {
    const courseMap = new Map((courses as any[]).map((c: any) => [c.id, c]));
    const chapterMap = new Map((chapters as any[]).map((c: any) => [c.id, c]));

    const topicQMap = new Map<string, BankedQ[]>();
    for (const q of questions as any[]) {
      const topicId = q.topic_id;
      if (!topicId) continue;
      if (!topicQMap.has(topicId)) topicQMap.set(topicId, []);
      topicQMap.get(topicId)!.push({
        id: q.id,
        teaching_asset_id: q.example_asset_id,
        question_type: q.question_type,
        question_text: q.question_text,
        answer_a: q.option_a || "",
        answer_b: q.option_b || "",
        answer_c: q.option_c || "",
        answer_d: q.option_d || "",
        answer_e: "",
        correct_answer: q.correct_answer || "",
        short_explanation: q.explanation_correct || "",
        difficulty: 0,
        review_status: q.review_status,
        topic_id: topicId,
      });
    }

    const chapterTopicMap = new Map<string, { topic: any; questions: BankedQ[] }[]>();
    for (const t of topics as any[]) {
      const qs = topicQMap.get(t.id);
      if (!qs || qs.length === 0) continue;
      if (!chapterTopicMap.has(t.chapter_id)) chapterTopicMap.set(t.chapter_id, []);
      chapterTopicMap.get(t.chapter_id)!.push({ topic: t, questions: qs });
    }

    const courseChapterMap = new Map<string, {
      chapter: any;
      courseCode: string;
      topics: { topic: any; questions: BankedQ[] }[];
      totalApproved: number;
    }[]>();
    for (const [chId, topicList] of chapterTopicMap) {
      const ch = chapterMap.get(chId);
      if (!ch) continue;
      const course = courseMap.get(ch.course_id);
      const courseCode = course?.code || "COURSE";
      const totalApproved = topicList.reduce((s, t) => s + t.questions.length, 0);

      if (!courseChapterMap.has(ch.course_id)) courseChapterMap.set(ch.course_id, []);
      courseChapterMap.get(ch.course_id)!.push({
        chapter: ch,
        courseCode,
        topics: topicList.sort((a, b) => (a.topic.topic_number ?? 0) - (b.topic.topic_number ?? 0)),
        totalApproved,
      });
    }

    for (const chs of courseChapterMap.values()) {
      chs.sort((a, b) => a.chapter.chapter_number - b.chapter.chapter_number);
    }

    return courseChapterMap;
  }, [questions, topics, chapters, courses]);

  const toggleChapter = (chId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chId)) next.delete(chId);
      else next.add(chId);
      return next;
    });
  };

  const totalApproved = (questions as any[]).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["quiz-deploy-data"] });

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5" style={{ color: "#14213D" }} />
            Quiz Deployment
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deploy approved quiz questions into LearnWorlds. {totalApproved}{" "}
            approved question{totalApproved !== 1 ? "s" : ""} ready.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {!isLoading && hierarchy.size === 0 && (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <p className="text-base font-medium">No approved questions yet</p>
          <p className="text-sm">
            Review quiz questions first, then come back to deploy.
          </p>
        </div>
      )}

      {!isLoading &&
        [...hierarchy.entries()].map(([courseId, chaptersInCourse]) => {
          const courseName =
            (courses as any[]).find((c: any) => c.id === courseId)?.course_name || "Course";
          const courseCode = chaptersInCourse[0]?.courseCode || "COURSE";

          return (
            <div key={courseId} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {courseCode} — {courseName}
              </h2>

              {chaptersInCourse.map(
                ({ chapter, topics: topicList, totalApproved: chTotal }) => {
                  const isExpanded = expandedChapters.has(chapter.id);
                  return (
                    <div
                      key={chapter.id}
                      className="border border-border rounded-xl overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/20 transition-colors"
                        onClick={() => toggleChapter(chapter.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm text-foreground">
                            Ch {chapter.chapter_number}: {chapter.chapter_name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ borderColor: "#14213D", color: "#14213D" }}
                          >
                            {courseCode}
                          </Badge>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                          {chTotal} approved
                        </Badge>
                      </button>

                      {isExpanded && (
                        <div className="p-4 space-y-3 bg-background/50">
                          {topicList.map(({ topic, questions: tQuestions }) => (
                            <TopicCard
                              key={topic.id}
                              topic={topic as TopicWithMeta}
                              questions={tQuestions}
                              courseCode={courseCode}
                              chapterNum={chapter.chapter_number}
                              onImported={refresh}
                              readOnly={readOnly}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          );
        })}
    </div>
  );
}
