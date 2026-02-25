import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Sparkles, Eye, Trash2, Loader2, ExternalLink, Check, X, ArrowLeft, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const REJECTION_REASONS = [
  "Too easy",
  "Too hard",
  "Off-topic",
  "Bad wording / unclear",
  "Incorrect accounting mechanics",
  "Too long",
  "Not aligned with exam style",
] as const;

const DIFFICULTY_TOGGLES = [
  { id: "partial_period", label: "Partial Period / Stub Period" },
  { id: "missing_info", label: "Missing Information (requires inference)" },
  { id: "common_trap", label: "Common Trap (premium vs discount, debit vs credit reversal)" },
  { id: "multi_step_decoy", label: "Multi-Step with Decoy Step" },
  { id: "je_direction_trap", label: "Journal Entry Direction Trap (account known, debit/credit uncertain)" },
  { id: "numerical_decoys", label: "Numerical Decoys (misleading but irrelevant values)" },
] as const;

interface Props {
  chapterId: string;
  chapterNumber: number;
  courseId: string;
}

type ChapterProblem = {
  id: string;
  course_id: string;
  chapter_id: string;
  problem_type: "exercise" | "problem" | "custom";
  source_label: string;
  title: string;
  problem_text: string;
  solution_text: string;
  journal_entry_text: string | null;
  difficulty_internal: "easy" | "medium" | "hard" | "tricky" | null;
  status: string;
  created_at: string;
};

export function ProblemBankTab({ chapterId, chapterNumber, courseId }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [viewingProblem, setViewingProblem] = useState<ChapterProblem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add form
  const [formType, setFormType] = useState<"exercise" | "problem" | "custom">("exercise");
  const [formLabel, setFormLabel] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formProblem, setFormProblem] = useState("");
  const [formSolution, setFormSolution] = useState("");
  const [formJE, setFormJE] = useState("");

  // Generate state
  const [afNotes, setAfNotes] = useState("");
  const [afRequiresJE, setAfRequiresJE] = useState(false);
  const [activeDiffToggles, setActiveDiffToggles] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [generatedAssetId, setGeneratedAssetId] = useState<string | null>(null);
  const [expandedSolutions, setExpandedSolutions] = useState<Set<number>>(new Set());

  // Rejection feedback state
  const [rejectingIndex, setRejectingIndex] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const { data: problems, isLoading } = useQuery({
    queryKey: ["chapter-problems", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChapterProblem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formLabel.trim()) throw new Error("Source label is required");
      const { error } = await supabase.from("chapter_problems").insert({
        course_id: courseId,
        chapter_id: chapterId,
        problem_type: formType,
        source_label: formLabel.trim(),
        title: formTitle.trim(),
        problem_text: formProblem,
        solution_text: formSolution,
        journal_entry_text: formJE || null,
        status: "imported",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      toast.success("Source problem added");
      resetForm();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_problems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      setDeleteId(null);
      toast.success("Problem deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: async (problem: ChapterProblem) => {
      const { data, error } = await supabase.functions.invoke("convert-to-asset", {
        body: {
          mode: "candidates",
          problemId: problem.id,
          courseId: problem.course_id,
          chapterId: problem.chapter_id,
          sourceLabel: problem.source_label,
          title: problem.title,
          problemText: problem.problem_text,
          solutionText: problem.solution_text,
          journalEntryText: problem.journal_entry_text,
          notes: afNotes,
          requiresJournalEntry: afRequiresJE,
          difficultyToggles: activeDiffToggles.length > 0
            ? activeDiffToggles.map(id => DIFFICULTY_TOGGLES.find(t => t.id === id)?.label).filter(Boolean)
            : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setCandidates((prev) => [...prev, ...(data.candidates || [])]);
      if (viewingProblem) {
        supabase.from("chapter_problems").update({ status: "generated" }).eq("id", viewingProblem.id).then(() => {
          qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
        });
        setViewingProblem({ ...viewingProblem, status: "generated" });
      }
      toast.success(`Generated ${data.candidates?.length || 0} variants`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ candidate, problem }: { candidate: any; problem: ChapterProblem }) => {
      const { data, error } = await supabase.functions.invoke("convert-to-asset", {
        body: {
          mode: "save",
          problemId: problem.id,
          courseId: problem.course_id,
          chapterId: problem.chapter_id,
          candidate,
          requiresJournalEntry: afRequiresJE,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      setGeneratedAssetId(data.asset?.id ?? null);
      setSavingIndex(null);
      if (viewingProblem) {
        setViewingProblem({ ...viewingProblem, status: "approved" });
      }
      toast.success("Variant approved & saved to Assets Library!");
    },
    onError: (e: Error) => { setSavingIndex(null); toast.error(e.message); },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ candidate, problem, reason, note }: { candidate: any; problem: ChapterProblem; reason: string; note: string }) => {
      const { error } = await supabase.from("variant_feedback").insert({
        source_problem_id: problem.id,
        variant_data: candidate,
        rejection_reason: reason,
        free_text_note: note || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      if (rejectingIndex !== null) {
        setCandidates((prev) => prev.filter((_, i) => i !== rejectingIndex));
      }
      setRejectingIndex(null);
      setRejectReason("");
      setRejectNote("");
      toast.success("Variant rejected — feedback saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setFormLabel(""); setFormTitle(""); setFormProblem(""); setFormSolution(""); setFormJE("");
  };

  const openDetail = (p: ChapterProblem) => {
    setViewingProblem(p);
    setAfNotes("");
    setAfRequiresJE(!!p.journal_entry_text);
    setActiveDiffToggles([]);
    setCandidates([]);
    setSavingIndex(null);
    setGeneratedAssetId(null);
    setExpandedSolutions(new Set());
  };

  const toggleDifficulty = (id: string) => {
    setActiveDiffToggles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSolutionExpand = (idx: number) => {
    setExpandedSolutions(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const statusStyle = (status: string) => ({
    imported: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    raw: "bg-muted text-muted-foreground",
    generated: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    approved: "bg-green-500/20 text-green-400 border-green-500/30",
    converted: "bg-green-500/20 text-green-400 border-green-500/30",
  }[status] ?? "bg-muted text-muted-foreground");

  const statusLabel = (status: string) => ({
    imported: "SOURCE", raw: "SOURCE", generated: "GENERATED", approved: "APPROVED", converted: "APPROVED",
  }[status] ?? status.toUpperCase());

  // ─── Detail / Generate View ───
  if (viewingProblem) {
    const p = viewingProblem;
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setViewingProblem(null)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3 mr-1" /> Back to Problems
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">{p.source_label}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{p.problem_type}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusStyle(p.status)}`}>
                {statusLabel(p.status)}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground">{p.title || p.source_label}</h2>
          </div>
        </div>

        {/* Source Material */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{p.problem_text || "—"}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Solution</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{p.solution_text || "—"}</p>
          </div>
        </div>

        {p.journal_entry_text && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Journal Entry</h3>
            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">{p.journal_entry_text}</pre>
          </div>
        )}

        {/* Generate Variants Panel */}
        <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">AI Variant Maker V2</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2 mb-4">
            <div>
              <Label className="text-xs">Notes for AI (optional)</Label>
              <Input value={afNotes} onChange={(e) => setAfNotes(e.target.value)} placeholder="e.g., Focus on premium bonds" className="h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox id="je-toggle" checked={afRequiresJE} onCheckedChange={(v) => setAfRequiresJE(v === true)} />
              <Label htmlFor="je-toggle" className="text-xs cursor-pointer">Journal entry required</Label>
            </div>
          </div>

          {/* Exam Difficulty Options */}
          <Collapsible className="mb-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <AlertTriangle className="h-3 w-3" />
              Exam Difficulty Options
              {activeDiffToggles.length > 0 && (
                <Badge variant="outline" className="text-[10px] ml-1">{activeDiffToggles.length} active</Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2 pl-5">
              <p className="text-[10px] text-muted-foreground mb-2">
                All OFF by default. Toggle ON to add exam-style traps to generated variants.
              </p>
              {DIFFICULTY_TOGGLES.map((toggle) => (
                <div key={toggle.id} className="flex items-center gap-2">
                  <Switch
                    id={`diff-${toggle.id}`}
                    checked={activeDiffToggles.includes(toggle.id)}
                    onCheckedChange={() => toggleDifficulty(toggle.id)}
                    className="scale-75"
                  />
                  <Label htmlFor={`diff-${toggle.id}`} className="text-xs cursor-pointer">{toggle.label}</Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" onClick={() => generateMutation.mutate(p)} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1" /> Generate 3 Variants</>
              )}
            </Button>

            {candidates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => generateMutation.mutate(p)} disabled={generateMutation.isPending}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Regenerate 3 More
              </Button>
            )}

            {generatedAssetId && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/assets-library">
                  <ExternalLink className="h-3 w-3 mr-1" /> View in Assets Library
                </Link>
              </Button>
            )}
          </div>

          {/* Candidates */}
          {candidates.length > 0 && (
            <div className="mt-5 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Generated Variants ({candidates.length})
              </h4>
              <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
                {candidates.map((c: any, idx: number) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3 flex flex-col">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Variant {idx + 1}</p>
                      <h5 className="text-sm font-semibold text-foreground">{c.asset_name}</h5>
                    </div>

                    {c.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t: string) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Practice Problem Text */}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Practice Problem</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{c.survive_problem_text}</p>
                    </div>

                    {/* Journal Entry Block */}
                    {c.journal_entry_block && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Journal Entry</p>
                        <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-2">{c.journal_entry_block}</pre>
                      </div>
                    )}

                    {/* Answer Only */}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Answer Only</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 rounded p-2">{c.answer_only || "—"}</p>
                    </div>

                    {/* Fully Worked Steps (collapsible) */}
                    <Collapsible open={expandedSolutions.has(idx)} onOpenChange={() => toggleSolutionExpand(idx)}>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground">
                        {expandedSolutions.has(idx) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Fully Worked Steps (internal)
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1">
                        <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 rounded p-2">{c.survive_solution_text}</p>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Exam Trap Note */}
                    {c.exam_trap_note && (
                      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
                        <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Exam Trap Note
                        </p>
                        <p className="text-xs text-foreground">{c.exam_trap_note}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSavingIndex(idx);
                          approveMutation.mutate({ candidate: c, problem: p });
                        }}
                        disabled={approveMutation.isPending}
                      >
                        {savingIndex === idx && approveMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><Check className="h-3 w-3 mr-1" /> Approve</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => { setRejectingIndex(idx); setRejectReason(""); setRejectNote(""); }}
                        disabled={approveMutation.isPending}
                      >
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 italic mt-3">
                Future: use feedback to bias future generations.
              </p>
            </div>
          )}
        </div>

        {/* Rejection Feedback Dialog */}
        <Dialog open={rejectingIndex !== null} onOpenChange={(o) => { if (!o) setRejectingIndex(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Why reject this variant?</DialogTitle>
              <DialogDescription>Select a reason and optionally add a note. This feedback will improve future generations.</DialogDescription>
            </DialogHeader>
            <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="space-y-2">
              {REJECTION_REASONS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem value={r} id={`reason-${r}`} />
                  <Label htmlFor={`reason-${r}`} className="text-xs cursor-pointer">{r}</Label>
                </div>
              ))}
            </RadioGroup>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} className="text-xs mt-1" placeholder="Any additional context…" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setRejectingIndex(null)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason || rejectMutation.isPending}
                onClick={() => {
                  if (rejectingIndex !== null && viewingProblem) {
                    rejectMutation.mutate({
                      candidate: candidates[rejectingIndex],
                      problem: viewingProblem,
                      reason: rejectReason,
                      note: rejectNote,
                    });
                  }
                }}
              >
                {rejectMutation.isPending ? "Saving…" : "Reject Variant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Table View ───
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Uploaded textbook problems waiting to be transformed into Survive assets.
        </p>
        <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Source
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-24">Label</TableHead>
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs w-20">Type</TableHead>
              <TableHead className="text-xs w-28">Status</TableHead>
              <TableHead className="text-xs w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">Loading…</TableCell></TableRow>
            ) : !problems?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">No source problems yet. Click "+ Add Source" to start.</TableCell></TableRow>
            ) : (
              problems.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-medium">{p.source_label}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px]">{p.title || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{p.problem_type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusStyle(p.status)}`}>
                      {statusLabel(p.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(p.status === "raw" || p.status === "imported") && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => openDetail(p)}>
                          <Sparkles className="h-3 w-3 mr-1" /> Generate
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(p)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Source Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Source Problem</DialogTitle>
            <DialogDescription>Enter the textbook problem details. This creates a SOURCE record for variant generation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exercise">Exercise</SelectItem>
                    <SelectItem value="problem">Problem</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Source Label</Label>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="E13-4" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Bond amortization" className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Problem Text</Label>
              <Textarea value={formProblem} onChange={(e) => setFormProblem(e.target.value)} rows={4} className="text-xs" placeholder="Paste the original problem text…" />
            </div>
            <div>
              <Label className="text-xs">Solution Text</Label>
              <Textarea value={formSolution} onChange={(e) => setFormSolution(e.target.value)} rows={4} className="text-xs" placeholder="Paste the solution…" />
            </div>
            <div>
              <Label className="text-xs">Journal Entry (optional)</Label>
              <Textarea value={formJE} onChange={(e) => setFormJE(e.target.value)} rows={3} className="text-xs font-mono" placeholder="Debit: Account — Amount&#10;Credit: Account — Amount" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Save Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Problem</DialogTitle>
            <DialogDescription>This will permanently remove this source problem. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
