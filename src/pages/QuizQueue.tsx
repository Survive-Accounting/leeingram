import { useEffect, useState, useCallback, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  parseJEOption,
  renderJEOptionHtml,
  renderFeedbackHtml,
  type JEOptionRow,
} from "@/lib/questionHtmlRenderer";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Package, Download, ExternalLink, ClipboardList, ListChecks,
  Sparkles, Eye, FileDown, AlertCircle, Loader2,
  Check, X, Pencil, CheckCheck, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ──────── Types ──────── */

interface TopicRow {
  id: string;
  topic_name: string;
  topic_number: number | null;
  is_supplementary: boolean;
  is_active: boolean;
  questionCount: number;
  approvedCount: number;
  status: "not_generated" | "needs_review" | "ready";
}

interface QuizQuestion {
  id: string;
  topic_id: string;
  chapter_id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  correct_answer: string;
  explanation_correct: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  explanation_a: string | null;
  explanation_b: string | null;
  explanation_c: string | null;
  explanation_d: string | null;
  je_accounts: any;
  je_description: string | null;
  review_status: string;
  lee_notes: string | null;
}

/* ──────── VA Placeholder ──────── */

function VaPlaceholder({ heading, body }: { heading: string; body: string }) {
  return (
    <SurviveSidebarLayout>
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="max-w-md w-full rounded-xl p-8 text-center space-y-4" style={{ backgroundColor: "#14213D" }}>
          <h2 className="text-xl font-bold text-white">{heading}</h2>
          <p className="text-sm text-white/70 leading-relaxed">{body}</p>
          <p className="text-xs text-white/40 mt-4">— Lee Ingram</p>
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}

/* ──────── Status Badge ──────── */

function QuizStatusBadge({ status }: { status: TopicRow["status"] }) {
  const map = {
    not_generated: { label: "Not Generated", cls: "bg-muted text-muted-foreground" },
    needs_review: { label: "Needs Review", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    ready: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  } as const;
  const { label, cls } = map[status];
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

/* ──────── Question Type Badge ──────── */

function QuestionTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    mc: { label: "MC", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
    true_false: { label: "T/F", cls: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
    je_recall: { label: "JE", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  };
  const { label, cls } = map[type] ?? { label: type, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{label}</Badge>;
}

/* ──────── Review Status Badge ──────── */

function ReviewStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    pending: { label: "Pending", icon: null, cls: "bg-muted text-muted-foreground" },
    approved: { label: "Approved", icon: <Check className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    rejected: { label: "Rejected", icon: <X className="h-3 w-3" />, cls: "bg-destructive/15 text-destructive border-destructive/30" },
    edited: { label: "Edited", icon: <Pencil className="h-3 w-3" />, cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  };
  const { label, icon, cls } = map[status] ?? map.pending;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${cls}`}>
      {icon}{label}
    </Badge>
  );
}

/* ──────── CSV Export Helpers ──────── */

function buildQuizFilename(courseCode?: string, chapterNumber?: number, topicNumber?: number, topicName?: string): string {
  const cc = (courseCode || "COURSE").toUpperCase();
  const ch = String(chapterNumber ?? 0).padStart(2, "0");
  const tn = String(topicNumber ?? 0).padStart(2, "0");
  const slug = (topicName || "topic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${cc}-Ch${ch}-T${tn}-${slug}-V1.csv`;
}

/* ──────── CSV Export Helper ──────── */

function buildLwCsv(questions: QuizQuestion[], topicName: string, opts?: { chapterName?: string; courseCode?: string; chapterNumber?: number; topicNumber?: number }): string {
  const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";
  const bankName = buildQuizFilename(opts?.courseCode, opts?.chapterNumber, opts?.topicNumber, topicName).replace(/\.csv$/, "");

  const headers = [
    "Group", "Type", "Question", "CorAns",
    "Answer1", "Answer2", "Answer3", "Answer4",
    "CorrectExplanation", "IncorrectExplanation",
    "QuestionBankName",
  ];

  const esc = (v: string) => {
    if (!v) return "";
    if (v.includes('"') || v.includes(",") || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const paste = (url: string) => `\n---\n📋 PASTE HTML: ${url}`;

  // Setup instructions row
  const setupRow = [
    "== SETUP INSTRUCTIONS ==",
    "— Step 1: Import this CSV into LW to create quiz structure",
    "— Step 2: For each question, click Edit in LW → click </> in each field → paste the iframe HTML shown below that field",
    "— Step 3: Paste the quiz URL back into the Quiz Queue once live",
    `— Questions: ${questions.length} | Topic: ${topicName} | Chapter: ${opts?.chapterName ?? ""}`,
    "", "", "", "", "", "",
  ].map(esc).join(",");

  const rows = questions.map((q) => {
    const qUrl = `${STUDENT_BASE_URL}/quiz-question/${q.id}`;
    const expUrl = `${STUDENT_BASE_URL}/quiz-explanation/${q.id}`;
    const ansUrl = (key: string) => `${STUDENT_BASE_URL}/quiz-answer/${q.id}/${key}`;

    const correctExp = (q.explanation_correct || "") + paste(expUrl);
    const incorrectExp = `Same HTML works for both:${paste(expUrl)}`;

    if (q.question_type === "true_false") {
      // Legacy support for existing T/F questions
      const corAns = q.correct_answer === "a" ? "True" : "False";
      return [
        topicName, "True/False",
        q.question_text + paste(qUrl),
        corAns,
        `True${paste(ansUrl("true"))}`,
        `False${paste(ansUrl("false"))}`,
        "", "",
        correctExp, incorrectExp, bankName,
      ].map(esc).join(",");
    }

    if (q.question_type === "je_recall") {
      const accounts = Array.isArray(q.je_accounts) ? q.je_accounts : [];
      const correctText = q.correct_answer || accounts.map(
        (a: any) => `${a.side === "debit" ? "DR" : "CR"} ${a.account_name}`
      ).join(" / ");

      const wrong1 = accounts.map(
        (a: any) => `${a.side === "debit" ? "CR" : "DR"} ${a.account_name}`
      ).join(" / ");
      const wrong2 = accounts.length > 1
        ? `DR ${accounts[0]?.account_name} / DR ${accounts[1]?.account_name}`
        : "DR " + (accounts[0]?.account_name ?? "Unknown");
      const wrong3 = accounts.length > 1
        ? `CR ${accounts[0]?.account_name} / CR ${accounts[1]?.account_name}`
        : "CR " + (accounts[0]?.account_name ?? "Unknown");

      const qText = (q.je_description || q.question_text) +
        " — Which of the following correctly records this journal entry?" + paste(qUrl);

      return [
        topicName, "Multiple Choice", qText, correctText,
        `Correct Answer: ${correctText}${paste(ansUrl("a"))}`,
        `${wrong1}${paste(ansUrl("b"))}`,
        `${wrong2}${paste(ansUrl("c"))}`,
        `${wrong3}${paste(ansUrl("d"))}`,
        correctExp, incorrectExp, bankName,
      ].map(esc).join(",");
    }

    // MC
    const optMap: Record<string, string | null> = {
      a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d,
    };
    const corAns = optMap[q.correct_answer] ?? q.correct_answer;

    return [
      topicName, "Multiple Choice",
      q.question_text + paste(qUrl),
      corAns,
      `${q.option_a ?? ""}${paste(ansUrl("a"))}`,
      `${q.option_b ?? ""}${paste(ansUrl("b"))}`,
      `${q.option_c ?? ""}${paste(ansUrl("c"))}`,
      `${q.option_d ?? ""}${paste(ansUrl("d"))}`,
      correctExp, incorrectExp, bankName,
    ].map(esc).join(",");
  });

  return [headers.join(","), setupRow, ...rows].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ──────── Student Preview Section ──────── */

function PreviewIframe({ src, height, greenBorder }: { src: string; height: number; greenBorder?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative" style={{ height }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md" style={{ background: "#f8fafc" }}>
          <span className="text-[11px] text-muted-foreground animate-pulse">Loading preview…</span>
        </div>
      )}
      <iframe
        src={src}
        width="100%"
        height={height}
        scrolling="no"
        onLoad={() => setLoaded(true)}
        className="rounded-md"
        style={{
          border: greenBorder ? "2px solid #16a34a" : "1px solid #e2e8f0",
          borderRadius: 6,
          display: loaded ? "block" : "hidden",
        }}
      />
    </div>
  );
}

function StudentPreviewSection({ question: q }: { question: QuizQuestion }) {
  const [expanded, setExpanded] = useState(false);
  const BASE = window.location.origin;

  const optMap: Record<string, string | null> = {
    a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d,
  };

  return (
    <div className="pt-2 space-y-2">
      <div className="border-t border-border pt-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left text-[10px] font-medium px-2 py-1.5 rounded border border-border hover:bg-muted/50 transition-colors"
          style={{ color: "#64748b" }}
        >
          {expanded ? "▼ Hide Student Preview" : "▶ Show Student Preview"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 pl-1">
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
            STUDENT PREVIEW
          </p>

          {/* Part 1 — Question Preview (inline) */}
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground">Question</p>
            <div className="rounded border border-border p-3 bg-white text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {q.question_text}
            </div>
          </div>

          {/* Part 2 — Answer Choice Previews (inline) */}
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground">Answer Choices</p>

            {q.question_type === "mc" && (
              <div className="grid grid-cols-2 gap-2">
                {(["a", "b", "c", "d"] as const).map((k) => {
                  const isCorrect = q.correct_answer === k;
                  return (
                    <div
                      key={k}
                      className="rounded border p-2 bg-white text-xs text-slate-700"
                      style={{
                        borderColor: isCorrect ? "#16a34a" : "#e2e8f0",
                        borderWidth: isCorrect ? 2 : 1,
                      }}
                    >
                      <span className={`font-bold mr-1 ${isCorrect ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {k.toUpperCase()}{isCorrect ? " ✓" : ""}
                      </span>
                      {optMap[k] || "—"}
                    </div>
                  );
                })}
              </div>
            )}

            {q.question_type === "true_false" && (
              <div className="grid grid-cols-2 gap-2">
                {(["a", "b"] as const).map((k) => {
                  const label = k === "a" ? "True" : "False";
                  const isCorrect = q.correct_answer === k;
                  return (
                    <div
                      key={k}
                      className="rounded border p-2 bg-white text-xs text-slate-700 text-center font-medium"
                      style={{
                        borderColor: isCorrect ? "#16a34a" : "#e2e8f0",
                        borderWidth: isCorrect ? 2 : 1,
                      }}
                    >
                      {label}{isCorrect ? " ✓" : ""}
                    </div>
                  );
                })}
              </div>
            )}

            {q.question_type === "je_recall" && (
              <div className="space-y-2">
                {(["a", "b", "c", "d"] as const).map((k, i) => {
                  const isCorrect = q.correct_answer === k;
                  return (
                    <div
                      key={k}
                      className="rounded border p-2 bg-white text-xs text-slate-700"
                      style={{
                        borderColor: isCorrect ? "#16a34a" : "#e2e8f0",
                        borderWidth: isCorrect ? 2 : 1,
                      }}
                    >
                      <span className={`font-bold mr-1 ${isCorrect ? "text-emerald-600" : "text-muted-foreground"}`}>
                        Choice {i + 1}{isCorrect ? " ✓" : ""}
                      </span>
                      {optMap[k] || "—"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Part 3 — Feedback Preview (iframe — this route exists) */}
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground">Feedback (shown after any answer)</p>
            <PreviewIframe
              src={`${BASE}/quiz-explanation/${q.id}`}
              height={400}
            />
            <p className="text-[10px] text-muted-foreground italic">
              This same feedback appears for both correct and incorrect answers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────── Review Drawer ──────── */

function QuizReviewDrawer({
  open,
  onOpenChange,
  topicId,
  topicName,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  topicId: string;
  topicName: string;
  onUpdated: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusIdx, setFocusIdx] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<QuizQuestion>>({});
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("topic_quiz_questions")
      .select("*")
      .eq("topic_id", topicId)
      .order("question_number", { ascending: true });
    setQuestions((data as unknown as QuizQuestion[]) ?? []);
    setLoading(false);
  }, [topicId]);

  useEffect(() => {
    if (open && topicId) loadQuestions();
  }, [open, topicId, loadQuestions]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (editingId || rejectingId) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((prev) => {
          const next = Math.min(prev + 1, questions.length - 1);
          cardRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
          return next;
        });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((prev) => {
          const next = Math.max(prev - 1, 0);
          cardRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
          return next;
        });
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        const q = questions[focusIdx];
        if (q) handleApprove(q.id);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const q = questions[focusIdx];
        if (q) setRejectingId(q.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, questions, focusIdx, editingId, rejectingId]);

  async function handleApprove(questionId: string) {
    await supabase
      .from("topic_quiz_questions")
      .update({ review_status: "approved", reviewed_at: new Date().toISOString() } as any)
      .eq("id", questionId);
    setQuestions((prev) =>
      prev.map((q) => q.id === questionId ? { ...q, review_status: "approved" } : q)
    );
    onUpdated();
  }

  async function handleApproveAll() {
    const pending = questions.filter((q) => q.review_status === "pending" || q.review_status === "rejected");
    for (const q of pending) {
      await supabase
        .from("topic_quiz_questions")
        .update({ review_status: "approved", reviewed_at: new Date().toISOString() } as any)
        .eq("id", q.id);
    }
    setQuestions((prev) =>
      prev.map((q) => ({ ...q, review_status: "approved" }))
    );
    toast.success(`${pending.length} questions approved`);
    onUpdated();
  }

  async function handleRejectSubmit() {
    if (!rejectingId) return;
    await supabase
      .from("topic_quiz_questions")
      .update({
        review_status: "rejected",
        lee_notes: rejectNotes,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", rejectingId);
    setQuestions((prev) =>
      prev.map((q) => q.id === rejectingId ? { ...q, review_status: "rejected", lee_notes: rejectNotes } : q)
    );
    setRejectingId(null);
    setRejectNotes("");
    onUpdated();
  }

  function startEdit(q: QuizQuestion) {
    setEditingId(q.id);
    setEditForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation_correct: q.explanation_correct,
      explanation_a: q.explanation_a,
      explanation_b: q.explanation_b,
      explanation_c: q.explanation_c,
      explanation_d: q.explanation_d,
      je_description: q.je_description,
    });
  }

  async function handleEditSave() {
    if (!editingId) return;
    await supabase
      .from("topic_quiz_questions")
      .update({
        ...editForm,
        review_status: "edited",
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", editingId);
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === editingId ? { ...q, ...editForm, review_status: "edited" } as QuizQuestion : q
      )
    );
    setEditingId(null);
    setEditForm({});
    onUpdated();
  }

  const approvedCount = questions.filter(
    (q) => q.review_status === "approved" || q.review_status === "edited"
  ).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm font-bold">{topicName} — Quiz Review</SheetTitle>
          <SheetDescription className="text-xs">
            {approvedCount} / {questions.length} approved
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-4">
          <Progress value={questions.length ? (approvedCount / questions.length) * 100 : 0} className="h-2" />

          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                const embedList = questions.map((q, i) =>
                  `Q${i + 1}: <iframe src="https://learn.surviveaccounting.com/quiz-explanation/${q.id}" width="100%" height="520" frameborder="0" style="border:none;border-radius:8px;"></iframe>`
                ).join("\n");
                navigator.clipboard.writeText(embedList);
                toast.success("All embeds copied");
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy All Embeds
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleApproveAll}>
              <CheckCheck className="h-3 w-3 mr-1" /> Approve All
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse text-center py-8">Loading questions…</p>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id}
                ref={(el) => { cardRefs.current[idx] = el; }}
                className={`rounded-lg border p-4 space-y-3 transition-colors ${
                  idx === focusIdx ? "border-primary ring-1 ring-primary/30" : "border-border"
                }`}
                onClick={() => setFocusIdx(idx)}
              >
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground">Q{q.question_number}</span>
                  <QuestionTypeBadge type={q.question_type} />
                  <ReviewStatusBadge status={q.review_status} />
                </div>

                {/* ── Editing mode ── */}
                {editingId === q.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editForm.question_text ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                      rows={2}
                      className="text-sm"
                      placeholder="Question text"
                    />
                    {q.question_type === "mc" && (
                      <>
                        {(["a", "b", "c", "d"] as const).map((k) => {
                          const optKey = `option_${k}` as keyof typeof editForm;
                          const expKey = `explanation_${k}` as keyof typeof editForm;
                          return (
                            <div key={k} className="space-y-1">
                              <Input
                                value={(editForm[optKey] as string) ?? ""}
                                onChange={(e) => setEditForm({ ...editForm, [optKey]: e.target.value })}
                                placeholder={`Option ${k.toUpperCase()}`}
                                className="text-xs"
                              />
                              <Input
                                value={(editForm[expKey] as string) ?? ""}
                                onChange={(e) => setEditForm({ ...editForm, [expKey]: e.target.value })}
                                placeholder={`Explanation ${k.toUpperCase()}`}
                                className="text-xs"
                              />
                            </div>
                          );
                        })}
                        <Input
                          value={editForm.correct_answer ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, correct_answer: e.target.value })}
                          placeholder="Correct answer (a/b/c/d)"
                          className="text-xs"
                        />
                      </>
                    )}
                    {q.question_type === "je_recall" && (
                      <Textarea
                        value={editForm.je_description ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, je_description: e.target.value })}
                        rows={2}
                        className="text-xs"
                        placeholder="JE description"
                      />
                    )}
                    <Textarea
                      value={editForm.explanation_correct ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, explanation_correct: e.target.value })}
                      rows={2}
                      className="text-xs"
                      placeholder="Correct explanation"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={handleEditSave}>
                        Save Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setEditingId(null); setEditForm({}); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Question text */}
                    <p className="text-sm font-medium leading-relaxed">{q.question_text}</p>

                    {/* MC options */}
                    {q.question_type === "mc" && (
                      <div className="space-y-1.5">
                        {(["a", "b", "c", "d"] as const).map((k) => {
                          const optMap: Record<string, string | null> = {
                            a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d,
                          };
                          const expMap: Record<string, string | null> = {
                            a: q.explanation_a, b: q.explanation_b,
                            c: q.explanation_c, d: q.explanation_d,
                          };
                          const isCorrect = q.correct_answer === k;
                          return (
                            <div key={k}>
                              <div
                                className={`px-3 py-1.5 rounded text-xs ${
                                  isCorrect
                                    ? "bg-emerald-500/10 text-emerald-700 font-medium"
                                    : "bg-muted/50 text-foreground"
                                }`}
                              >
                                <span className="font-bold mr-1.5">{k.toUpperCase()}.</span>
                                {optMap[k]}
                              </div>
                              {expMap[k] && (
                                <p className="text-[11px] text-muted-foreground pl-6 mt-0.5">{expMap[k]}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* True/False */}
                    {q.question_type === "true_false" && (
                      <div className="space-y-1.5">
                        {(["a", "b"] as const).map((k) => {
                          const label = k === "a" ? "True" : "False";
                          const isCorrect = q.correct_answer === k;
                          const exp = k === "a" ? q.explanation_a : q.explanation_b;
                          return (
                            <div key={k}>
                              <div
                                className={`px-3 py-1.5 rounded text-xs ${
                                  isCorrect
                                    ? "bg-emerald-500/10 text-emerald-700 font-medium"
                                    : "bg-muted/50 text-foreground"
                                }`}
                              >
                                {label}
                              </div>
                              {exp && (
                                <p className="text-[11px] text-muted-foreground pl-4 mt-0.5">{exp}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* JE Recall */}
                    {q.question_type === "je_recall" && (() => {
                      const jeOpts = {
                        a: parseJEOption(q.option_a),
                        b: parseJEOption(q.option_b),
                        c: parseJEOption(q.option_c),
                        d: parseJEOption(q.option_d),
                      };
                      const hasStructured = jeOpts.a || jeOpts.b || jeOpts.c || jeOpts.d;

                      if (hasStructured) {
                        return (
                          <div className="space-y-2">
                            {q.je_description && (
                              <p className="text-xs text-muted-foreground italic">{q.je_description}</p>
                            )}
                            {(["a", "b", "c", "d"] as const).map((k) => {
                              const rows = jeOpts[k];
                              if (!rows) return null;
                              const isCorrect = q.correct_answer === k;
                              return (
                                <div
                                  key={k}
                                  className="rounded-md p-2.5"
                                  style={{
                                    borderLeft: `3px solid ${isCorrect ? "#22c55e" : "#e2e8f0"}`,
                                    borderRadius: 6,
                                    background: isCorrect ? "#f0fdf4" : "white",
                                    border: `1px solid ${isCorrect ? "#22c55e" : "#e2e8f0"}`,
                                    borderLeftWidth: 3,
                                  }}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[12px] font-bold">
                                      Choice {k.toUpperCase()}
                                      {isCorrect && <span className="text-emerald-600 ml-1">✓ Correct</span>}
                                    </span>
                                    <button
                                      className="text-[12px] text-blue-400 hover:text-blue-600"
                                      onClick={() => {
                                        navigator.clipboard.writeText(renderJEOptionHtml(rows));
                                        toast.success(`Choice ${k.toUpperCase()} HTML copied — paste into LW answer field ${k.toUpperCase()}`);
                                      }}
                                    >
                                      Copy →
                                    </button>
                                  </div>
                                  <table className="text-[11px] w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-left py-0.5 font-semibold text-muted-foreground">Account</th>
                                        <th className="text-center py-0.5 font-semibold text-muted-foreground w-[50px]">Debit</th>
                                        <th className="text-center py-0.5 font-semibold text-muted-foreground w-[50px]">Credit</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...rows.filter(r => r.side === "debit"), ...rows.filter(r => r.side === "credit")].map((r, i) => (
                                        <tr key={i} className="border-b border-border/50">
                                          <td className={`py-0.5 ${r.side === "credit" ? "pl-4" : ""}`}>{r.account_name}</td>
                                          <td className="py-0.5 text-center">{r.side === "debit" ? "✓" : ""}</td>
                                          <td className="py-0.5 text-center">{r.side === "credit" ? "✓" : ""}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                            {q.explanation_correct && (
                              <p className="text-[11px] text-muted-foreground">{q.explanation_correct}</p>
                            )}
                          </div>
                        );
                      }

                      // Fallback: legacy je_accounts display
                      let accounts = q.je_accounts;
                      if (typeof accounts === "string") {
                        try { accounts = JSON.parse(accounts); } catch { accounts = null; }
                      }
                      return (
                        <div className="space-y-2">
                          {q.je_description && (
                            <p className="text-xs text-muted-foreground italic">{q.je_description}</p>
                          )}
                          {Array.isArray(accounts) && accounts.length > 0 && (
                            <table className="text-xs w-full border-collapse">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-1 font-semibold text-muted-foreground">Account</th>
                                  <th className="text-left py-1 font-semibold text-muted-foreground">Side</th>
                                </tr>
                              </thead>
                              <tbody>
                                {accounts.map((a: any, i: number) => (
                                  <tr key={i} className="border-b border-border/50">
                                    <td className="py-1">{a?.account_name ?? "—"}</td>
                                    <td className="py-1 font-medium">{a?.side === "debit" ? "DR" : "CR"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {q.explanation_correct && (
                            <p className="text-[11px] text-muted-foreground">{q.explanation_correct}</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Rejection notes */}
                    {rejectingId === q.id ? (
                      <div className="space-y-2 pt-1">
                        <Textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Reason for rejection..."
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={handleRejectSubmit}
                          >
                            Save Rejection
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => { setRejectingId(null); setRejectNotes(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      q.review_status === "rejected" && q.lee_notes && (
                        <p className="text-[11px] text-destructive bg-destructive/5 px-2 py-1 rounded">
                          Notes: {q.lee_notes}
                        </p>
                      )
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        variant={q.review_status === "approved" ? "default" : "outline"}
                        className="h-6 text-[11px] px-2"
                        onClick={() => handleApprove(q.id)}
                        disabled={q.review_status === "approved"}
                      >
                        <Check className="h-3 w-3 mr-0.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => { setRejectingId(q.id); setRejectNotes(q.lee_notes ?? ""); }}
                      >
                        <X className="h-3 w-3 mr-0.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2"
                        onClick={() => startEdit(q)}
                      >
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                      {(q.review_status === "approved" || q.review_status === "edited") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              const embed = `<iframe src="https://learn.surviveaccounting.com/quiz-explanation/${q.id}" width="100%" height="520" frameborder="0" style="border:none;border-radius:8px;"></iframe>`;
                              navigator.clipboard.writeText(embed);
                              toast.success("Embed copied — paste into LW question feedback field");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-0.5" /> Embed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              const isJE = q.question_type === "je_recall";
                              const html = isJE
                                ? `<p>${q.question_text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>`
                                : `<p>${q.question_text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>`;
                              navigator.clipboard.writeText(html);
                              toast.success("Question text copied — paste into LW question field");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-0.5" /> Question
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              const isJE = q.question_type === "je_recall";
                              const jeOpts = isJE ? {
                                a: parseJEOption(q.option_a),
                                b: parseJEOption(q.option_b),
                                c: parseJEOption(q.option_c),
                                d: parseJEOption(q.option_d),
                              } : null;
                              const correctRows = jeOpts?.[q.correct_answer as 'a'|'b'|'c'|'d'] ?? undefined;
                              const html = renderFeedbackHtml(true, q.explanation_correct, correctRows ?? undefined);
                              navigator.clipboard.writeText(html);
                              toast.success("Correct feedback HTML copied");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-0.5" /> ✓ Feedback
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              const html = renderFeedbackHtml(false, q.explanation_correct);
                              navigator.clipboard.writeText(html);
                              toast.success("Incorrect feedback HTML copied");
                            }}
                          >
                            <Copy className="h-3 w-3 mr-0.5" /> ✗ Feedback
                          </Button>
                        </>
                      )}

                      {/* JE Recall per-choice copy grid */}
                      {(q.review_status === "approved" || q.review_status === "edited") && q.question_type === "je_recall" && (() => {
                        const jeOpts = {
                          a: parseJEOption(q.option_a),
                          b: parseJEOption(q.option_b),
                          c: parseJEOption(q.option_c),
                          d: parseJEOption(q.option_d),
                        };
                        const hasAny = jeOpts.a || jeOpts.b || jeOpts.c || jeOpts.d;
                        if (!hasAny) return null;
                        return (
                          <div className="w-full pt-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Answer Choices</p>
                            <div className="grid grid-cols-2 gap-1">
                              {(["a","b","c","d"] as const).map((k) => {
                                const rows = jeOpts[k];
                                if (!rows) return null;
                                const isCorrect = q.correct_answer === k;
                                return (
                                  <button
                                    key={k}
                                    className="text-[11px] rounded-md px-2.5 py-1.5 text-left"
                                    style={{
                                      background: "#f8fafc",
                                      border: `1px solid ${isCorrect ? "#22c55e" : "#e2e8f0"}`,
                                      borderRadius: 6,
                                      color: isCorrect ? "#166534" : undefined,
                                    }}
                                    onClick={() => {
                                      navigator.clipboard.writeText(renderJEOptionHtml(rows));
                                      toast.success(`Choice ${k.toUpperCase()} copied — paste into LW answer ${k.toUpperCase()}`);
                                    }}
                                  >
                                    Copy {k.toUpperCase()} HTML{isCorrect ? " ✓" : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── Student Preview (collapsible) ── */}
                    <StudentPreviewSection question={q} />
                  </>
                )}
              </div>
            ))
          )}

          <p className="text-[10px] text-muted-foreground text-center pb-2">
            Keyboard: A = Approve · R = Reject · ←→ = Navigate
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ──────── Start Over (Danger Zone) ──────── */

function StartOverSection({ chapterId, chapterName, totalQuestionCount, onReset }: {
  chapterId: string | undefined;
  chapterName?: string;
  totalQuestionCount: number;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmed && typed === "DELETE";

  async function handleDelete() {
    if (!chapterId || !canDelete) return;
    setDeleting(true);
    try {
      await supabase.from("topic_quiz_questions").delete().eq("chapter_id", chapterId);
      await supabase.from("chapter_topics").update({ quiz_url: null } as any).eq("chapter_id", chapterId);
      toast.success(`All quiz questions deleted for ${chapterName ?? "this chapter"}`);
      onReset();
      setOpen(false);
    } catch {
      toast.error("Failed to delete questions");
    } finally {
      setDeleting(false);
      setConfirmed(false);
      setTyped("");
    }
  }

  if (totalQuestionCount === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <p className="text-[9px] font-bold uppercase tracking-wider text-destructive mb-2">Danger Zone</p>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={() => { setOpen(true); setConfirmed(false); setTyped(""); }}
      >
        ↺ Start Over — Delete All Quiz Questions
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setConfirmed(false); setTyped(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Quiz Questions?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete all <strong>{totalQuestionCount}</strong> generated questions
                  for <strong>{chapterName ?? "this chapter"}</strong>. This cannot be undone.
                </p>
                <p>
                  Topic quiz URLs already pasted into LearnWorlds will not be affected — only the questions
                  in this system will be deleted.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="confirm-delete"
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(v === true)}
                  />
                  <label htmlFor="confirm-delete" className="text-xs cursor-pointer">
                    I understand this cannot be undone
                  </label>
                </div>
                <Input
                  placeholder="Type DELETE to confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="text-xs"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Delete All Questions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ──────── Topic Quizzes Tab ──────── */

function TopicQuizzesTab({ chapterId, chapterNumber, chapterName, courseCode, isAdmin }: { chapterId: string | undefined; chapterNumber: number | undefined; chapterName?: string; courseCode?: string; isAdmin?: boolean }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchRegen, setConfirmBatchRegen] = useState<TopicRow[] | null>(null);
  const [reviewTopic, setReviewTopic] = useState<{ id: string; name: string } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number>(0);

  const loadTopics = useCallback(async () => {
    if (!chapterId) { setLoading(false); return; }
    setLoading(true);

    const { data: ch } = await supabase
      .from("chapters")
      .select("topics_locked")
      .eq("id", chapterId)
      .single();

    const isLocked = ch?.topics_locked ?? false;
    setLocked(isLocked);
    if (!isLocked) { setTopics([]); setLoading(false); return; }

    const { data: topicsData } = await supabase
      .from("chapter_topics")
      .select("id, topic_name, topic_number, is_supplementary, is_active")
      .eq("chapter_id", chapterId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!topicsData?.length) { setTopics([]); setLoading(false); return; }

    const topicIds = topicsData.map((t) => t.id);
    const { data: questions } = await supabase
      .from("topic_quiz_questions")
      .select("topic_id, review_status")
      .in("topic_id", topicIds);

    const countMap: Record<string, { total: number; approved: number }> = {};
    (questions ?? []).forEach((q) => {
      if (!countMap[q.topic_id]) countMap[q.topic_id] = { total: 0, approved: 0 };
      countMap[q.topic_id].total++;
      if (q.review_status === "approved" || q.review_status === "edited") countMap[q.topic_id].approved++;
    });

    const rows: TopicRow[] = topicsData.map((t) => {
      const c = countMap[t.id] ?? { total: 0, approved: 0 };
      let status: TopicRow["status"] = "not_generated";
      if (c.total > 0 && c.approved === c.total) status = "ready";
      else if (c.total > 0) status = "needs_review";
      return { ...t, questionCount: c.total, approvedCount: c.approved, status };
    });

    rows.sort((a, b) => {
      if (a.is_supplementary && !b.is_supplementary) return 1;
      if (!a.is_supplementary && b.is_supplementary) return -1;
      return (a.topic_number ?? 0) - (b.topic_number ?? 0);
    });

    setTopics(rows);
    setLoading(false);
  }, [chapterId]);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  // ── Polling for generation completion ──
  useEffect(() => {
    if (generatingIds.size === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    pollingStartRef.current = Date.now();

    const poll = async () => {
      // Timeout after 3 minutes
      if (Date.now() - pollingStartRef.current > 180_000) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setGeneratingIds(new Set());
        toast.error("Generation timed out — some topics may not have completed");
        loadTopics();
        return;
      }

      if (!chapterId) return;

      const { data } = await supabase
        .from("topic_quiz_questions")
        .select("topic_id")
        .eq("chapter_id", chapterId);

      if (!data) return;

      const countByTopic: Record<string, number> = {};
      data.forEach((q) => {
        countByTopic[q.topic_id] = (countByTopic[q.topic_id] ?? 0) + 1;
      });

      const completed: string[] = [];
      generatingIds.forEach((id) => {
        if ((countByTopic[id] ?? 0) >= 5) {
          completed.push(id);
        }
      });

      if (completed.length > 0) {
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          completed.forEach((id) => next.delete(id));
          return next;
        });

        for (const id of completed) {
          const topic = topics.find((t) => t.id === id);
          if (topic) toast.success(`${topic.topic_name} — 10 questions ready for review`);
        }

        loadTopics();
      }
    };

    pollingRef.current = setInterval(poll, 30_000);
    // Also poll immediately after a short delay
    const immediate = setTimeout(poll, 5_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(immediate);
    };
  }, [generatingIds.size, chapterId, topics, loadTopics]);

  // ── Single topic generate (fire & background) ──
  async function fireGenerate(topicId: string) {
    setGeneratingIds((prev) => new Set(prev).add(topicId));
    setFailedIds((prev) => { const n = new Set(prev); n.delete(topicId); return n; });
    try {
      const { data, error } = await supabase.functions.invoke("generate-topic-quiz", {
        body: { topic_id: topicId },
      });
      if (error) throw new Error(error.message ?? "Generation failed");
      if (data?.error) throw new Error(data.error);
      // Don't remove from generatingIds here — polling will handle it
      // But if we got instant success, update immediately
      if (data?.questions_generated) {
        setGeneratingIds((prev) => { const n = new Set(prev); n.delete(topicId); return n; });
        const topic = topics.find((t) => t.id === topicId);
        toast.success(`${topic?.topic_name ?? "Topic"} — ${data.questions_generated} questions ready for review`);
        loadTopics();
      }
    } catch (e: any) {
      setGeneratingIds((prev) => { const n = new Set(prev); n.delete(topicId); return n; });
      setFailedIds((prev) => new Set(prev).add(topicId));
      const topic = topics.find((t) => t.id === topicId);
      toast.error(`${topic?.topic_name ?? "Topic"}: ${e.message ?? "Failed to generate quiz"}`);
    }
  }

  // ── Batch generate ──
  function handleBatchGenerate() {
    const selected = topics.filter((t) => selectedIds.has(t.id));
    const withExisting = selected.filter((t) => t.questionCount > 0);

    if (withExisting.length > 0) {
      setConfirmBatchRegen(selected);
      return;
    }

    runBatch(selected);
  }

  function runBatch(batch: TopicRow[]) {
    setSelectedIds(new Set());
    // Fire all in parallel
    Promise.all(batch.map((t) => fireGenerate(t.id)));
  }

  // ── Single row generate ──
  function handleGenerate(topic: TopicRow) {
    if (topic.questionCount > 0) {
      setConfirmBatchRegen([topic]);
      return;
    }
    fireGenerate(topic.id);
  }

  // ── Selection logic ──
  const selectableTopics = topics.filter((t) => t.status !== "ready");
  const allSelectableSelected = selectableTopics.length > 0 && selectableTopics.every((t) => selectedIds.has(t.id));

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableTopics.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleExport(topic: TopicRow) {
    setExportingId(topic.id);
    try {
      const { data: questions } = await supabase
        .from("topic_quiz_questions")
        .select("*")
        .eq("topic_id", topic.id)
        .order("question_number", { ascending: true });

      if (!questions?.length) {
        toast.error("No questions to export");
        return;
      }

      const csv = buildLwCsv(questions as unknown as QuizQuestion[], topic.topic_name, { chapterName, courseCode, chapterNumber, topicNumber: topic.topic_number ?? undefined });
      const filename = buildQuizFilename(courseCode, chapterNumber, topic.topic_number ?? undefined, topic.topic_name);
      downloadCsv(csv, filename);
      toast.success("CSV exported — ready for LearnWorlds import");
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading topics…</p>
        </CardContent>
      </Card>
    );
  }

  if (!chapterId) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Select a workspace chapter to view topic quizzes.</p>
        </CardContent>
      </Card>
    );
  }

  if (!locked) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-semibold text-foreground">No locked topics yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Lock topics in the Topic Generator before generating quizzes.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/phase2-review")}>
            Go to Topic Generator <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const anyGenerating = [...generatingIds].some((id) => selectedIds.has(id));

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Topic Quizzes · {topics.filter((t) => !t.is_supplementary).length} core topics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Sticky batch action bar */}
          {selectedIds.size > 0 && (
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 rounded-t-lg"
              style={{ backgroundColor: "#14213D" }}
            >
              <span className="text-white text-[13px]">
                {selectedIds.size} topic{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <Button
                size="sm"
                className="h-7 text-xs bg-white text-[#14213D] hover:bg-white/90 font-bold"
                disabled={anyGenerating}
                onClick={handleBatchGenerate}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Generate Selected ({selectedIds.size})
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] pl-4">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected && selectableTopics.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </TableHead>
                <TableHead>Topic</TableHead>
                <TableHead className="w-[100px] text-center">Questions</TableHead>
                <TableHead className="w-[130px] text-center">Status</TableHead>
                <TableHead className="w-[250px] text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((t) => {
                const isGenerating = generatingIds.has(t.id);
                const isFailed = failedIds.has(t.id);
                const isExporting = exportingId === t.id;
                const isSelected = selectedIds.has(t.id);
                const isReady = t.status === "ready";
                return (
                  <TableRow
                    key={t.id}
                    className={`${t.is_supplementary ? "opacity-60" : ""} ${isSelected ? "bg-blue-500/5" : ""}`}
                  >
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isReady && !isFailed}
                        onChange={() => toggleSelect(t.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            t.is_supplementary
                              ? "bg-muted text-muted-foreground text-[10px] w-5 h-5 flex items-center justify-center p-0"
                              : "bg-primary/10 text-primary text-[10px] w-5 h-5 flex items-center justify-center p-0"
                          }
                        >
                          {t.is_supplementary ? "S" : t.topic_number}
                        </Badge>
                        <span className="font-medium text-sm">{t.topic_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {isGenerating ? (
                        <span className="flex items-center justify-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </span>
                      ) : (
                        <>{t.approvedCount} / {t.questionCount || "—"}</>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isGenerating ? (
                        <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…
                        </Badge>
                      ) : isFailed ? (
                        <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                          Failed
                        </Badge>
                      ) : (
                        <QuizStatusBadge status={t.status} />
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        {isGenerating ? (
                          <span className="text-[11px] text-muted-foreground">Processing…</span>
                        ) : isFailed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                            onClick={() => fireGenerate(t.id)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        ) : (
                          <>
                            {t.status === "not_generated" && (
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleGenerate(t)}
                              >
                                <Sparkles className="h-3 w-3 mr-1" /> Generate
                              </Button>
                            )}
                            {t.status === "needs_review" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setReviewTopic({ id: t.id, name: t.topic_name })}
                                >
                                  <Eye className="h-3 w-3 mr-1" /> Review
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => handleGenerate(t)}
                                >
                                  <Sparkles className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {t.status === "ready" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                  disabled={isExporting}
                                  onClick={() => handleExport(t)}
                                >
                                  {isExporting ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <FileDown className="h-3 w-3 mr-1" />
                                  )}
                                  Export CSV
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setReviewTopic({ id: t.id, name: t.topic_name })}
                                >
                                  <Eye className="h-3 w-3 mr-1" /> Review
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => handleGenerate(t)}
                                >
                                  <Sparkles className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {/* PHASE 2: Add JE Recall
                            // When clicked, this will call a new edge function that:
                            // 1. Fetches all unique JE entries from assets assigned to this topic_id
                            //    (from supplementary_je_json)
                            // 2. Deduplicates by entry label/description similarity
                            // 3. Generates one je_recall question per unique entry using the same
                            //    4-choice distractor pattern
                            // 4. Appends to existing topic_quiz_questions (does not delete existing)
                            // Only assets with topic_id = this topic contribute JEs. */}
                            <button
                              disabled
                              title="Generate additional JE Recall questions — one per unique journal entry in this topic. Coming in Phase 2."
                              className="h-7 text-[11px] px-2.5 rounded-full cursor-not-allowed opacity-60"
                              style={{
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                color: "#94a3b8",
                              }}
                            >
                              ＋ JE Recall
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {topics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No active topics found for this chapter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Danger Zone — Admin only */}
      {isAdmin && <StartOverSection chapterId={chapterId} chapterName={chapterName} totalQuestionCount={topics.reduce((s, t) => s + t.questionCount, 0)} onReset={loadTopics} />}

      {/* Batch regeneration confirmation */}
      <AlertDialog open={!!confirmBatchRegen} onOpenChange={(o) => !o && setConfirmBatchRegen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate quizzes?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const withExisting = (confirmBatchRegen ?? []).filter((t) => t.questionCount > 0);
                if (withExisting.length === 1 && (confirmBatchRegen ?? []).length === 1) {
                  return `This will delete all existing questions for "${withExisting[0].topic_name}". Any approvals will be lost.`;
                }
                return `${withExisting.length} of your selected topics already have questions. Regenerating will delete existing questions and any approvals.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmBatchRegen) runBatch(confirmBatchRegen);
                setConfirmBatchRegen(null);
              }}
            >
              Regenerate{(confirmBatchRegen?.length ?? 0) > 1 ? ` All Selected` : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review drawer */}
      {reviewTopic && (
        <ErrorBoundary
          title="Quiz review hit an error"
          description="Close and reopen the drawer to try again."
          onReset={() => setReviewTopic(null)}
        >
          <QuizReviewDrawer
            open={!!reviewTopic}
            onOpenChange={(o) => !o && setReviewTopic(null)}
            topicId={reviewTopic.id}
            topicName={reviewTopic.name}
            onUpdated={loadTopics}
          />
        </ErrorBoundary>
      )}
    </>
  );
}

/* ──────── Main Page ──────── */

export default function QuizQueue() {
  const { isVa } = useVaAccount();
  const { impersonating } = useImpersonation();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const [courseCode, setCourseCode] = useState<string>("");
  const showPlaceholder = isVa || !!impersonating;

  useEffect(() => {
    if (!workspace?.courseId) return;
    supabase.from("courses").select("code").eq("id", workspace.courseId).single()
      .then(({ data }) => { if (data?.code) setCourseCode(data.code); });
  }, [workspace?.courseId]);

  if (showPlaceholder) {
    return (
      <VaPlaceholder
        heading="Quiz Queue"
        body="This Phase 2 step is where multiple choice questions are generated, reviewed, and exported for LearnWorlds quizzes. Tasks related to this step are coming soon! Thank you for your help building Survive Accounting."
      />
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        {workspace && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{workspace.courseName}</span>
            <span>·</span>
            <span>Ch {workspace.chapterNumber}: {workspace.chapterName}</span>
          </div>
        )}

        <div>
          <h1 className="text-lg font-bold text-foreground">Quiz Queue</h1>
          <p className="text-xs text-muted-foreground">Generate, review, and export quizzes for LearnWorlds.</p>
        </div>

        <Tabs defaultValue="topic-quizzes">
          <TabsList>
            <TabsTrigger value="topic-quizzes" className="text-xs">
              <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Topic Quizzes
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSVs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topic-quizzes" className="mt-4">
            <TopicQuizzesTab chapterId={workspace?.chapterId} chapterNumber={workspace?.chapterNumber} chapterName={workspace?.chapterName} courseCode={courseCode} isAdmin={!isVa && !impersonating} />
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Quiz export tools live at their dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/quizzes-ready")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Export CSVs
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}
