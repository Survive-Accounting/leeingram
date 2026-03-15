import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { JournalEntryTable } from "@/components/JournalEntryTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, ChevronLeft, CheckCircle2,
  Bug, Loader2, Plus, Trash2, Copy, Download, SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { saveAs } from "file-saver";

const ERROR_FIELDS = [
  "Journal Entries", "Worked Steps", "Answer Text", "Problem Text",
  "Important Formulas", "Concept Notes", "Exam Traps",
  "Numeric Values", "Account Names", "Other",
] as const;

const ERROR_FIELD_VALUES: Record<string, string> = {
  "Journal Entries": "journal_entries", "Worked Steps": "worked_steps",
  "Answer Text": "answer_text", "Problem Text": "problem_text",
  "Important Formulas": "important_formulas", "Concept Notes": "concept_notes",
  "Exam Traps": "exam_traps", "Numeric Values": "numeric_values",
  "Account Names": "account_names", "Other": "other",
};

const ERROR_TYPES = [
  "Hallucination", "Incorrect Calculation", "Wrong Account",
  "Missing Entry", "Wrong Debit/Credit", "Wrong Date",
  "Formatting Issue", "Other",
] as const;

const ERROR_TYPE_VALUES: Record<string, string> = {
  "Hallucination": "hallucination", "Incorrect Calculation": "incorrect_calculation",
  "Wrong Account": "wrong_account", "Missing Entry": "missing_entry",
  "Wrong Debit/Credit": "wrong_debit_credit", "Wrong Date": "wrong_date",
  "Formatting Issue": "formatting", "Other": "other",
};

type AnnotationForm = {
  id: string;
  errorField: string;
  errorType: string;
  whatWasWrong: string;
  correctAnswer: string;
};

function emptyForm(): AnnotationForm {
  return { id: crypto.randomUUID(), errorField: "", errorType: "", whatWasWrong: "", correctAnswer: "" };
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) return null;
  const colors: Record<number, string> = {
    1: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    2: "bg-muted text-muted-foreground border-border",
    3: "bg-muted/50 text-muted-foreground/60 border-border/50",
  };
  return <Badge variant="outline" className={`text-[10px] ${colors[rank] || ""}`}>R{rank}</Badge>;
}

export default function DebugSession() {
  const { chapterId: paramChapterId } = useParams<{ chapterId: string }>();
  const { workspace } = useActiveWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const chapterId = paramChapterId || workspace?.chapterId;

  const [sessionId] = useState(() => crypto.randomUUID());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [forms, setForms] = useState<AnnotationForm[]>([emptyForm()]);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [annotatedIds, setAnnotatedIds] = useState<Set<string>>(new Set());
  const [allNotes, setAllNotes] = useState<Array<{ assetName: string; assetId: string; sourceRef: string | null; coreRank: number | null; notes: Array<{ error_field: string; error_type: string; admin_note: string; correct_answer: string }> }>>([]);

  // ── Fetch debug queue ──────────────────────────────────────────
  const { data: debugAssets = [], isLoading } = useQuery({
    queryKey: ["debug-session-assets", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, course_id, survive_problem_text, survive_solution_text, journal_entry_completed_json, problem_context, concept_notes, exam_traps, important_formulas")
        .eq("chapter_id", chapterId!)
        .eq("phase2_status", "needs_debugging")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!chapterId,
  });

  // ── Fetch activity logs for all debug assets ───────────────────
  const assetIds = useMemo(() => debugAssets.map(a => a.id), [debugAssets]);
  const { data: activityLogs = {} } = useQuery({
    queryKey: ["debug-session-logs", assetIds],
    queryFn: async () => {
      if (assetIds.length === 0) return {};
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .in("entity_id", assetIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      for (const row of data ?? []) {
        if (!grouped[row.entity_id]) grouped[row.entity_id] = [];
        grouped[row.entity_id].push(row);
      }
      return grouped;
    },
    enabled: assetIds.length > 0,
  });

  // ── Chapter info ───────────────────────────────────────────────
  const { data: chapter } = useQuery({
    queryKey: ["debug-chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("chapter_name, chapter_number, course_id")
        .eq("id", chapterId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const current = debugAssets[currentIndex] ?? null;
  const totalAssets = debugAssets.length;
  const annotatedCount = annotatedIds.size + skippedIds.size;
  const isComplete = annotatedCount >= totalAssets && totalAssets > 0;
  const progressPct = totalAssets > 0 ? (annotatedCount / totalAssets) * 100 : 0;
  const currentLogs = current ? (activityLogs[current.id] ?? []) : [];

  // Reset forms when navigating
  useEffect(() => {
    setForms([emptyForm()]);
  }, [currentIndex]);

  // ── Save mutation ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!current || !chapterId) return;
      const validForms = forms.filter(f => f.errorField && f.errorType && f.whatWasWrong.trim());
      if (validForms.length === 0) throw new Error("At least one complete annotation is required");

      const promptLog = currentLogs.find((l: any) =>
        l.event_type?.includes("prompt") || l.event_type?.includes("request_start")
      );
      const outputLog = currentLogs.find((l: any) =>
        l.event_type?.includes("response") || l.event_type?.includes("output")
      );

      const rows = validForms.map(f => ({
        teaching_asset_id: current.id,
        chapter_id: chapterId,
        course_id: current.course_id,
        error_field: ERROR_FIELD_VALUES[f.errorField] || f.errorField,
        error_type: ERROR_TYPE_VALUES[f.errorType] || f.errorType,
        admin_note: f.whatWasWrong.trim(),
        correct_answer: f.correctAnswer.trim() || null,
        activity_log_snapshot: currentLogs,
        generation_prompt: promptLog?.payload_json ? JSON.stringify(promptLog.payload_json) : null,
        ai_output_raw: outputLog?.payload_json ? JSON.stringify(outputLog.payload_json) : null,
        annotated_by: user?.email || "unknown",
        debug_session_id: sessionId,
      }));

      const { error: insertError } = await supabase
        .from("generation_debug_notes" as any)
        .insert(rows as any);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("teaching_assets")
        .update({
          debug_session_id: sessionId,
          debug_annotated_at: new Date().toISOString(),
        } as any)
        .eq("id", current.id);
      if (updateError) throw updateError;

      // Track for completion
      setAllNotes(prev => [...prev, {
        assetName: current.asset_name,
        assetId: current.id,
        sourceRef: current.source_ref,
        coreRank: current.core_rank,
        notes: validForms.map(f => ({
          error_field: f.errorField,
          error_type: f.errorType,
          admin_note: f.whatWasWrong.trim(),
          correct_answer: f.correctAnswer.trim(),
        })),
      }]);
    },
    onSuccess: () => {
      if (!current) return;
      setAnnotatedIds(prev => new Set(prev).add(current.id));
      toast.success("Annotation saved");
      if (currentIndex < totalAssets - 1) setCurrentIndex(i => i + 1);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSkip = () => {
    if (!current) return;
    setSkippedIds(prev => new Set(prev).add(current.id));
    if (currentIndex < totalAssets - 1) setCurrentIndex(i => i + 1);
  };

  const isFormValid = forms.some(f => f.errorField && f.errorType && f.whatWasWrong.trim());

  // ── Generate markdown bundle ───────────────────────────────────
  const generateBundle = () => {
    const date = new Date().toLocaleDateString();
    let md = `# Chapter Debug Bundle\n\nChapter: ${chapter?.chapter_name || "?"} | Course: ${workspace?.courseName || "?"} | Date: ${date}\n\nSession ID: ${sessionId}\n\nAssets Annotated: ${allNotes.length} | Errors Logged: ${allNotes.reduce((s, a) => s + a.notes.length, 0)}\n\n---\n`;

    for (const asset of allNotes) {
      md += `\n## Asset: ${asset.assetName}${asset.sourceRef ? ` (${asset.sourceRef})` : ""}${asset.coreRank ? ` — Core Rank ${asset.coreRank}` : ""}\n`;
      asset.notes.forEach((n, i) => {
        md += `\n### Error ${i + 1}\n\n- Field: ${n.error_field}\n- Type: ${n.error_type}\n- What was wrong: ${n.admin_note}\n- Correct answer: ${n.correct_answer || "Not provided"}\n`;
      });
      const logs = activityLogs[asset.assetId];
      if (logs && logs.length > 0) {
        md += `\n### Generation Log\n\n`;
        for (const l of logs) {
          md += `- ${new Date(l.created_at).toLocaleTimeString()} [${l.event_type}] ${l.message}${l.provider ? ` (${l.provider}/${l.model})` : ""}\n`;
        }
      }
      md += `\n---\n`;
    }
    return md;
  };

  const handleCopyBundle = () => {
    navigator.clipboard.writeText(generateBundle());
    toast.success("Debug bundle copied to clipboard");
  };

  const handleDownloadBundle = () => {
    const blob = new Blob([generateBundle()], { type: "text/markdown;charset=utf-8" });
    const dateStr = new Date().toISOString().slice(0, 10);
    saveAs(blob, `debug-bundle-${chapterId}-${dateStr}.md`);
  };

  // ── Error type breakdown for completion ────────────────────────
  const errorBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allNotes) {
      for (const n of a.notes) {
        counts[n.error_type] = (counts[n.error_type] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allNotes]);

  // ── Render ─────────────────────────────────────────────────────
  if (!chapterId) {
    return (
      <SurviveSidebarLayout>
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-foreground">Debug Session</h2>
          <p className="text-muted-foreground text-sm">No chapter selected.</p>
        </div>
      </SurviveSidebarLayout>
    );
  }

  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </SurviveSidebarLayout>
    );
  }

  if (totalAssets === 0) {
    return (
      <SurviveSidebarLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <h2 className="text-xl font-bold text-foreground">No Assets Need Debugging</h2>
          <Button onClick={() => navigate("/phase2-review")}>Return to Phase 2 Review</Button>
        </div>
      </SurviveSidebarLayout>
    );
  }

  // ── Completion screen ──────────────────────────────────────────
  if (isComplete) {
    const totalErrors = allNotes.reduce((s, a) => s + a.notes.length, 0);
    return (
      <SurviveSidebarLayout>
        <div className="max-w-2xl mx-auto py-12 space-y-6">
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Debug Session Complete</h2>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{totalErrors}</strong> error{totalErrors !== 1 ? "s" : ""} logged across{" "}
              <strong className="text-foreground">{allNotes.length}</strong> asset{allNotes.length !== 1 ? "s" : ""}
            </p>
          </div>

          {errorBreakdown.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Error Breakdown</p>
                <div className="space-y-1">
                  {errorBreakdown.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-foreground capitalize">{type.replace("_", " ")}</span>
                      <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleCopyBundle}>
              <Copy className="h-4 w-4 mr-1.5" /> Copy Debug Bundle
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownloadBundle}>
              <Download className="h-4 w-4 mr-1.5" /> Download .md File
            </Button>
          </div>

          <div className="flex flex-col items-center gap-2 pt-4">
            <Button variant="ghost" onClick={() => navigate("/phase2-review")}>
              Return to Phase 2 Review
            </Button>
            <Button
              variant="link"
              className="text-xs"
              onClick={() => {
                localStorage.setItem("phase2-view-mode", "all");
                navigate("/phase2-review");
              }}
            >
              View All Debug Notes for this Chapter
            </Button>
          </div>
        </div>
      </SurviveSidebarLayout>
    );
  }

  // ── Annotation UI ──────────────────────────────────────────────
  const alreadyDone = current ? (annotatedIds.has(current.id) || skippedIds.has(current.id)) : false;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Bug className="h-5 w-5 text-destructive" />
              Debug Session — Ch {chapter?.chapter_number}: {chapter?.chapter_name}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {annotatedCount} / {totalAssets} annotated
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{totalAssets} asset{totalAssets !== 1 ? "s" : ""} to annotate</p>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {current && (
          <>
            {/* Asset header */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base font-bold text-foreground font-mono">{current.asset_name}</span>
              {current.source_ref && <Badge variant="secondary" className="text-[10px]">{current.source_ref}</Badge>}
              <RankBadge rank={current.core_rank} />
              <Badge variant="outline" className="text-[10px] font-mono">{currentIndex + 1} of {totalAssets}</Badge>
              {alreadyDone && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/40">Done</Badge>}
            </div>

            {/* Collapsible content sections */}
            <div className="space-y-1">
              <CollapsibleSection title="Problem Text & Context">
                {current.problem_context && <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-2">{current.problem_context}</p>}
                {current.survive_problem_text && <p className="text-sm text-foreground/90 whitespace-pre-wrap">{current.survive_problem_text}</p>}
              </CollapsibleSection>

              <CollapsibleSection title="Answer Text">
                {current.survive_solution_text ? (
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{current.survive_solution_text}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No answer text</p>
                )}
              </CollapsibleSection>

              {current.journal_entry_completed_json && (
                <CollapsibleSection title="Journal Entries">
                  <JournalEntryTable completedJson={current.journal_entry_completed_json as any} />
                </CollapsibleSection>
              )}

              {current.important_formulas && (
                <CollapsibleSection title="Important Formulas">
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{current.important_formulas}</p>
                </CollapsibleSection>
              )}

              {current.concept_notes && (
                <CollapsibleSection title="Concept Notes">
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{current.concept_notes}</p>
                </CollapsibleSection>
              )}

              {current.exam_traps && (
                <CollapsibleSection title="Exam Traps">
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{current.exam_traps}</p>
                </CollapsibleSection>
              )}

              {/* Generation log */}
              <CollapsibleSection title={`Generation Log (${currentLogs.length} entries)`}>
                {currentLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity log entries found</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {currentLogs.map((l: any, i: number) => (
                      <div key={l.id || i} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{l.event_type}</Badge>
                        <span className="text-foreground/80 truncate">{l.message}</span>
                        {l.provider && <span className="text-muted-foreground text-[10px]">{l.provider}/{l.model}</span>}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs mt-1"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(currentLogs, null, 2));
                        toast.success("Log copied");
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy Full Log
                    </Button>
                  </div>
                )}
              </CollapsibleSection>
            </div>

            {/* Annotation form(s) */}
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Annotation</p>

                {forms.map((form, fi) => (
                  <div key={form.id} className="space-y-3 pb-3 border-b border-border/50 last:border-b-0 last:pb-0">
                    {forms.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground">Error {fi + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setForms(prev => prev.filter((_, j) => j !== fi))}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Error Field *</label>
                        <Select value={form.errorField} onValueChange={v => setForms(prev => prev.map((f, j) => j === fi ? { ...f, errorField: v } : f))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field…" /></SelectTrigger>
                          <SelectContent>
                            {ERROR_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Error Type *</label>
                        <Select value={form.errorType} onValueChange={v => setForms(prev => prev.map((f, j) => j === fi ? { ...f, errorType: v } : f))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select type…" /></SelectTrigger>
                          <SelectContent>
                            {ERROR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">What was wrong? *</label>
                      <Textarea
                        value={form.whatWasWrong}
                        onChange={e => setForms(prev => prev.map((f, j) => j === fi ? { ...f, whatWasWrong: e.target.value } : f))}
                        placeholder="Describe what the AI produced that was incorrect..."
                        className="text-sm min-h-[60px]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 block">Correct answer (optional)</label>
                      <Textarea
                        value={form.correctAnswer}
                        onChange={e => setForms(prev => prev.map((f, j) => j === fi ? { ...f, correctAnswer: e.target.value } : f))}
                        placeholder="What should the correct output have been?"
                        className="text-sm min-h-[50px]"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary"
                  onClick={() => setForms(prev => [...prev, emptyForm()])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add another error
                </Button>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentIndex <= 0}
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                size="default"
                className="font-bold"
                disabled={!isFormValid || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save & Next →
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleSkip}
              >
                <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
              </Button>
            </div>
          </>
        )}
      </div>
    </SurviveSidebarLayout>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground w-full text-left py-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {title}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
