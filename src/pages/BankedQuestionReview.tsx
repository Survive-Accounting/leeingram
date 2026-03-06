import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { renderQuestionHtml, copyHtmlToClipboard } from "@/lib/questionHtmlRenderer";
import {
  CheckCircle2,
  XCircle,
  Star,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Filter,
  Keyboard,
  Pencil,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type BankedQuestion = {
  id: string;
  asset_id: string | null;
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
  ai_confidence_score: number;
  review_status: string;
  rating: number | null;
  rejection_notes: string | null;
  assets: {
    asset_code: string;
    chapter_number: number;
    course_id: string;
    courses: { code: string };
  } | null;
  teaching_assets: {
    asset_name: string;
    course_id: string;
    chapter_id: string;
  } | null;
};

const QUESTION_TYPES = ["JE_MC", "CALC_MC", "CONCEPT_MC", "TRUE_FALSE", "TRAP", "RELEVANT_INFO", "IRRELEVANT_INFO"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function BankedQuestionReview() {
  const qc = useQueryClient();

  // Filters
  const [courseFilter, setCourseFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minDifficulty, setMinDifficulty] = useState(1);
  const [maxDifficulty, setMaxDifficulty] = useState(10);
  const [minConfidence, setMinConfidence] = useState(0);
  const [ratingFilter, setRatingFilter] = useState("all");

  // Current question index
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, code, course_name").order("code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch chapters
  const { data: chapters } = useQuery({
    queryKey: ["chapters-for-review", courseFilter],
    queryFn: async () => {
      let q = supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch all banked questions
  const { data: allQuestions, isLoading } = useQuery({
    queryKey: ["banked-questions-review"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banked_questions")
        .select(`
          id, asset_id, teaching_asset_id, question_type, question_text,
          answer_a, answer_b, answer_c, answer_d, answer_e,
          correct_answer, short_explanation, difficulty,
          ai_confidence_score, review_status, rating, rejection_notes,
          assets (
            asset_code, chapter_number, course_id,
            courses ( code )
          ),
          teaching_assets (
            asset_name, course_id, chapter_id
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BankedQuestion[];
    },
  });

  // Apply filters
  const filtered = useMemo(() => {
    if (!allQuestions) return [];
    return allQuestions.filter((q) => {
      const courseId = q.assets?.course_id || q.teaching_assets?.course_id;
      if (courseFilter !== "all" && courseId !== courseFilter) return false;
      if (chapterFilter !== "all") {
        const ch = chapters?.find((c) => c.id === chapterFilter);
        if (ch && q.assets?.chapter_number !== ch.chapter_number && q.teaching_assets?.chapter_id !== chapterFilter) return false;
      }
      if (typeFilter !== "all" && q.question_type !== typeFilter) return false;
      if (statusFilter !== "all" && q.review_status !== statusFilter) return false;
      if (q.difficulty < minDifficulty || q.difficulty > maxDifficulty) return false;
      if (q.ai_confidence_score < minConfidence) return false;
      if (ratingFilter !== "all") {
        const r = parseInt(ratingFilter);
        if (q.rating !== r) return false;
      }
      return true;
    });
  }, [allQuestions, courseFilter, chapterFilter, typeFilter, statusFilter, minDifficulty, maxDifficulty, minConfidence, ratingFilter, chapters]);

  // Group by asset
  const grouped = useMemo(() => {
    const map = new Map<string, BankedQuestion[]>();
    for (const q of filtered) {
      const key = q.assets?.asset_code || q.asset_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return map;
  }, [filtered]);

  const current = filtered[currentIdx] || null;

  // Clamp index
  useEffect(() => {
    if (currentIdx >= filtered.length && filtered.length > 0) {
      setCurrentIdx(filtered.length - 1);
    }
  }, [filtered.length, currentIdx]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BankedQuestion>) => {
      if (!current) return;
      const { error } = await supabase.from("banked_questions").update(updates as any).eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banked-questions-review"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useCallback(() => {
    if (!current) return;
    updateMutation.mutate({ review_status: "approved" } as any);
    toast.success("Approved");
    if (currentIdx < filtered.length - 1) setCurrentIdx((i) => i + 1);
  }, [current, currentIdx, filtered.length, updateMutation]);

  const reject = useCallback(() => {
    if (!current) return;
    setRejectOpen(true);
  }, [current]);

  const confirmReject = useCallback(() => {
    if (!current) return;
    updateMutation.mutate({ review_status: "rejected", rejection_notes: rejectNotes || null } as any);
    toast.success("Rejected");
    setRejectOpen(false);
    setRejectNotes("");
    if (currentIdx < filtered.length - 1) setCurrentIdx((i) => i + 1);
  }, [current, rejectNotes, currentIdx, filtered.length, updateMutation]);

  const rate = useCallback((r: number) => {
    if (!current) return;
    updateMutation.mutate({ rating: r } as any);
    toast.success(`Rated ${r}/5`);
  }, [current, updateMutation]);

  const copyHtml = useCallback(async () => {
    if (!current) return;
    const answers = [current.answer_a, current.answer_b, current.answer_c, current.answer_d, current.answer_e].filter(Boolean);
    const html = renderQuestionHtml({
      questionId: current.assets?.asset_code || "Q",
      questionText: current.question_text,
      answers,
      correctAnswer: current.correct_answer,
      explanation: current.short_explanation,
    });
    await copyHtmlToClipboard(html);
    toast.success("HTML copied successfully");
  }, [current]);

  const saveEdit = useCallback(() => {
    if (!current) return;
    updateMutation.mutate({ question_text: editText, short_explanation: editExplanation } as any);
    setEditOpen(false);
    toast.success("Question updated");
  }, [current, editText, editExplanation, updateMutation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editOpen || rejectOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "a": approve(); break;
        case "r": reject(); break;
        case "1": rate(1); break;
        case "2": rate(2); break;
        case "3": rate(3); break;
        case "4": rate(4); break;
        case "5": rate(5); break;
        case "arrowleft":
          e.preventDefault();
          setCurrentIdx((i) => Math.max(0, i - 1));
          break;
        case "arrowright":
          e.preventDefault();
          setCurrentIdx((i) => Math.min(filtered.length - 1, i + 1));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [approve, reject, rate, filtered.length, editOpen, rejectOpen]);

  const pendingCount = filtered.filter((q) => q.review_status === "pending").length;
  const approvedCount = filtered.filter((q) => q.review_status === "approved").length;
  const rejectedCount = filtered.filter((q) => q.review_status === "rejected").length;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              Question Review
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length} questions · {pendingCount} pending · {approvedCount} approved · {rejectedCount} rejected
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setShowShortcuts(!showShortcuts)}>
            <Keyboard className="h-3 w-3 mr-1" /> Shortcuts
          </Button>
        </div>

        {showShortcuts && (
          <div className="rounded-lg border border-border bg-card/50 p-3 text-xs text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">A</kbd> Approve</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">R</kbd> Reject</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">1-5</kbd> Rate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">←→</kbd> Navigate</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Course</Label>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-7 text-[11px] w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Chapter</Label>
            <Select value={chapterFilter} onValueChange={setChapterFilter}>
              <SelectTrigger className="h-7 text-[11px] w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chapters</SelectItem>
                {chapters?.map((c) => <SelectItem key={c.id} value={c.id}>CH{String(c.chapter_number).padStart(2, "0")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-7 text-[11px] w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 text-[11px] w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Rating</Label>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="h-7 text-[11px] w-[90px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {[1,2,3,4,5].map((r) => <SelectItem key={r} value={String(r)}>{r}★</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-[120px]">
            <Label className="text-[10px] text-muted-foreground">Min Confidence: {minConfidence}%</Label>
            <Slider value={[minConfidence]} onValueChange={([v]) => setMinConfidence(v)} min={0} max={100} step={5} className="mt-1" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading questions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No questions match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Left: question list grouped by asset */}
            <div className="rounded-lg border border-border bg-card/30 overflow-hidden">
              <div className="p-2 border-b border-border bg-card/50">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {filtered.length} Questions · {grouped.size} Assets
                </p>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                {Array.from(grouped.entries()).map(([assetCode, questions]) => (
                  <div key={assetCode}>
                    <div className="px-2 py-1.5 bg-muted/30 border-b border-border">
                      <p className="text-[10px] font-semibold text-foreground/80 truncate">{assetCode}</p>
                    </div>
                    {questions.map((q) => {
                      const globalIdx = filtered.indexOf(q);
                      const isActive = globalIdx === currentIdx;
                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIdx(globalIdx)}
                          className={`w-full text-left px-2 py-1.5 border-b border-border/50 transition-colors text-[11px] ${
                            isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[q.review_status] || ""}`}>
                              {q.review_status === "approved" ? "✓" : q.review_status === "rejected" ? "✗" : "•"}
                            </Badge>
                            <span className="text-muted-foreground">{q.question_type}</span>
                            <span className="ml-auto text-muted-foreground/60">D{q.difficulty}</span>
                            {q.rating && <span className="text-warning text-[9px]">{q.rating}★</span>}
                          </div>
                          <p className="text-foreground/70 line-clamp-1 mt-0.5">{q.question_text}</p>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: current question detail */}
            {current && (
              <div className="space-y-3">
                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground font-mono">{currentIdx + 1}/{filtered.length}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentIdx((i) => Math.min(filtered.length - 1, i + 1))} disabled={currentIdx >= filtered.length - 1}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={approve}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-[11px]" onClick={reject}>
                      <XCircle className="h-3 w-3 mr-1" /> Reject
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => {
                      setEditText(current.question_text);
                      setEditExplanation(current.short_explanation);
                      setEditOpen(true);
                    }}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={copyHtml}>
                      <ClipboardCopy className="h-3 w-3 mr-1" /> Copy HTML
                    </Button>
                  </div>
                </div>

                {/* Meta badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{current.assets?.asset_code}</Badge>
                  <Badge variant="outline" className="text-[10px]">{current.question_type}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[current.review_status] || ""}`}>
                    {current.review_status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">Difficulty: {current.difficulty}/10</Badge>
                  <Badge variant="outline" className="text-[10px]">Confidence: {current.ai_confidence_score}%</Badge>
                  {current.rating && (
                    <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                      Rating: {current.rating}/5
                    </Badge>
                  )}
                </div>

                {/* Question text */}
                <div className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{current.question_text}</p>
                </div>

                {/* Answers */}
                <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Answer Choices</p>
                  {[
                    { label: "A", text: current.answer_a },
                    { label: "B", text: current.answer_b },
                    { label: "C", text: current.answer_c },
                    { label: "D", text: current.answer_d },
                    { label: "E", text: current.answer_e },
                  ].filter((a) => a.text?.trim()).map((a) => {
                    const isCorrect = current.correct_answer?.toUpperCase().includes(a.label);
                    return (
                      <div key={a.label} className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                        isCorrect ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/20"
                      }`}>
                        <span className={`font-mono font-bold ${isCorrect ? "text-emerald-400" : "text-muted-foreground"}`}>{a.label}.</span>
                        <span className="text-foreground/80">{a.text}</span>
                        {isCorrect && <Badge className="ml-auto text-[8px] bg-emerald-600/20 text-emerald-400 border-emerald-500/30">Correct</Badge>}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {current.short_explanation && (
                  <div className="rounded-lg border border-border bg-card/50 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Explanation</p>
                    <p className="text-xs text-foreground/70">{current.short_explanation}</p>
                  </div>
                )}

                {/* Rejection notes */}
                {current.rejection_notes && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-[10px] font-medium text-destructive uppercase tracking-wider mb-1">Rejection Notes</p>
                    <p className="text-xs text-foreground/70">{current.rejection_notes}</p>
                  </div>
                )}

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Rate:</span>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => rate(r)}
                      className={`h-7 w-7 rounded flex items-center justify-center text-xs transition-colors ${
                        current.rating === r
                          ? "bg-warning/20 text-warning border border-warning/30"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Question Text</Label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={6} className="text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Explanation</Label>
              <Textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} rows={3} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Rejection Notes (optional)</Label>
            <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={3} className="text-xs" placeholder="Why is this question being rejected?" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
