import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, RefreshCw, Eye, GitCompare, BookOpen, Loader2, Sparkles, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { runValidation, hasFailures, type ValidationResult, type AnswerPackageData } from "@/lib/validation";
import { logActivity } from "@/lib/activityLogger";
import { normalizeValidatePersistAnswerPackage, persistUnparseablePackage } from "@/lib/answerPackagePipeline";
import { detectAndSplitScenarios, buildScenarioPromptBlock, buildSingleScenarioPromptBlock, type ScenarioBlock } from "@/lib/scenarioSegmentation";
import { RepairNotesPanel } from "./RepairNotesPanel";
import { ScenarioSplitScreen } from "./ScenarioSplitScreen";
import { RegenerateDialog } from "./RegenerateDialog";
import { VersionDiffView } from "./VersionDiffView";
import { FinalAnswersPanel, type FinalAnswer } from "./FinalAnswersPanel";
import { JournalEntryEditor, groupsToSections, sectionsToGroups, type JESection } from "./JournalEntryEditor";
import { AIComparisonPanel } from "./AIComparisonPanel";
import { ValidationPanel } from "./ValidationPanel";

interface Props {
  sourceProblemId: string;
  problemText?: string;
  solutionText?: string;
}

const STATUS_STYLES: Record<string, string> = {
  drafted: "bg-muted text-muted-foreground",
  needs_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
};

// ValidationIcon moved to ValidationPanel

/** Extract structured sections from answer_payload */
function extractFinalAnswers(payload: any): FinalAnswer[] {
  if (!payload) return [];
  if (Array.isArray(payload.final_answers)) return payload.final_answers;
  // Legacy: try to extract from flat payload
  if (payload.numeric_results && typeof payload.numeric_results === "object") {
    return Object.entries(payload.numeric_results).map(([k, v]) => ({
      label: k,
      value: v as string | number,
    }));
  }
  return [];
}

function extractTeachingJE(payload: any): JESection[] {
  if (!payload) return [];

  // NEW: scenario_sections → entries_by_date format
  const scenarioSections: any[] = payload?.scenario_sections || payload?.teaching_aids?.scenario_sections || [];
  if (scenarioSections.length > 0) {
    const allSections: JESection[] = [];
    for (const scenario of scenarioSections) {
      const entriesByDate: any[] = scenario.entries_by_date || scenario.journal_entries || [];
      for (const entry of entriesByDate) {
        const label = scenarioSections.length > 1 ? `${scenario.label} — ${entry.entry_date || ""}` : (entry.entry_date || "");
        allSections.push({
          entry_date: label,
          lines: (entry.rows || entry.lines || []).map((l: any) => ({
            account_name: l.account_name || "",
            debit: l.debit != null ? Number(l.debit) : null,
            credit: l.credit != null ? Number(l.credit) : null,
            memo: l.memo || "",
            indentation_level: (l.credit != null && l.credit !== 0) ? 1 : 0,
          })),
        });
      }
    }
    if (allSections.length > 0) return allSections;
  }

  if (payload.teaching_aids?.journal_entries) {
    if (Array.isArray(payload.teaching_aids.journal_entries) && payload.teaching_aids.journal_entries[0]?.entry_date !== undefined) {
      return payload.teaching_aids.journal_entries;
    }
    return groupsToSections(payload.teaching_aids.journal_entries);
  }
  if (payload.journal_entries) {
    return groupsToSections(payload.journal_entries);
  }
  return [];
}

function extractTeachingText(payload: any): string | null {
  return payload?.teaching_aids?.explanation || payload?.teaching_aids?.calculation_breakdown || null;
}

export function AnswerPackagePanel({ sourceProblemId, problemText, solutionText }: Props) {
  const qc = useQueryClient();
  const [showWork, setShowWork] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [showTeachingAids, setShowTeachingAids] = useState(true);
  const [genProvider, setGenProvider] = useState<"lovable" | "openai">("lovable");
  const [genModel, setGenModel] = useState("gpt-4.1");
  const [showScenarioSplit, setShowScenarioSplit] = useState(false);
  const [confirmedScenarioBlocks, setConfirmedScenarioBlocks] = useState<ScenarioBlock[] | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["answer-packages", sourceProblemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("answer_packages")
        .select("*")
        .eq("source_problem_id", sourceProblemId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!sourceProblemId,
  });

  const { data: openRepairNotes } = useQuery({
    queryKey: ["repair-notes-open", sourceProblemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_notes")
        .select("*")
        .eq("source_problem_id", sourceProblemId)
        .eq("status", "open" as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!sourceProblemId,
  });

  const latest = packages?.[0];
  const olderVersions = packages?.slice(1) ?? [];
  const validationResults: ValidationResult[] = latest?.validation_results ?? [];
  const failed = hasFailures(validationResults);
  const hasWarnings = validationResults.some(r => r.status === "warn");

  const outputType: string = latest?.output_type ?? "mixed";
  const finalAnswers = extractFinalAnswers(latest?.answer_payload);
  const teachingJE = extractTeachingJE(latest?.answer_payload);
  const teachingText = extractTeachingText(latest?.answer_payload);
  const isJEOutputType = outputType === "journal_entries" || outputType === "mixed";

  // Save user edits as new version
  const saveEditMutation = useMutation({
    mutationFn: async (updatedPayload: any) => {
      if (!latest) return;
      const { data: { user } } = await supabase.auth.getUser();
      const newVersion = latest.version + 1;

      // Compute diff for repair note
      const diff = {
        previous_version: latest.version,
        changes: Object.keys(updatedPayload).filter(k => JSON.stringify(updatedPayload[k]) !== JSON.stringify(latest.answer_payload[k])),
      };

      // Create new answer package version
      const { error } = await supabase.from("answer_packages").insert({
        source_problem_id: sourceProblemId,
        version: newVersion,
        generator: "mixed" as any,
        extracted_inputs: latest.extracted_inputs,
        computed_values: latest.computed_values,
        answer_payload: updatedPayload,
        validation_results: latest.validation_results,
        status: "drafted" as any,
        output_type: latest.output_type,
      } as any);
      if (error) throw error;

      // Auto-create repair note
      await supabase.from("repair_notes").insert({
        source_problem_id: sourceProblemId,
        answer_package_id: latest.id,
        note_type: "math_fix" as any,
        what_was_wrong: `User manually edited: ${diff.changes.join(", ")}`,
        desired_fix: "Applied directly by user",
        created_by: user?.id,
        status: "resolved" as any,
        resolved_at: new Date().toISOString(),
      } as any);

      // Activity log
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "USER_EDIT",
        payload_json: { previous_version: latest.version, new_version: newVersion, diff },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      qc.invalidateQueries({ queryKey: ["repair-notes-open"] });
      toast.success("Saved as new version");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFinalAnswersEdit = useCallback((answers: FinalAnswer[]) => {
    if (!latest) return;
    const updated = { ...latest.answer_payload, final_answers: answers };
    saveEditMutation.mutate(updated);
  }, [latest, saveEditMutation]);

  const handleJEEdit = useCallback((sections: JESection[]) => {
    if (!latest) return;
    const updated = {
      ...latest.answer_payload,
      teaching_aids: {
        ...(latest.answer_payload?.teaching_aids ?? {}),
        journal_entries: sections,
      },
    };
    saveEditMutation.mutate(updated);
  }, [latest, saveEditMutation]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!latest) return;
      if (failed) throw new Error("Cannot approve with validation failures");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("answer_packages").update({
        status: "approved" as any,
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      } as any).eq("id", latest.id);
      if (error) throw error;
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "answer_package_approved",
        payload_json: { package_id: latest.id, version: latest.version },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      toast.success("Answer package approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revalidateMutation = useMutation({
    mutationFn: async () => {
      if (!latest) return;
      const pkg: AnswerPackageData = {
        answer_payload: latest.answer_payload ?? {},
        extracted_inputs: latest.extracted_inputs ?? {},
        computed_values: latest.computed_values ?? {},
      };
      const results = runValidation(pkg);
      const newStatus = hasFailures(results) ? "needs_review" : "drafted";
      const { error } = await supabase.from("answer_packages").update({
        validation_results: results as any,
        status: newStatus as any,
      } as any).eq("id", latest.id);
      if (error) throw error;
      await logActivity({
        actor_type: "system",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "validation_rerun",
        payload_json: { package_id: latest.id, results },
        severity: hasFailures(results) ? "warn" : "info",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      toast.success("Validation re-run complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initialGenMutation = useMutation({
    mutationFn: async () => {
      // Use confirmed scenario blocks or auto-detect
      const scenarioBlocks = confirmedScenarioBlocks ?? [];
      const isMulti = scenarioBlocks.length >= 2;
      const scenarioLabels = isMulti ? scenarioBlocks.map(b => b.label) : [];

      const scenarioPromptBlock = isMulti
        ? buildScenarioPromptBlock(scenarioBlocks)
        : buildSingleScenarioPromptBlock();

      const systemPrompt = `You are an expert accounting professor. Analyze this problem and provide the answer in valid JSON.\n\nProblem:\n${problemText || "No problem text"}\n\nSolution Reference:\n${solutionText || "No solution text"}\n\n${scenarioPromptBlock}\n\nRules:\n- requires_je must be true if the problem asks for journal entries\n- Use scenario_sections with entries_by_date format\n- Each entry_by_date must balance\n- Each row: exactly one of debit or credit\n- account_name: clean text only (no $, no :, no a./b./c., no 1./2.)\n- Also include: {"final_answers": [{"label": string, "value": string}]}`;

      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: genProvider,
          model: genProvider === "openai" ? genModel : "google/gemini-2.5-flash",
          temperature: 0.2,
          max_output_tokens: 4000,
          source_problem_id: sourceProblemId,
          messages: [
            { role: "system", content: "You are an expert accounting professor. Return answers in valid JSON using the scenario_sections/entries_by_date schema." },
            { role: "user", content: systemPrompt },
          ],
        },
      });
      if (aiErr) throw aiErr;
      if (aiResult.error) throw new Error(aiResult.error);

      const parsed = aiResult.parsed;
      const selectedModel = genProvider === "openai" ? genModel : "google/gemini-2.5-flash";
      if (!parsed) {
        await persistUnparseablePackage(sourceProblemId, 1, aiResult.raw, { provider: genProvider, model: selectedModel });
        throw new Error("AI returned invalid JSON — saved as needs_review");
      }

      // Save scenario_blocks_json to source problem if multi-scenario
      if (isMulti) {
        await supabase.from("chapter_problems").update({
          scenario_blocks_json: scenarioBlocks as any,
        } as any).eq("id", sourceProblemId);
      }

      await normalizeValidatePersistAnswerPackage({
        source_problem_id: sourceProblemId,
        version: 1,
        generator: "ai",
        answer_payload: parsed,
        extracted_inputs: {
          ...(scenarioLabels.length > 0 ? { scenario_labels: scenarioLabels } : {}),
          problem_text: problemText || "",
        },
        output_type: "mixed",
        provider: genProvider,
        model: selectedModel,
        token_usage: aiResult.token_usage,
        generation_time_ms: aiResult.generation_time_ms,
        log_event_type: "ai_generation_test",
        log_extra_payload: { mode: "initial", scenario_count: scenarioLabels.length },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["answer-packages"] }); toast.success(`Initial generation complete (${genProvider})`); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading answer packages…</p>;

  return (
    <div className="space-y-4">
      {/* Repair Notes */}
      <RepairNotesPanel sourceProblemId={sourceProblemId} latestPackageId={latest?.id} />

      <div className="border-t border-border pt-3" />

      {!latest ? (
        <div className="space-y-3">
          {/* Step 0: Scenario Split Screen */}
          {showScenarioSplit && (
            <ScenarioSplitScreen
              problemText={problemText || ""}
              onConfirm={(blocks) => {
                setConfirmedScenarioBlocks(blocks.length >= 2 ? blocks : null);
                setShowScenarioSplit(false);
              }}
              onSkip={() => {
                setConfirmedScenarioBlocks(null);
                setShowScenarioSplit(false);
              }}
            />
          )}

          {/* Confirmed scenario info */}
          {confirmedScenarioBlocks && confirmedScenarioBlocks.length >= 2 && !showScenarioSplit && (
            <div className="rounded border border-primary/30 bg-primary/5 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-primary font-medium">
                ✓ {confirmedScenarioBlocks.length} scenarios confirmed: {confirmedScenarioBlocks.map(b => b.label).join(", ")}
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowScenarioSplit(true)}>
                Edit Split
              </Button>
            </div>
          )}

          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-xs text-muted-foreground">No answer packages generated yet. Generate the first one:</p>
            <div className="flex gap-2 items-center flex-wrap">
              {!showScenarioSplit && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowScenarioSplit(true)}>
                  <Scissors className="h-3 w-3 mr-1" /> Split Scenarios
                </Button>
              )}
              <Select value={genProvider} onValueChange={(v) => setGenProvider(v as any)}>
                <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              {genProvider === "openai" && (
                <Select value={genModel} onValueChange={setGenModel}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4.1">gpt-4.1 (accuracy)</SelectItem>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini (cheap)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={() => initialGenMutation.mutate()} disabled={initialGenMutation.isPending || !problemText}>
                {initialGenMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" /> Generate ({genProvider === "openai" ? `OpenAI/${genModel}` : "Lovable"})</>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header with status + actions */}
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Answer Package v{latest.version}</span>
              <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[latest.status])}>
                {latest.status === "needs_review" ? "Needs Review" : latest.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{latest.generator}</Badge>
              <Badge variant="outline" className="text-[10px] capitalize">{outputType.replace("_", " ")}</Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => revalidateMutation.mutate()} disabled={revalidateMutation.isPending}>
                <RefreshCw className="h-3 w-3 mr-1" /> Re-validate
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setRegenOpen(true)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Regenerate (This Problem Only)
              </Button>
              {packages && packages.length > 1 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setDiffMode(!diffMode)}>
                  <GitCompare className="h-3 w-3 mr-1" /> {diffMode ? "Hide Diff" : "Diff"}
                </Button>
              )}
              {!failed && latest.status !== "approved" && (
                <Button
                  size="sm"
                  className="h-6 text-[10px]"
                  variant={hasWarnings ? "outline" : "default"}
                  onClick={() => {
                    if (hasWarnings) {
                      if (!window.confirm("There are validation warnings. Approve anyway?")) return;
                    }
                    approveMutation.mutate();
                  }}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {hasWarnings ? "Override & Approve" : "Approve"}
                </Button>
              )}
            </div>
          </div>

          {/* Validation failures banner */}
          {failed && (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Validation Failures — Cannot Approve
              </p>
            </div>
          )}

          {/* Diff View */}
          {diffMode && packages && <VersionDiffView packages={packages} />}

          {/* Main content (non-diff) */}
          {!diffMode && (
            <div className="space-y-5">
              {/* SECTION A: Final Answers */}
              <FinalAnswersPanel
                answers={finalAnswers}
                outputType={outputType}
                onEdit={handleFinalAnswersEdit}
              />

              {/* SECTION B: Teaching Aids */}
              <Collapsible open={showTeachingAids} onOpenChange={setShowTeachingAids}>
                <CollapsibleTrigger className="flex items-center gap-2 text-xs hover:underline">
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                    {isJEOutputType ? "Journal Entries" : "Teaching Journal Entries (Optional Reference)"}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", showTeachingAids && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {teachingJE.length > 0 ? (
                    <JournalEntryEditor
                      sections={teachingJE}
                      onChange={handleJEEdit}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No journal entries in this package.</p>
                  )}
                  {teachingText && (
                    <div className="rounded border border-border bg-card p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Explanation / Calculation Breakdown</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{teachingText}</p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Validation results */}
              <ValidationPanel
                results={validationResults}
                sections={teachingJE}
                onAutoFix={(fixedSections, description) => {
                  if (!latest) return;
                  const updated = {
                    ...latest.answer_payload,
                    teaching_aids: {
                      ...(latest.answer_payload?.teaching_aids ?? {}),
                      journal_entries: fixedSections,
                    },
                  };
                  saveEditMutation.mutate(updated);
                }}
              />

              {/* Show Work */}
              <Collapsible open={showWork} onOpenChange={setShowWork}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Eye className="h-3 w-3" /> Show Work
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showWork && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Extracted Inputs</p>
                    <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(latest.extracted_inputs, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Computed Values</p>
                    <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(latest.computed_values, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Raw Answer Payload</p>
                    <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(latest.answer_payload, null, 2)}</pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Older versions */}
          {olderVersions.length > 0 && !diffMode && (
            <Collapsible open={showAllVersions} onOpenChange={setShowAllVersions}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAllVersions && "rotate-180")} />
                {olderVersions.length} older version(s)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1">
                {olderVersions.map((pkg) => (
                  <div key={pkg.id} className="flex items-center gap-2 px-2 py-1 text-xs border border-border rounded">
                    <span>v{pkg.version}</span>
                    <Badge variant="outline" className={cn("text-[9px]", STATUS_STYLES[pkg.status])}>{pkg.status}</Badge>
                    <span className="text-muted-foreground">{pkg.generator}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(pkg.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      {/* AI Provider Testing */}
      {latest && problemText && (
        <AIComparisonPanel
          sourceProblemId={sourceProblemId}
          problemText={problemText}
          solutionText={solutionText ?? ""}
          latestPackage={latest}
        />
      )}

      {/* Regenerate Dialog */}
      <RegenerateDialog
        sourceProblemId={sourceProblemId}
        latestPackage={latest}
        openRepairNotes={openRepairNotes}
        open={regenOpen}
        onOpenChange={setRegenOpen}
        problemText={problemText}
        solutionText={solutionText}
      />
    </div>
  );
}
