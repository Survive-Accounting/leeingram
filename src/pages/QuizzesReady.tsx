import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
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
import { parseJEOption, type JEOptionRow } from "@/lib/questionHtmlRenderer";

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

interface ChapterWithCourse {
  id: string;
  chapter_number: number;
  chapter_name: string;
  course_id: string;
  course_code: string;
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
  topic_id: string | null; // derived from teaching_assets
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
  topicName: string,
): string {
  return `${courseCode}-Ch${pad2(chapterNum)}-T${pad2(topicNum ?? 0)}-${slugify(topicName)}-V1`;
}

function letterToNumber(letter: string): string {
  const map: Record<string, string> = { A: "1", B: "2", C: "3", D: "4", E: "5" };
  const upper = (letter || "").trim().toUpperCase();
  return map[upper] || (/^\d+$/.test(upper) ? upper : "1");
}

/* ── HTML generators ── */
function questionHtml(text: string): string {
  return `<div style="font-family:Inter,sans-serif;font-size:15px;line-height:1.6;padding:12px 16px;border-left:4px solid #14213D;background:#f8f9fa;border-radius:4px;">${text}</div>`;
}

function feedbackHtml(questionId: string): string {
  return `<iframe src="https://learn.surviveaccounting.com/quiz-explanation/${questionId}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;overflow:hidden;"></iframe>
<script>
window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='resize'){
    var f=document.querySelector('iframe');
    if(f)f.style.height=e.data.height+'px';
  }
});
</script>`;
}

function jeChoiceHtml(rows: JEOptionRow[]): string {
  const debits = rows.filter((r) => r.side === "debit");
  const credits = rows.filter((r) => r.side === "credit");
  const ordered = [...debits, ...credits];

  const trs = ordered
    .map((r) => {
      const isCredit = r.side === "credit";
      const padStyle = isCredit ? "padding-left:20px;" : "";
      return `<tr><td style="border:1px solid #ddd;padding:8px;text-align:left;${padStyle}">${r.account_name}</td><td style="border:1px solid #ddd;padding:8px;text-align:center;width:80px;">${isCredit ? "" : "✓"}</td><td style="border:1px solid #ddd;padding:8px;text-align:center;width:80px;">${isCredit ? "✓" : ""}</td></tr>`;
    })
    .join("");

  return `<table style="border-collapse:collapse;width:100%;font-family:Inter,sans-serif;font-size:14px;"><thead><tr><th style="border:1px solid #ddd;padding:8px;text-align:left;background:#14213D;color:white;">Account</th><th style="border:1px solid #ddd;padding:8px;text-align:center;background:#14213D;color:white;width:80px;">Debit</th><th style="border:1px solid #ddd;padding:8px;text-align:center;background:#14213D;color:white;width:80px;">Credit</th></tr></thead><tbody>${trs}</tbody></table>`;
}

/* ── XLSX builder using tab-separated values for proper Excel ── */
function buildTopicXLSX(
  questions: BankedQ[],
  topicName: string,
): Blob {
  const header = [
    "Group", "Type", "Question", "CorAns",
    "Answer1", "Answer2", "Answer3", "Answer4",
    "Answer5", "Answer6", "Answer7", "Answer8", "Answer9", "Answer10",
    "CorrectExplanation", "IncorrectExplanation",
  ];

  const rows = questions.map((q) => {
    const qHtml = questionHtml(q.question_text);
    const corAns = letterToNumber(q.correct_answer);
    const fb = feedbackHtml(q.id);

    return [
      topicName,
      "TMC",
      qHtml,
      corAns,
      q.answer_a || "",
      q.answer_b || "",
      q.answer_c || "",
      q.answer_d || "",
      "", "", "", "", "", "",
      fb,
      fb,
    ];
  });

  // Build CSV with proper escaping for Excel
  const escapeCSV = (val: string): string => {
    if (!val) return "";
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };

  const csvContent = [header, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\n");

  return new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
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
function QuestionRow({ q, index }: { q: BankedQ; index: number }) {
  const isJE = q.question_type === "je_recall";
  const jeA = parseJEOption(q.answer_a);
  const jeB = parseJEOption(q.answer_b);
  const jeC = parseJEOption(q.answer_c);
  const jeD = parseJEOption(q.answer_d);
  const choiceTexts = [q.answer_a, q.answer_b, q.answer_c, q.answer_d];
  const jeParsed = [jeA, jeB, jeC, jeD];

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
        <span className="text-muted-foreground truncate">
          {q.question_text.slice(0, 80)}
          {q.question_text.length > 80 ? "…" : ""}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        <CopyBtn
          label={<><Copy className="h-3 w-3 mr-0.5" />Q</>}
          text={questionHtml(q.question_text)}
        />
        {["A", "B", "C", "D"].map((letter, i) => (
          <CopyBtn
            key={letter}
            label={letter}
            text={
              isJE && jeParsed[i]
                ? jeChoiceHtml(jeParsed[i]!)
                : choiceTexts[i] || ""
            }
            className="w-7 px-0"
          />
        ))}
        <CopyBtn
          label={<><Copy className="h-3 w-3 mr-0.5" />FB</>}
          text={feedbackHtml(q.id)}
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
              Click <strong>"Export CSV"</strong> → import the CSV into the
              Question Bank you just created
            </li>
            <li>
              For each <strong>JE question</strong> below: open that question in
              LW, then use the copy buttons to replace each answer choice with
              the HTML table version
            </li>
            <li>
              For all questions: paste <strong>Feedback HTML</strong> into both
              the Correct and Incorrect explanation fields
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
}: {
  topic: TopicWithMeta;
  questions: BankedQ[];
  courseCode: string;
  chapterNum: number;
  onImported: () => void;
}) {
  const [expanded, setExpanded] = useState(!topic.lw_imported);
  const bankName = questionBankName(
    courseCode,
    chapterNum,
    topic.topic_number,
    topic.topic_name,
  );
  const fileName = `${bankName}.csv`;

  const handleExport = () => {
    const blob = buildTopicXLSX(questions, topic.topic_name);
    saveAs(blob, fileName);
    toast.success(`Downloaded ${questions.length} questions`);
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

  return (
    <Card
      className={cn(
        "transition-all",
        topic.lw_imported && "opacity-50 bg-muted/30",
      )}
    >
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4">
          {/* Topic header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-left flex-1 min-w-0">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium text-sm text-foreground truncate">
                  {topic.topic_number != null && `T${pad2(topic.topic_number)}: `}
                  {topic.topic_name}
                </span>
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2 flex-wrap shrink-0 ml-6 sm:ml-0">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                {questions.length} approved
              </Badge>

              {topic.lw_imported && (
                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Imported
                </Badge>
              )}

              {/* Bank name copy chip */}
              <CopyBtn
                label={
                  <span className="font-mono text-[10px]">{bankName}</span>
                }
                text={bankName}
                variant="secondary"
                className="rounded-md h-6"
              />

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={handleExport}
              >
                <Download className="h-3 w-3 mr-1" /> Export CSV
              </Button>

              {!topic.lw_imported && (
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
                      <AlertDialogTitle>Mark as Imported?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Mark this topic as fully imported into LearnWorlds? The
                        card will be grayed out but still visible for reference.
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
   MAIN PAGE
   ══════════════════════════════════════════ */
export default function QuizzesReady() {
  const qc = useQueryClient();
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(),
  );

  /* ── Fetch all topics with approved questions ── */
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["quiz-deploy-data"],
    queryFn: async () => {
      // 1. Get all approved banked questions with their teaching_asset topic linkage
      const PAGE = 1000;
      let allQuestions: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("banked_questions")
          .select(
            `id, teaching_asset_id, question_type, question_text,
             answer_a, answer_b, answer_c, answer_d, answer_e,
             correct_answer, short_explanation, difficulty, review_status,
             teaching_assets!inner ( id, topic_id, chapter_id, course_id )`,
          )
          .eq("review_status", "approved")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        allQuestions = allQuestions.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      // 2. Collect unique topic IDs
      const topicIds = [
        ...new Set(
          allQuestions
            .map((q: any) => q.teaching_assets?.topic_id)
            .filter(Boolean),
        ),
      ] as string[];
      if (topicIds.length === 0) return { questions: [], topics: [], chapters: [], courses: [] };

      // 3. Fetch topics
      const { data: topics, error: tErr } = await supabase
        .from("chapter_topics")
        .select(
          "id, topic_name, topic_number, chapter_id, course_id, lw_imported, lw_imported_at, is_active",
        )
        .in("id", topicIds);
      if (tErr) throw tErr;

      // 4. Collect chapter IDs
      const chapterIds = [
        ...new Set((topics || []).map((t: any) => t.chapter_id)),
      ] as string[];

      // 5. Fetch chapters + courses
      const { data: chapters, error: cErr } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .in("id", chapterIds);
      if (cErr) throw cErr;

      const courseIds = [
        ...new Set((chapters || []).map((c: any) => c.course_id)),
      ] as string[];
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

  /* ── Build hierarchy: course → chapter → topic → questions ── */
  const hierarchy = useMemo(() => {
    const courseMap = new Map(
      (courses as any[]).map((c: any) => [c.id, c]),
    );
    const chapterMap = new Map(
      (chapters as any[]).map((c: any) => [c.id, c]),
    );

    // Map questions to topic
    const topicQMap = new Map<string, BankedQ[]>();
    for (const q of questions as any[]) {
      const topicId = q.teaching_assets?.topic_id;
      if (!topicId) continue;
      if (!topicQMap.has(topicId)) topicQMap.set(topicId, []);
      topicQMap.get(topicId)!.push({
        ...q,
        topic_id: topicId,
      });
    }

    // Group topics by chapter
    const chapterTopicMap = new Map<
      string,
      { topic: any; questions: BankedQ[] }[]
    >();
    for (const t of topics as any[]) {
      const qs = topicQMap.get(t.id);
      if (!qs || qs.length === 0) continue;
      if (!chapterTopicMap.has(t.chapter_id))
        chapterTopicMap.set(t.chapter_id, []);
      chapterTopicMap.get(t.chapter_id)!.push({ topic: t, questions: qs });
    }

    // Group chapters by course
    const courseChapterMap = new Map<
      string,
      {
        chapter: any;
        courseCode: string;
        topics: { topic: any; questions: BankedQ[] }[];
        totalApproved: number;
      }[]
    >();
    for (const [chId, topicList] of chapterTopicMap) {
      const ch = chapterMap.get(chId);
      if (!ch) continue;
      const course = courseMap.get(ch.course_id);
      const courseCode = course?.code || "COURSE";
      const totalApproved = topicList.reduce(
        (s, t) => s + t.questions.length,
        0,
      );

      if (!courseChapterMap.has(ch.course_id))
        courseChapterMap.set(ch.course_id, []);
      courseChapterMap.get(ch.course_id)!.push({
        chapter: ch,
        courseCode,
        topics: topicList.sort(
          (a, b) => (a.topic.topic_number ?? 0) - (b.topic.topic_number ?? 0),
        ),
        totalApproved,
      });
    }

    // Sort chapters by number within each course
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
    <SurviveSidebarLayout>
      <div className="space-y-5 pb-12">
        {/* Header */}
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

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        )}

        {/* Empty */}
        {!isLoading && hierarchy.size === 0 && (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <p className="text-base font-medium">No approved questions yet</p>
            <p className="text-sm">
              Review quiz questions first, then come back to deploy.
            </p>
          </div>
        )}

        {/* Course → Chapter → Topic hierarchy */}
        {!isLoading &&
          [...hierarchy.entries()].map(([courseId, chaptersInCourse]) => {
            const courseName =
              (courses as any[]).find((c: any) => c.id === courseId)
                ?.course_name || "Course";
            const courseCode =
              chaptersInCourse[0]?.courseCode || "COURSE";

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
                        {/* Chapter header */}
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
                              Ch {chapter.chapter_number}:{" "}
                              {chapter.chapter_name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{
                                borderColor: "#14213D",
                                color: "#14213D",
                              }}
                            >
                              {courseCode}
                            </Badge>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                            {chTotal} approved
                          </Badge>
                        </button>

                        {/* Topics inside chapter */}
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
    </SurviveSidebarLayout>
  );
}
