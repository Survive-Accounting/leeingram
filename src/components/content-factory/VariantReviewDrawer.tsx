import { useState, useCallback, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Check, X, Save, ChevronDown, AlertTriangle, Info, Lock, CheckCircle2,
  Circle, XCircle, ScrollText, Plus, Sparkles, Loader2, Pencil,
} from "lucide-react";
import { ScenarioAccordion } from "./ScenarioAccordion";
import { EntryByDateCard, type DateEntryStatus as CardDateEntryStatus } from "./EntryByDateCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JournalEntryEditor, groupsToSections, type JESection } from "./JournalEntryEditor";
import { ValidationPanel } from "./ValidationPanel";
import { runValidation, hasFailures, type AnswerPackageData, type ValidationResult } from "@/lib/validation";
import { parseLegacyAnswerOnly, parseLegacyJEBlock, isCanonicalJE } from "@/lib/journalEntryParser";
import { detectRequiresJE } from "@/lib/legacyJENormalizer";
import { logActivity } from "@/lib/activityLogger";
import { useChapterApprovedAccounts } from "./ChapterAccountsSetup";
import { ActivityLogPanel } from "./ActivityLogPanel";
import {
  SKELETON_SYSTEM_PROMPT, buildSkeletonUserPrompt,
  SINGLE_DATE_SYSTEM_PROMPT, buildSingleDateUserPrompt,
} from "@/lib/jeSkeletonPrompts";
import { GenerationLogger } from "@/lib/generationLogger";

// ── Types ──

interface VariantReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: any;
  problem: any;
  chapterId: string;
  onApproved: () => void;
  onRejected: () => void;
}

type DateEntryStatus = "empty" | "drafted" | "edited" | "validated";

interface SkeletonScenario {
  scenario_label: string;
  entry_dates: string[];
}

interface SkeletonData {
  scenario_sections: SkeletonScenario[];
}

interface DateEntryRows {
  rows: Array<{
    account_name: string;
    debit: number | null;
    credit: number | null;
    coa_id?: string | null;
    display_name?: string;
    unknown_account?: boolean;
    memo?: string;
  }>;
}

// Map: "scenarioLabel::date" -> DateEntryRows
type EntriesMap = Record<string, DateEntryRows>;
// Map: "scenarioLabel::date" -> DateEntryStatus
type StatusMap = Record<string, DateEntryStatus>;

function dateKey(scenario: string, date: string): string {
  return `${scenario}::${date}`;
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

function entryBalanceFromRows(rows: DateEntryRows["rows"]): { balanced: boolean; diff: number } {
  const d = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
  const c = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
  return { balanced: Math.abs(d - c) < 0.02, diff: Math.abs(d - c) };
}

function runDateValidation(rows: DateEntryRows["rows"], reqJE?: boolean): ValidationResult[] {
  const section: JESection = {
    entry_date: "",
    lines: rows.map(r => ({
      account_name: r.account_name,
      debit: r.debit,
      credit: r.credit,
      memo: r.memo || "",
      indentation_level: (r.credit != null && r.credit !== 0 ? 1 : 0) as 0 | 1,
    })),
  };
  const pkg: AnswerPackageData = {
    answer_payload: { teaching_aids: { journal_entries: [section] } },
    extracted_inputs: {},
    computed_values: {},
    requires_je: reqJE,
  };
  return runValidation(pkg);
}

// ── Try to extract skeleton from existing candidate data ──
function extractSkeletonFromCandidate(candidate: any): SkeletonData | null {
  const ss = candidate?.scenario_sections || candidate?.teaching_aids?.scenario_sections;
  if (!Array.isArray(ss) || ss.length === 0) return null;
  
  const sections: SkeletonScenario[] = ss.map((sc: any) => ({
    scenario_label: sc.label || sc.scenario_label || "Journal Entry",
    entry_dates: (sc.entries_by_date || sc.journal_entries || []).map(
      (e: any) => e.entry_date || e.date || ""
    ).filter(Boolean),
  }));

  if (sections.some(s => s.entry_dates.length > 0)) return { scenario_sections: sections };
  return null;
}

function extractEntriesFromCandidate(candidate: any): EntriesMap {
  const map: EntriesMap = {};
  const ss = candidate?.scenario_sections || candidate?.teaching_aids?.scenario_sections;
  if (!Array.isArray(ss)) return map;

  for (const sc of ss) {
    const label = sc.label || sc.scenario_label || "Journal Entry";
    for (const entry of (sc.entries_by_date || sc.journal_entries || [])) {
      const d = entry.entry_date || entry.date || "";
      if (!d) continue;
      const rows = (entry.rows || entry.lines || []).map((r: any) => ({
        account_name: r.account_name || r.account || "",
        debit: r.debit != null ? Number(r.debit) : null,
        credit: r.credit != null ? Number(r.credit) : null,
        coa_id: r.coa_id || null,
        display_name: r.display_name,
        unknown_account: r.unknown_account || r.needs_review,
        memo: r.memo || "",
      }));
      if (rows.length > 0) map[dateKey(label, d)] = { rows };
    }
  }
  return map;
}

// ── Component ──

export function VariantReviewDrawer({ open, onOpenChange, variant, problem, chapterId, onApproved, onRejected }: VariantReviewDrawerProps) {
  const { data: approvedAccounts } = useChapterApprovedAccounts(chapterId);

  // Core state
  const [skeleton, setSkeleton] = useState<SkeletonData | null>(null);
  const [entries, setEntries] = useState<EntriesMap>({});
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [saving, setSaving] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const [requiresJE, setRequiresJE] = useState(false);
  const [generatingSkeleton, setGeneratingSkeleton] = useState(false);
  const [generatingDate, setGeneratingDate] = useState<string | null>(null); // dateKey being generated
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [globalValidation, setGlobalValidation] = useState<ValidationResult[]>([]);
  const [approvalBlockedModal, setApprovalBlockedModal] = useState(false);
  const [recentFixes, setRecentFixes] = useState<any[]>([]);
  const [showFixes, setShowFixes] = useState(false);
  const [showGenLog, setShowGenLog] = useState(false);

  // Init
  useEffect(() => {
    if (!variant || !open) return;
    
    const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
    const needsJE = detectRequiresJE(problemText);
    setRequiresJE(needsJE);

    // Try to load existing skeleton from DB fields or extract from candidate_data
    const dbSkeleton = variant.je_skeleton_json as SkeletonData | null;
    const dbEntries = (variant.je_entries_json || {}) as EntriesMap;
    const dbStatuses = (variant.je_entry_status_json || {}) as StatusMap;

    if (dbSkeleton && dbSkeleton.scenario_sections?.length > 0) {
      setSkeleton(dbSkeleton);
      setEntries(dbEntries);
      setStatuses(dbStatuses);
    } else {
      // Try extracting from candidate_data
      const candidateSkeleton = extractSkeletonFromCandidate(
        variant.candidate_data || variant.journal_entry_completed_json
      );
      const candidateEntries = extractEntriesFromCandidate(
        variant.candidate_data || variant.journal_entry_completed_json
      );

      if (candidateSkeleton) {
        setSkeleton(candidateSkeleton);
        setEntries(candidateEntries);
        // Mark entries with data as drafted
        const initStatuses: StatusMap = {};
        for (const key of Object.keys(candidateEntries)) {
          initStatuses[key] = "drafted";
        }
        setStatuses(initStatuses);
      } else {
        setSkeleton(null);
        setEntries({});
        setStatuses({});
      }
    }

    setHasEdits(false);
    setEditVersion(0);
    setEditingDate(null);
    loadRecentFixes();
  }, [variant, open]);

  // Recompute global validation whenever entries change
  useEffect(() => {
    if (!skeleton) return;
    runGlobalValidationFromEntries();
  }, [entries, skeleton]);

  const loadRecentFixes = async () => {
    if (!chapterId) return;
    const { data } = await supabase
      .from("correction_events").select("*")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false }).limit(5);
    setRecentFixes(data || []);
  };

  const runGlobalValidationFromEntries = () => {
    if (!skeleton) { setGlobalValidation([]); return; }
    // Build full sections for global validation
    const allSections: JESection[] = [];
    for (const sc of skeleton.scenario_sections) {
      for (const d of sc.entry_dates) {
        const key = dateKey(sc.scenario_label, d);
        const entry = entries[key];
        if (entry) {
          allSections.push({
            entry_date: skeleton.scenario_sections.length > 1
              ? `${sc.scenario_label} — ${d}`
              : d,
            lines: entry.rows.map(r => ({
              account_name: r.account_name,
              debit: r.debit,
              credit: r.credit,
              memo: r.memo || "",
              indentation_level: (r.credit != null && r.credit !== 0 ? 1 : 0) as 0 | 1,
            })),
          });
        }
      }
    }
    const pkg: AnswerPackageData = {
      answer_payload: { teaching_aids: { journal_entries: allSections } },
      extracted_inputs: {},
      computed_values: {},
      requires_je: requiresJE,
    };
    setGlobalValidation(runValidation(pkg));
  };

  // ── Skeleton Generation ──
  const handleGenerateSkeleton = async () => {
    setGeneratingSkeleton(true);
    const logger = new GenerationLogger({
      course_id: problem?.course_id,
      chapter_id: chapterId,
      source_problem_id: problem?.id || variant.base_problem_id,
      provider: "lovable",
      model: "google/gemini-2.5-flash",
    });

    try {
      await logger.start();
      await logger.info("frontend", "CLICK_GENERATE", "User clicked Generate Skeleton", {
        variant_id: variant._variantId || variant.id,
        problem_id: problem?.id,
      });

      const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
      const solutionText = variant.survive_solution_text || variant.variant_solution_text || problem?.solution_text || "";

      await logger.info("frontend", "REQUEST_START", "Calling generate-ai-output for skeleton");

      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          temperature: 0.1,
          max_output_tokens: 2000,
          source_problem_id: problem?.id || variant.base_problem_id || "unknown",
          run_id: logger.runId,
          messages: [
            { role: "system", content: SKELETON_SYSTEM_PROMPT },
            { role: "user", content: buildSkeletonUserPrompt({ problemText, solutionText }) },
          ],
        },
      });

      await logger.info("frontend", "REQUEST_END", "Edge function returned", {
        has_error: !!error,
        has_data_error: !!data?.error,
        has_parsed: !!data?.parsed,
        generation_time_ms: data?.generation_time_ms,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (!data.parsed?.scenario_sections) throw new Error("Invalid skeleton response");

      const sk: SkeletonData = {
        scenario_sections: data.parsed.scenario_sections.map((s: any) => ({
          scenario_label: s.scenario_label || "Journal Entry",
          entry_dates: (s.entry_dates || []).filter(Boolean),
        })),
      };

      await logger.info("frontend", "SAVE_VARIANT_START", "Saving skeleton to variant", {
        scenario_count: sk.scenario_sections.length,
        total_dates: sk.scenario_sections.reduce((s, sc) => s + sc.entry_dates.length, 0),
      });

      setSkeleton(sk);
      setEntries({});
      setStatuses({});
      setHasEdits(true);

      if (variant._variantId || variant.id) {
        await supabase.from("problem_variants").update({
          je_skeleton_json: sk as any,
          je_entries_json: {} as any,
          je_entry_status_json: {} as any,
        } as any).eq("id", variant._variantId || variant.id);
      }

      await logger.info("frontend", "SAVE_VARIANT_END", "Skeleton persisted");
      await logger.finalize("success", { variant_id: variant._variantId || variant.id });

      toast.success(`Skeleton generated: ${sk.scenario_sections.reduce((s, sc) => s + sc.entry_dates.length, 0)} dates across ${sk.scenario_sections.length} scenario(s)`);
    } catch (err: any) {
      await logger.error("frontend", "GENERATION_ERROR", err?.message || "Skeleton generation failed", { stack: err?.stack?.slice(0, 500) });
      await logger.finalize("failed", { error_summary: err?.message });
      toast.error(err?.message || "Skeleton generation failed");
    } finally {
      setGeneratingSkeleton(false);
    }
  };

  // ── Per-Date Row Generation ──
  const handleGenerateRows = async (scenarioLabel: string, date: string) => {
    const key = dateKey(scenarioLabel, date);
    setGeneratingDate(key);

    const logger = new GenerationLogger({
      course_id: problem?.course_id,
      chapter_id: chapterId,
      source_problem_id: problem?.id || variant.base_problem_id,
      provider: "lovable",
      model: "google/gemini-2.5-flash",
    });

    try {
      await logger.start();
      await logger.info("frontend", "CLICK_GENERATE", `Generate rows for ${scenarioLabel} / ${date}`, {
        scenario_label: scenarioLabel,
        target_date: date,
        variant_id: variant._variantId || variant.id,
      });

      const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
      const solutionText = variant.survive_solution_text || variant.variant_solution_text || problem?.solution_text || "";

      // Gather prior entries for context
      const priorEntries: Array<{ date: string; rows: any[] }> = [];
      if (skeleton) {
        const sc = skeleton.scenario_sections.find(s => s.scenario_label === scenarioLabel);
        if (sc) {
          for (const d of sc.entry_dates) {
            if (d === date) break;
            const priorKey = dateKey(scenarioLabel, d);
            if (entries[priorKey]) {
              priorEntries.push({ date: d, rows: entries[priorKey].rows });
            }
          }
        }
      }

      await logger.info("frontend", "REQUEST_START", "Calling generate-ai-output for rows", {
        prior_entries_count: priorEntries.length,
        coa_count: approvedAccounts?.length ?? 0,
      });

      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          temperature: 0.2,
          max_output_tokens: 2000,
          source_problem_id: problem?.id || variant.base_problem_id || "unknown",
          run_id: logger.runId,
          messages: [
            { role: "system", content: SINGLE_DATE_SYSTEM_PROMPT },
            { role: "user", content: buildSingleDateUserPrompt({
              problemText,
              solutionText,
              scenarioLabel,
              targetDate: date,
              chartOfAccounts: approvedAccounts?.map((a: any) => a.account_name) || [],
              priorEntries,
            }) },
          ],
        },
      });

      await logger.info("frontend", "REQUEST_END", "Edge function returned", {
        has_error: !!error,
        has_data_error: !!data?.error,
        has_parsed: !!data?.parsed,
        parsed_has_rows: !!data?.parsed?.rows,
        row_count: data?.parsed?.rows?.length ?? 0,
        generation_time_ms: data?.generation_time_ms,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (!data.parsed?.rows || !Array.isArray(data.parsed.rows)) throw new Error("Invalid rows response");

      const newRows: DateEntryRows = {
        rows: data.parsed.rows.map((r: any) => ({
          account_name: r.account || r.account_name || "",
          debit: r.debit != null ? Number(r.debit) : null,
          credit: r.credit != null ? Number(r.credit) : null,
          unknown_account: r.needs_review || false,
          memo: "",
        })),
      };

      // Run validators on the generated rows
      const vr = runDateValidation(newRows.rows, requiresJE);
      await logger.info("validator", "RUN_VALIDATORS_END", `Validators ran: ${vr.length} checks`, {
        validator_results: vr.map(v => ({ name: v.validator, status: v.status, message: v.message })),
      });

      await logger.info("frontend", "SAVE_VARIANT_START", `Saving ${newRows.rows.length} rows`, {
        row_count: newRows.rows.length,
        rows_preview: newRows.rows.slice(0, 5),
      });

      setEntries(prev => ({ ...prev, [key]: newRows }));
      setStatuses(prev => ({ ...prev, [key]: "drafted" }));
      setHasEdits(true);
      setEditingDate(key);

      await persistEntriesToDB({ ...entries, [key]: newRows }, { ...statuses, [key]: "drafted" });

      await logger.info("frontend", "SAVE_VARIANT_END", "Rows persisted to variant");
      await logger.finalize("success", { variant_id: variant._variantId || variant.id });

      toast.success(`Generated ${newRows.rows.length} rows for ${formatDate(date)}`);
    } catch (err: any) {
      await logger.error("frontend", "GENERATION_ERROR", err?.message || "Row generation failed", { stack: err?.stack?.slice(0, 500) });
      await logger.finalize("failed", { error_summary: err?.message });
      toast.error(err?.message || "Row generation failed");
    } finally {
      setGeneratingDate(null);
    }
  };

  // ── Edit rows for a date ──
  const handleDateRowsChange = (key: string, newSection: JESection) => {
    const newRows: DateEntryRows = {
      rows: newSection.lines.map(l => ({
        account_name: l.account_name,
        debit: l.debit,
        credit: l.credit,
        coa_id: (l as any).coa_id || null,
        display_name: (l as any).display_name,
        unknown_account: (l as any).unknown_account,
        memo: l.memo || "",
      })),
    };
    setEntries(prev => ({ ...prev, [key]: newRows }));
    setStatuses(prev => {
      const current = prev[key];
      return { ...prev, [key]: current === "validated" ? "edited" : (current === "empty" ? "drafted" : current) };
    });
    setHasEdits(true);
  };

  // ── Mark Entry Correct ──
  const handleMarkCorrect = async (key: string) => {
    const entry = entries[key];
    if (!entry) return;

    const bal = entryBalanceFromRows(entry.rows);
    if (!bal.balanced) {
      toast.error(`Entry is off by $${bal.diff.toFixed(2)} — fix balance first`);
      return;
    }

    const vr = runDateValidation(entry.rows, requiresJE);
    if (vr.some(r => r.status === "fail")) {
      toast.error("Fix validation errors before marking correct");
      return;
    }

    setStatuses(prev => ({ ...prev, [key]: "validated" }));
    const newStatuses = { ...statuses, [key]: "validated" as DateEntryStatus };
    await persistEntriesToDB(entries, newStatuses);
    toast.success("Entry marked as validated");
  };

  // ── Persist to DB ──
  const persistEntriesToDB = async (ent: EntriesMap, sts: StatusMap) => {
    const variantId = variant._variantId || variant.id;
    if (!variantId) return;

    // Also build the full journal_entry_completed_json for backward compat
    const completedSections = skeleton?.scenario_sections.map(sc => ({
      label: sc.scenario_label,
      entries_by_date: sc.entry_dates
        .filter(d => ent[dateKey(sc.scenario_label, d)])
        .map(d => ({
          entry_date: d,
          rows: ent[dateKey(sc.scenario_label, d)]!.rows,
        })),
    })) || [];

    await supabase.from("problem_variants").update({
      je_entries_json: ent as any,
      je_entry_status_json: sts as any,
      journal_entry_completed_json: {
        scenario_sections: completedSections,
        updated_by_user: true,
        updated_at: new Date().toISOString(),
      } as any,
    } as any).eq("id", variantId);
  };

  // ── Save explicit ──
  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      await persistEntriesToDB(entries, statuses);
      const newVersion = editVersion + 1;
      setEditVersion(newVersion);
      setHasEdits(false);

      await logActivity({
        actor_type: "user", entity_type: "source_problem",
        entity_id: problem?.id || "unknown",
        event_type: "USER_JE_SKELETON_EDIT",
        payload_json: {
          variant_id: variant._variantId || variant.id,
          edit_version: newVersion,
          entry_statuses: statuses,
        },
      });

      toast.success(`Saved (v${newVersion})`);
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Approval logic ──
  const allDatesGenerated = useMemo(() => {
    if (!skeleton) return false;
    return skeleton.scenario_sections.every(sc =>
      sc.entry_dates.every(d => entries[dateKey(sc.scenario_label, d)]?.rows?.length > 0)
    );
  }, [skeleton, entries]);

  const allDatesValidated = useMemo(() => {
    if (!skeleton) return false;
    return skeleton.scenario_sections.every(sc =>
      sc.entry_dates.every(d => statuses[dateKey(sc.scenario_label, d)] === "validated")
    );
  }, [skeleton, statuses]);

  const globalFailed = hasFailures(globalValidation);
  const canApprove = skeleton && allDatesGenerated && allDatesValidated && !globalFailed && !saving;

  const totalDates = skeleton?.scenario_sections.reduce((s, sc) => s + sc.entry_dates.length, 0) || 0;
  const validatedCount = Object.values(statuses).filter(s => s === "validated").length;
  const generatedCount = Object.keys(entries).length;

  const handleApprove = async () => {
    if (!canApprove) {
      setApprovalBlockedModal(true);
      return;
    }
    if (hasEdits) await handleSaveEdits();
    onApproved();
  };

  if (!variant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="text-base flex items-center gap-2 flex-wrap">
            Variant Review
            <Badge variant="outline" className="text-[10px]">
              {variant.asset_name || variant.variant_label || "Variant"}
            </Badge>
            {editVersion > 0 && (
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                v{editVersion}
              </Badge>
            )}
            {skeleton && (
              <Badge variant="outline" className={cn(
                "text-[10px]",
                allDatesValidated
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-amber-400 border-amber-500/30 bg-amber-500/10"
              )}>
                {validatedCount}/{totalDates} entries validated
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Recent Fixes */}
          {recentFixes.length > 0 && (
            <Collapsible open={showFixes} onOpenChange={setShowFixes}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30 cursor-pointer">
                  <Info className="h-3 w-3 mr-1" />
                  {recentFixes.length} recent fix{recentFixes.length !== 1 ? "es" : ""} in this chapter
                </Badge>
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", showFixes && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1">
                {recentFixes.map((fix: any) => (
                  <div key={fix.id} className="rounded border border-border bg-muted/20 px-3 py-1.5 text-xs">
                    <p className="font-medium text-foreground">{fix.summary}</p>
                    <div className="flex gap-1 mt-1">
                      {(fix.auto_tags || []).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-[9px] h-4">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Problem Text */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Problem Text</p>
            <div className="rounded-md border border-border bg-muted/20 p-3 max-h-40 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {variant.survive_problem_text || variant.variant_problem_text || "—"}
              </p>
            </div>
          </div>

          {/* Answer Summary */}
          {variant.answer_only && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Answer Summary</p>
              <div className="rounded-md border border-border bg-muted/20 p-3 max-h-32 overflow-y-auto">
                <p className="text-sm text-foreground whitespace-pre-wrap font-mono">{variant.answer_only}</p>
              </div>
            </div>
          )}

          {/* Generation Log */}
          <Collapsible open={showGenLog} onOpenChange={setShowGenLog}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start">
                <ScrollText className="h-3 w-3 mr-1.5" />
                View Generation Log
                <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showGenLog && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <ActivityLogPanel entityType="source_problem" entityId={problem?.id ?? ""} />
            </CollapsibleContent>
          </Collapsible>

          {/* ════════ SKELETON-FIRST JE WORKFLOW ════════ */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
              Journal Entry Review
            </p>

            {/* No skeleton yet — generate one */}
            {!skeleton && (
              <div className="border border-dashed border-border rounded-lg p-6 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  {requiresJE
                    ? "This problem requires journal entries. Start by generating the entry skeleton (dates only)."
                    : "No journal entry skeleton. Generate one to structure the entries."}
                </p>
                <Button
                  size="sm"
                  onClick={handleGenerateSkeleton}
                  disabled={generatingSkeleton}
                >
                  {generatingSkeleton ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating Skeleton…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate Skeleton</>
                  )}
                </Button>
              </div>
            )}

            {/* Skeleton exists — show per-date accordion */}
            {skeleton && (
              <div className="space-y-4">
                <ScenarioAccordion
                  scenarios={skeleton.scenario_sections.map(sc => {
                    const validatedCount = sc.entry_dates.filter(d =>
                      statuses[dateKey(sc.scenario_label, d)] === "validated"
                    ).length;
                    const allBal = sc.entry_dates.every(d => {
                      const e = entries[dateKey(sc.scenario_label, d)];
                      if (!e?.rows?.length) return true;
                      return entryBalanceFromRows(e.rows).balanced;
                    });
                    return {
                      label: sc.scenario_label,
                      totalDates: sc.entry_dates.length,
                      validatedDates: validatedCount,
                      allBalanced: allBal,
                    };
                  })}
                  renderDates={(si) => {
                    const sc = skeleton.scenario_sections[si];
                    return (
                      <div className="space-y-1.5">
                        {sc.entry_dates.map((date, di) => {
                          const key = dateKey(sc.scenario_label, date);
                          const entry = entries[key];
                          const status = statuses[key] || "empty";
                          const isEditing = editingDate === key;
                          const isGenerating = generatingDate === key;
                          const hasRows = entry && entry.rows.length > 0;
                          const bal = hasRows ? entryBalanceFromRows(entry.rows) : null;
                          const dateVR = hasRows ? runDateValidation(entry.rows, requiresJE) : [];

                          // Unlock: first date always unlocked, subsequent require prior validated
                          const priorValidated = di === 0 || statuses[dateKey(sc.scenario_label, sc.entry_dates[di - 1])] === "validated";

                          return (
                            <EntryByDateCard
                              key={key}
                              date={date}
                              rows={entry?.rows || []}
                              status={status as CardDateEntryStatus}
                              unlocked={priorValidated}
                              isGenerating={isGenerating}
                              balance={bal}
                              validationErrors={dateVR.map(r => ({ status: r.status, message: r.message }))}
                              onGenerateRows={() => handleGenerateRows(sc.scenario_label, date)}
                              onMarkCorrect={() => handleMarkCorrect(key)}
                              onEditRows={() => setEditingDate(isEditing ? null : key)}
                              isEditing={isEditing}
                              editorSlot={
                                hasRows ? (
                                  <JournalEntryEditor
                                    sections={[{
                                      entry_date: date,
                                      lines: entry.rows.map(r => ({
                                        account_name: r.account_name,
                                        debit: r.debit,
                                        credit: r.credit,
                                        memo: r.memo || "",
                                        indentation_level: (r.credit != null && r.credit !== 0 ? 1 : 0) as 0 | 1,
                                        coa_id: r.coa_id,
                                        display_name: r.display_name,
                                        unknown_account: r.unknown_account,
                                      })),
                                    }]}
                                    onChange={(newSections) => {
                                      if (newSections[0]) handleDateRowsChange(key, newSections[0]);
                                    }}
                                    chapterId={chapterId}
                                    approvedAccounts={approvedAccounts}
                                  />
                                ) : undefined
                              }
                            />
                          );
                        })}
                      </div>
                    );
                  }}
                />

                {/* Re-generate skeleton button */}
                <Button
                  variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground"
                  onClick={handleGenerateSkeleton}
                  disabled={generatingSkeleton}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Regenerate Skeleton
                </Button>
              </div>
            )}
          </div>

          {/* Global Validation */}
          {globalValidation.length > 0 && (
            <ValidationPanel results={globalValidation} />
          )}

          {/* Worked Steps */}
          {variant.survive_solution_text && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Worked Steps</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-md border border-border bg-muted/20 p-3 max-h-64 overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {variant.survive_solution_text || variant.variant_solution_text}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Exam Trap Note */}
          {variant.exam_trap_note && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-0.5 flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" /> Exam Trap Note
              </p>
              <p className="text-sm text-foreground">{variant.exam_trap_note}</p>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="sticky bottom-0 bg-background border-t border-border px-6 py-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRejected}>
            <X className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <div className="flex gap-2">
            {hasEdits && (
              <Button variant="outline" size="sm" onClick={handleSaveEdits} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={saving}
              className={cn(!canApprove && "opacity-70")}
            >
              {!canApprove ? (
                <><Lock className="h-3.5 w-3.5 mr-1" /> Validate All Entries</>
              ) : (
                <><Check className="h-3.5 w-3.5 mr-1" /> Approve Variant</>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* Approval Blocked Modal */}
      <Dialog open={approvalBlockedModal} onOpenChange={setApprovalBlockedModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Validation Required
            </DialogTitle>
            <DialogDescription>
              {!skeleton && "Generate a skeleton first to identify entry dates."}
              {skeleton && !allDatesGenerated && (
                <span className="block mt-2 text-foreground font-medium">
                  {generatedCount} of {totalDates} dates have generated rows.
                </span>
              )}
              {skeleton && allDatesGenerated && !allDatesValidated && (
                <span className="block mt-2 text-foreground font-medium">
                  {validatedCount} of {totalDates} entries validated.
                </span>
              )}
              {globalFailed && (
                <span className="block mt-1 text-destructive">
                  There are global validation errors that must be fixed.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalBlockedModal(false)}>
              Back to Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
