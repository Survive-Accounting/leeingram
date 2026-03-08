import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { renderQuestionHtml, copyHtmlToClipboard } from "@/lib/questionHtmlRenderer";
import {
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, Pencil,
  ClipboardCopy, Keyboard, Loader2, Zap, ChevronDown, ChevronUp,
  FileQuestion, Calculator, BookOpen, HelpCircle, ToggleLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

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
  assets: { asset_code: string; chapter_number: number; course_id: string; courses: { code: string } } | null;
  teaching_assets: { asset_name: string; course_id: string; chapter_id: string } | null;
};

const QUESTION_TYPES = ["JE_MC", "CALC_MC", "CONCEPT_MC", "TRUE_FALSE", "TRAP", "RELEVANT_INFO", "IRRELEVANT_INFO"];

const TYPE_ICON: Record<string, typeof FileQuestion> = {
  JE_MC: FileQuestion,
  CALC_MC: Calculator,
  CONCEPT_MC: BookOpen,
  TRUE_FALSE: ToggleLeft,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function BankedQuestionReview() {
  const qc = useQueryClient();
  const { workspace } = useActiveWorkspace();

  // Speed review mode (default on for VA)
  const [speedMode, setSpeedMode] = useState(() => localStorage.getItem("qr-speed-mode") !== "false");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Filters — simplified: only status visible by default
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState(0);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editExplanation, setEditExplanation] = useState("");

  const toggleSpeedMode = (v: boolean) => {
    setSpeedMode(v);
    localStorage.setItem("qr-speed-mode", String(v));
  };

  // Fetch questions scoped to active workspace chapter
  const { data: allQuestions, isLoading } = useQuery({
    queryKey: ["banked-questions-review", workspace?.chapterId],
    queryFn: async () => {
      let q = supabase
        .from("banked_questions")
        .select(`
          id, asset_id, teaching_asset_id, question_type, question_text,
          answer_a, answer_b, answer_c, answer_d, answer_e,
          correct_answer, short_explanation, difficulty,
          ai_confidence_score, review_status, rating, rejection_notes,
          assets ( asset_code, chapter_number, course_id, courses ( code ) ),
          teaching_assets ( asset_name, course_id, chapter_id )
        `)
        .order("created_at", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;

      // Client-side filter to workspace chapter if set
      let results = data as unknown as BankedQuestion[];
      if (workspace?.chapterId) {
        results = results.filter(
          (q) => q.teaching_assets?.chapter_id === workspace.chapterId
        );
      }
      return results;
    },
  });

  const filtered = useMemo(() => {
    if (!allQuestions) return [];
    return allQuestions.filter((q) => {
      if (statusFilter !== "all" && q.review_status !== statusFilter) return false;
      if (typeFilter !== "all" && q.question_type !== typeFilter) return false;
      if (q.ai_confidence_score < minConfidence) return false;
      if (ratingFilter !== "all" && q.rating !== parseInt(ratingFilter)) return false;
      return true;
    });
  }, [allQuestions, statusFilter, typeFilter, minConfidence, ratingFilter]);

  const current = filtered[currentIdx] || null;

  useEffect(() => {
    if (currentIdx >= filtered.length && filtered.length > 0) setCurrentIdx(filtered.length - 1);
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
    updateMutation.mutate({ review_status: "rejected" } as any);
    toast.success("Rejected");
    if (currentIdx < filtered.length - 1) setCurrentIdx((i) => i + 1);
  }, [current, currentIdx, filtered.length, updateMutation]);

  const rate = useCallback((r: number) => {
    if (!current) return;
    updateMutation.mutate({ rating: r } as any);
    toast.success(`Rated ${r}/5`);
  }, [current, updateMutation]);

  const copyHtml = useCallback(async () => {
    if (!current) return;
    const answers = [current.answer_a, current.answer_b, current.answer_c, current.answer_d, current.answer_e].filter(Boolean);
    const html = renderQuestionHtml({
      questionId: current.assets?.asset_code || current.teaching_assets?.asset_name || "Q",
      questionText: current.question_text, answers,
      correctAnswer: current.correct_answer, explanation: current.short_explanation,
    });
    await copyHtmlToClipboard(html);
    toast.success("HTML copied");
  }, [current]);

  const saveEdit = useCallback(() => {
    if (!current) return;
    updateMutation.mutate({ question_text: editText, short_explanation: editExplanation } as any);
    setEditOpen(false);
    toast.success("Saved");
  }, [current, editText, editExplanation, updateMutation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case "a": approve(); break;
        case "r": reject(); break;
        case "e":
          if (current && !speedMode) {
            setEditText(current.question_text);
            setEditExplanation(current.short_explanation);
            setEditOpen(true);
          }
          break;
        case "1": case "2": case "3": case "4": case "5":
          if (!speedMode) rate(parseInt(e.key));
          break;
        case "arrowleft":
          e.preventDefault(); setCurrentIdx((i) => Math.max(0, i - 1)); break;
        case "arrowright":
          e.preventDefault(); setCurrentIdx((i) => Math.min(filtered.length - 1, i + 1)); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [approve, reject, rate, filtered.length, editOpen, current, speedMode]);

  const pendingCount = allQuestions?.filter((q) => q.review_status === "pending").length ?? 0;

  const TypeIcon = current ? (TYPE_ICON[current.question_type] || HelpCircle) : HelpCircle;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        {/* ── Next Action Banner ── */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Next Task</p>
          <p className="text-sm text-foreground mt-0.5">
            Review generated questions and approve or reject.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pendingCount} pending questions to review
          </p>
        </div>

        {/* ── Header Row ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">Question Review</h1>
            <Badge variant="outline" className={cn("text-[10px]", statusFilter === "pending" ? "border-primary/40 text-primary" : "")}>
              {filtered.length} shown
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Speed review toggle */}
            <div className="flex items-center gap-1.5">
              <Zap className={cn("h-3.5 w-3.5", speedMode ? "text-primary" : "text-muted-foreground")} />
              <Label className="text-[11px] text-muted-foreground cursor-pointer" htmlFor="speed-toggle">Speed</Label>
              <Switch id="speed-toggle" checked={speedMode} onCheckedChange={toggleSpeedMode} className="scale-75" />
            </div>

            {/* Status quick filter */}
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {(["pending", "approved", "rejected", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setCurrentIdx(0); }}
                  className={cn(
                    "px-2.5 py-1 text-[11px] capitalize transition-colors",
                    statusFilter === s ? "bg-primary/20 text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Advanced filters toggle */}
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              {showAdvancedFilters ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              Filters
            </Button>

            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={() => setShowShortcuts(!showShortcuts)}>
              <Keyboard className="h-3 w-3 mr-1" /> Keys
            </Button>
          </div>
        </div>

        {/* Keyboard shortcuts panel */}
        {showShortcuts && (
          <div className="rounded-lg border border-border bg-card/50 p-3 text-xs text-muted-foreground grid grid-cols-3 gap-x-6 gap-y-1">
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">A</kbd> Approve</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">R</kbd> Reject</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">←→</kbd> Navigate</span>
            {!speedMode && <>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">E</kbd> Edit</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">1-5</kbd> Rate</span>
            </>}
          </div>
        )}

        {/* Advanced filters (collapsed by default) */}
        {showAdvancedFilters && (
          <div className="flex flex-wrap gap-3 items-end rounded-lg border border-border bg-card/30 p-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Type</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentIdx(0); }}>
                <SelectTrigger className="h-7 text-[11px] w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Rating</Label>
              <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v); setCurrentIdx(0); }}>
                <SelectTrigger className="h-7 text-[11px] w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {[1,2,3,4,5].map((r) => <SelectItem key={r} value={String(r)}>{r}★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-[140px]">
              <Label className="text-[10px] text-muted-foreground">Min Confidence: {minConfidence}%</Label>
              <Slider value={[minConfidence]} onValueChange={([v]) => { setMinConfidence(v); setCurrentIdx(0); }} min={0} max={100} step={5} />
            </div>
          </div>
        )}

        {/* ── Main Content ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-base">No questions match your filters.</p>
            <p className="text-xs mt-1">Try changing the status filter above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_180px] gap-4">
            {/* ── LEFT: Question List ── */}
            <div className="rounded-lg border border-border bg-card/30 overflow-hidden">
              <div className="p-2.5 border-b border-border bg-card/50">
                <p className="text-[11px] font-medium text-foreground/80">
                  {filtered.length} Questions
                </p>
              </div>
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                {filtered.map((q, idx) => {
                  const isActive = idx === currentIdx;
                  const Icon = TYPE_ICON[q.question_type] || HelpCircle;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={cn(
                        "w-full text-left px-3 py-3 border-b border-border/40 transition-colors",
                        isActive
                          ? "bg-primary/15 border-l-[3px] border-l-primary"
                          : "hover:bg-muted/20 border-l-[3px] border-l-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/60")} />
                        <span className={cn("text-xs font-medium truncate", isActive ? "text-foreground" : "text-foreground/70")}>
                          #{idx + 1}
                        </span>
                        <Badge variant="outline" className={cn("text-[8px] px-1 py-0 ml-auto", STATUS_COLORS[q.review_status] || "")}>
                          {q.review_status === "approved" ? "✓" : q.review_status === "rejected" ? "✗" : "○"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-foreground/60 line-clamp-2 mt-1 leading-relaxed">{q.question_text}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── CENTER: Question Detail ── */}
            {current && (
              <div className="space-y-4">
                {/* Navigation bar */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground font-mono">{currentIdx + 1} / {filtered.length}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentIdx((i) => Math.min(filtered.length - 1, i + 1))} disabled={currentIdx >= filtered.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="ml-2 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{current.question_type}</Badge>
                    <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[current.review_status] || "")}>
                      {current.review_status}
                    </Badge>
                  </div>
                </div>

                {/* Question text — larger font */}
                <div className="rounded-xl border border-border bg-card/60 p-5">
                  <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{current.question_text}</p>
                </div>

                {/* Answer choices — separated cards */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Answers</p>
                  {[
                    { label: "A", text: current.answer_a },
                    { label: "B", text: current.answer_b },
                    { label: "C", text: current.answer_c },
                    { label: "D", text: current.answer_d },
                    { label: "E", text: current.answer_e },
                  ].filter((a) => a.text?.trim()).map((a) => {
                    const isCorrect = current.correct_answer?.toUpperCase().includes(a.label);
                    return (
                      <div
                        key={a.label}
                        className={cn(
                          "rounded-lg border px-4 py-3 flex items-start gap-3",
                          isCorrect
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-border bg-card/30"
                        )}
                      >
                        <span className={cn(
                          "font-mono font-bold text-sm mt-0.5",
                          isCorrect ? "text-emerald-400" : "text-muted-foreground"
                        )}>
                          {a.label}.
                        </span>
                        <span className={cn("text-sm leading-relaxed", isCorrect ? "text-foreground font-medium" : "text-foreground/80")}>
                          {a.text}
                        </span>
                        {isCorrect && (
                          <Badge className="ml-auto text-[9px] bg-emerald-600/20 text-emerald-400 border-emerald-500/30 shrink-0">
                            ✓ Correct
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation — hidden in speed mode */}
                {!speedMode && current.short_explanation && (
                  <div className="rounded-lg border border-border bg-card/40 p-4">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Explanation</p>
                    <p className="text-sm text-foreground/70 leading-relaxed">{current.short_explanation}</p>
                  </div>
                )}

                {/* Details — expandable */}
                {!speedMode && (
                  <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Details
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="rounded-lg border border-border bg-card/30 p-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Difficulty: <span className="text-foreground">{current.difficulty}/10</span></span>
                        <span>Confidence: <span className="text-foreground">{current.ai_confidence_score}%</span></span>
                        <span>Asset: <span className="text-foreground">{current.assets?.asset_code || current.teaching_assets?.asset_name || "—"}</span></span>
                        {current.rating && <span>Rating: <span className="text-foreground">{current.rating}/5</span></span>}
                        {current.rejection_notes && (
                          <span className="col-span-2 text-destructive">Rejection: {current.rejection_notes}</span>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Rating row — hidden in speed mode */}
                {!speedMode && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Rate:</span>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => rate(r)}
                        className={cn(
                          "h-7 w-7 rounded flex items-center justify-center text-xs transition-colors",
                          current.rating === r
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── RIGHT: Actions Panel ── */}
            {current && (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Actions</p>
                <Button
                  className="w-full h-12 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={approve}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  className="w-full h-12 text-sm font-semibold"
                  onClick={reject}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>

                {!speedMode && (
                  <>
                    <div className="border-t border-border my-2" />
                    <Button
                      variant="outline"
                      className="w-full h-9 text-xs"
                      onClick={() => {
                        setEditText(current.question_text);
                        setEditExplanation(current.short_explanation);
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1.5" /> Edit
                    </Button>
                    <Button variant="outline" className="w-full h-9 text-xs" onClick={copyHtml}>
                      <ClipboardCopy className="h-3 w-3 mr-1.5" /> Copy HTML
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Question Text</Label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={6} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Explanation</Label>
              <Textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} rows={3} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
