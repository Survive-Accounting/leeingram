import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Check, X, Save, ChevronDown, AlertTriangle, Info, Lock, CheckCircle2,
  Circle, XCircle, ScrollText, Plus, Sparkles, Loader2, Pencil, Code, Copy,
  ChevronRight, Wrench, SkipForward, Eye,
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
import { normalizeToParts, isTextPart, isJEPart, formatPartLabel, type VariantPart, type VariantTextPart, type VariantJEPart } from "@/lib/variantParts";
import { useChapterApprovedAccounts } from "./ChapterAccountsSetup";
import { ActivityLogPanel } from "./ActivityLogPanel";
import {
  SKELETON_SYSTEM_PROMPT, buildSkeletonUserPrompt,
  SINGLE_DATE_SYSTEM_PROMPT, buildSingleDateUserPrompt,
} from "@/lib/jeSkeletonPrompts";
import { GenerationLogger } from "@/lib/generationLogger";

// ── Types ──

export interface VariantReviewContentProps {
  variant: any;
  problem: any;
  chapterId: string;
  onApproved: () => void;
  onRejected: () => void;
  onNeedsFix?: () => void;
  onApproveAndNext?: () => void;
}

interface VariantReviewDrawerProps extends VariantReviewContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

type EntriesMap = Record<string, DateEntryRows>;
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

// ══════════════════════════════════════════════
// VariantReviewContent — speed-optimized review UI
// ══════════════════════════════════════════════

export function VariantReviewContent({ variant, problem, chapterId, onApproved, onRejected, onNeedsFix, onApproveAndNext }: VariantReviewContentProps) {
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
  const [generatingDate, setGeneratingDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [globalValidation, setGlobalValidation] = useState<ValidationResult[]>([]);
  const [approvalBlockedModal, setApprovalBlockedModal] = useState(false);
  const [recentFixes, setRecentFixes] = useState<any[]>([]);
  const [showFixes, setShowFixes] = useState(false);
  const [showGenLog, setShowGenLog] = useState(false);
  const [payloadModalOpen, setPayloadModalOpen] = useState(false);
  const [payloadData, setPayloadData] = useState<any>(null);
  const [payloadLoading, setPayloadLoading] = useState(false);

  // Section toggles
  const [showMainSection, setShowMainSection] = useState(false);
  const [showJESection, setShowJESection] = useState(false);
  const [showTextSection, setShowTextSection] = useState(false);
  const [showWorkedSteps, setShowWorkedSteps] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Parts
  const parts = useMemo(() => normalizeToParts(variant), [variant]);
  const textParts = useMemo(() => parts.filter(isTextPart), [parts]);
  const jeParts = useMemo(() => parts.filter(isJEPart), [parts]);
  const hasJEParts = jeParts.length > 0;
  const hasTextParts = textParts.length > 0;
  const hasWorkedSteps = !!(variant.survive_solution_text || variant.variant_solution_text);

  // Keyboard shortcut: CTRL+F = Approve & Next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        if (onApproveAndNext) {
          onApproveAndNext();
        } else {
          onApproved();
        }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onApproveAndNext, onApproved]);

  // Init — AUTO VALIDATE all entries
  useEffect(() => {
    if (!variant) return;
    
    const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
    const needsJE = detectRequiresJE(problemText);
    setRequiresJE(needsJE);

    const dbSkeleton = variant.je_skeleton_json as SkeletonData | null;
    const dbEntries = (variant.je_entries_json || {}) as EntriesMap;
    const dbStatuses = (variant.je_entry_status_json || {}) as StatusMap;

    if (dbSkeleton && dbSkeleton.scenario_sections?.length > 0) {
      setSkeleton(dbSkeleton);
      setEntries(dbEntries);
      // Auto-validate: set all entries with rows to "validated" by default
      const autoStatuses: StatusMap = {};
      for (const sc of dbSkeleton.scenario_sections) {
        for (const d of sc.entry_dates) {
          const key = dateKey(sc.scenario_label, d);
          const existingStatus = dbStatuses[key];
          const hasRows = dbEntries[key]?.rows?.length > 0;
          // Default to validated if has rows, preserve existing status if already set
          autoStatuses[key] = existingStatus || (hasRows ? "validated" : "empty");
        }
      }
      setStatuses(autoStatuses);
    } else {
      const candidateSkeleton = extractSkeletonFromCandidate(
        variant.candidate_data || variant.journal_entry_completed_json
      );
      const candidateEntries = extractEntriesFromCandidate(
        variant.candidate_data || variant.journal_entry_completed_json
      );

      if (candidateSkeleton) {
        setSkeleton(candidateSkeleton);
        setEntries(candidateEntries);
        // Auto-validate all candidate entries
        const initStatuses: StatusMap = {};
        for (const key of Object.keys(candidateEntries)) {
          initStatuses[key] = "validated";
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
  }, [variant]);

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

  const handleViewPayload = async () => {
    setPayloadLoading(true);
    setPayloadModalOpen(true);
    try {
      const variantId = variant._variantId || variant.id;
      let query = supabase
        .from("generation_runs")
        .select("id, provider, model, status, created_at, debug_bundle_json")
        .order("created_at", { ascending: false })
        .limit(1);
      if (variantId) query = query.eq("variant_id", variantId);
      else if (problem?.id) query = query.eq("source_problem_id", problem.id);
      const { data: runs } = await query;
      const run = runs?.[0];
      if (!run) { setPayloadData({ empty: true }); return; }
      const { data: events } = await supabase
        .from("generation_events")
        .select("event_type, level, message, payload_json, seq")
        .eq("run_id", run.id)
        .order("seq");
      const buildPromptEvent = events?.find(e => e.event_type === "BUILD_PROMPT");
      const rawResponseEvent = events?.find(e => e.event_type === "RAW_RESPONSE");
      const toolCallEvent = events?.find(e => e.event_type === "TOOL_CALL_PARSED" || e.event_type === "PARSED_CANDIDATES");
      const requestStartEvent = events?.find(e => e.event_type === "REQUEST_START");
      const promptPayload = buildPromptEvent?.payload_json as any;
      const rawPayload = rawResponseEvent?.payload_json as any;
      const toolPayload = toolCallEvent?.payload_json as any;
      setPayloadData({
        run_id: run.id, provider: run.provider, model: run.model,
        status: run.status, created_at: run.created_at,
        temperature: (promptPayload as any)?.temperature ?? (requestStartEvent?.payload_json as any)?.temperature ?? "—",
        prompt_hash: (promptPayload as any)?.prompt_hash ?? "—",
        candidate_json: (toolPayload as any)?.candidates_preview ?? (toolPayload as any)?.candidate_count ?? variant.candidate_data,
        raw_tool_call: (rawPayload as any)?.raw_text_truncated ?? (rawPayload as any)?.raw_text ?? null,
        debug_bundle: run.debug_bundle_json,
        whitelist_enabled: (promptPayload as any)?.whitelist_enabled,
        whitelist_count: (promptPayload as any)?.whitelist_count,
      });
    } catch (err: any) {
      setPayloadData({ error: err.message });
    } finally {
      setPayloadLoading(false);
    }
  };

  const runGlobalValidationFromEntries = () => {
    if (!skeleton) { setGlobalValidation([]); return; }
    const allSections: JESection[] = [];
    for (const sc of skeleton.scenario_sections) {
      for (const d of sc.entry_dates) {
        const key = dateKey(sc.scenario_label, d);
        const entry = entries[key];
        if (entry) {
          allSections.push({
            entry_date: skeleton.scenario_sections.length > 1
              ? `${sc.scenario_label} — ${d}` : d,
            lines: entry.rows.map(r => ({
              account_name: r.account_name, debit: r.debit, credit: r.credit,
              memo: r.memo || "",
              indentation_level: (r.credit != null && r.credit !== 0 ? 1 : 0) as 0 | 1,
            })),
          });
        }
      }
    }
    const pkg: AnswerPackageData = {
      answer_payload: { teaching_aids: { journal_entries: allSections } },
      extracted_inputs: {}, computed_values: {}, requires_je: requiresJE,
    };
    setGlobalValidation(runValidation(pkg));
  };

  // ── Skeleton Generation ──
  const handleGenerateSkeleton = async () => {
    setGeneratingSkeleton(true);
    const logger = new GenerationLogger({
      course_id: problem?.course_id, chapter_id: chapterId,
      source_problem_id: problem?.id || variant.base_problem_id,
      provider: "lovable", model: "google/gemini-2.5-flash",
    });
    try {
      await logger.start();
      await logger.info("frontend", "CLICK_GENERATE", "User clicked Generate Skeleton", {
        variant_id: variant._variantId || variant.id, problem_id: problem?.id,
      });
      const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
      const solutionText = variant.survive_solution_text || variant.variant_solution_text || problem?.solution_text || "";
      await logger.info("frontend", "REQUEST_START", "Calling generate-ai-output for skeleton");
      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable", model: "google/gemini-2.5-flash",
          temperature: 0.1, max_output_tokens: 2000,
          source_problem_id: problem?.id || variant.base_problem_id || "unknown",
          run_id: logger.runId,
          messages: [
            { role: "system", content: SKELETON_SYSTEM_PROMPT },
            { role: "user", content: buildSkeletonUserPrompt({ problemText, solutionText }) },
          ],
        },
      });
      await logger.info("frontend", "REQUEST_END", "Edge function returned", {
        has_error: !!error, has_data_error: !!data?.error, has_parsed: !!data?.parsed,
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
          je_skeleton_json: sk as any, je_entries_json: {} as any, je_entry_status_json: {} as any,
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
      course_id: problem?.course_id, chapter_id: chapterId,
      source_problem_id: problem?.id || variant.base_problem_id,
      provider: "lovable", model: "google/gemini-2.5-flash",
    });
    try {
      await logger.start();
      await logger.info("frontend", "CLICK_GENERATE", `Generate rows for ${scenarioLabel} / ${date}`, {
        scenario_label: scenarioLabel, target_date: date, variant_id: variant._variantId || variant.id,
      });
      const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
      const solutionText = variant.survive_solution_text || variant.variant_solution_text || problem?.solution_text || "";
      const priorEntries: Array<{ date: string; rows: any[] }> = [];
      if (skeleton) {
        const sc = skeleton.scenario_sections.find(s => s.scenario_label === scenarioLabel);
        if (sc) {
          for (const d of sc.entry_dates) {
            if (d === date) break;
            const priorKey = dateKey(scenarioLabel, d);
            if (entries[priorKey]) priorEntries.push({ date: d, rows: entries[priorKey].rows });
          }
        }
      }
      await logger.info("frontend", "REQUEST_START", "Calling generate-ai-output for rows", {
        prior_entries_count: priorEntries.length, coa_count: approvedAccounts?.length ?? 0,
      });
      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable", model: "google/gemini-2.5-flash",
          temperature: 0.2, max_output_tokens: 2000,
          source_problem_id: problem?.id || variant.base_problem_id || "unknown",
          run_id: logger.runId,
          messages: [
            { role: "system", content: SINGLE_DATE_SYSTEM_PROMPT },
            { role: "user", content: buildSingleDateUserPrompt({
              problemText, solutionText, scenarioLabel, targetDate: date,
              chartOfAccounts: approvedAccounts?.map((a: any) => a.account_name) || [],
              priorEntries,
            }) },
          ],
        },
      });
      await logger.info("frontend", "REQUEST_END", "Edge function returned", {
        has_error: !!error, has_data_error: !!data?.error, has_parsed: !!data?.parsed,
        parsed_has_rows: !!data?.parsed?.rows, row_count: data?.parsed?.rows?.length ?? 0,
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
          unknown_account: r.needs_review || false, memo: "",
        })),
      };
      const vr = runDateValidation(newRows.rows, requiresJE);
      await logger.info("validator", "RUN_VALIDATORS_END", `Validators ran: ${vr.length} checks`, {
        validator_results: vr.map(v => ({ name: v.validator, status: v.status, message: v.message })),
      });
      await logger.info("frontend", "SAVE_VARIANT_START", `Saving ${newRows.rows.length} rows`, {
        row_count: newRows.rows.length, rows_preview: newRows.rows.slice(0, 5),
      });
      setEntries(prev => ({ ...prev, [key]: newRows }));
      // Auto-validate newly generated rows
      setStatuses(prev => ({ ...prev, [key]: "validated" }));
      setHasEdits(true);
      setEditingDate(key);
      await persistEntriesToDB({ ...entries, [key]: newRows }, { ...statuses, [key]: "validated" });
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

  const handleDateRowsChange = (key: string, newSection: JESection) => {
    const newRows: DateEntryRows = {
      rows: newSection.lines.map(l => ({
        account_name: l.account_name, debit: l.debit, credit: l.credit,
        coa_id: (l as any).coa_id || null, display_name: (l as any).display_name,
        unknown_account: (l as any).unknown_account, memo: l.memo || "",
      })),
    };
    setEntries(prev => ({ ...prev, [key]: newRows }));
    setStatuses(prev => {
      const current = prev[key];
      return { ...prev, [key]: current === "validated" ? "edited" : (current === "empty" ? "drafted" : current) };
    });
    setHasEdits(true);
  };

  const handleMarkCorrect = async (key: string, override?: boolean) => {
    const entry = entries[key];
    if (!entry || entry.rows.length < 2) { toast.error("Entry needs at least 2 rows"); return; }
    if (!override) {
      const bal = entryBalanceFromRows(entry.rows);
      if (!bal.balanced) { toast.error(`Entry is off by $${bal.diff.toFixed(2)} — fix balance first or use manual override`); return; }
      const vr = runDateValidation(entry.rows, requiresJE);
      if (vr.some(r => r.status === "fail")) { toast.error("Fix validation errors or use manual override"); return; }
    }
    setStatuses(prev => ({ ...prev, [key]: "validated" }));
    const newStatuses = { ...statuses, [key]: "validated" as DateEntryStatus };
    await persistEntriesToDB(entries, newStatuses);
    if (override) {
      await logActivity({
        actor_type: "user", entity_type: "source_problem", entity_id: problem?.id || "unknown",
        event_type: "JE_MANUAL_OVERRIDE", severity: "warn",
        payload_json: { variant_id: variant._variantId || variant.id, date_key: key, row_count: entry.rows.length },
      });
    }
    toast.success(override ? "Entry validated (manual override)" : "Entry marked as validated");
  };

  const handleMarkInvalid = async (key: string) => {
    setStatuses(prev => ({ ...prev, [key]: "drafted" }));
    const newStatuses = { ...statuses, [key]: "drafted" as DateEntryStatus };
    await persistEntriesToDB(entries, newStatuses);
    toast.info("Entry marked as needing review");
  };

  const persistEntriesToDB = async (ent: EntriesMap, sts: StatusMap) => {
    const variantId = variant._variantId || variant.id;
    if (!variantId) return;
    const completedSections = skeleton?.scenario_sections.map(sc => ({
      label: sc.scenario_label,
      entries_by_date: sc.entry_dates
        .filter(d => ent[dateKey(sc.scenario_label, d)])
        .map(d => ({ entry_date: d, rows: ent[dateKey(sc.scenario_label, d)]!.rows })),
    })) || [];
    const jeCompletedJson = { scenario_sections: completedSections, updated_by_user: true, updated_at: new Date().toISOString() };
    const updatedParts = normalizeToParts({ ...variant, journal_entry_completed_json: jeCompletedJson });
    await supabase.from("problem_variants").update({
      je_entries_json: ent as any, je_entry_status_json: sts as any,
      journal_entry_completed_json: jeCompletedJson as any,
      parts_json: updatedParts.length > 0 ? updatedParts as any : null,
    } as any).eq("id", variantId);
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      await persistEntriesToDB(entries, statuses);
      const newVersion = editVersion + 1;
      setEditVersion(newVersion);
      setHasEdits(false);
      await logActivity({
        actor_type: "user", entity_type: "source_problem", entity_id: problem?.id || "unknown",
        event_type: "USER_JE_SKELETON_EDIT",
        payload_json: { variant_id: variant._variantId || variant.id, edit_version: newVersion, entry_statuses: statuses },
      });
      toast.success(`Saved (v${newVersion})`);
    } catch (err: any) { toast.error(err?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  // Approval logic — relaxed for speed
  const allDatesGenerated = useMemo(() => {
    if (!skeleton) return true; // no skeleton = text-only, always ready
    return skeleton.scenario_sections.every(sc =>
      sc.entry_dates.every(d => entries[dateKey(sc.scenario_label, d)]?.rows?.length > 0)
    );
  }, [skeleton, entries]);

  const allDatesValidated = useMemo(() => {
    if (!skeleton) return true;
    return skeleton.scenario_sections.every(sc =>
      sc.entry_dates.every(d => statuses[dateKey(sc.scenario_label, d)] === "validated")
    );
  }, [skeleton, statuses]);

  const globalFailed = hasFailures(globalValidation);
  const canApprove = allDatesGenerated && allDatesValidated && !saving;

  const totalDates = skeleton?.scenario_sections.reduce((s, sc) => s + sc.entry_dates.length, 0) || 0;
  const validatedCount = Object.values(statuses).filter(s => s === "validated").length;

  const handleApprove = async () => {
    if (!canApprove) { setApprovalBlockedModal(true); return; }
    if (hasEdits) await handleSaveEdits();
    onApproved();
  };

  const handleApproveAndNext = async () => {
    if (!canApprove) { setApprovalBlockedModal(true); return; }
    if (hasEdits) await handleSaveEdits();
    if (onApproveAndNext) onApproveAndNext();
    else onApproved();
  };

  if (!variant) return null;

  return (
    <>
      <div className="space-y-4">
        {/* ─── ACTION BAR ─── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-md border border-border bg-muted/10">
            <Button
              size="sm"
              onClick={handleApproveAndNext}
              disabled={saving}
              className={cn("h-8 text-xs font-medium", !canApprove && "opacity-70")}
            >
              {canApprove ? (
                <><Check className="h-3.5 w-3.5 mr-1" /> Approve & Next</>
              ) : (
                <><Lock className="h-3.5 w-3.5 mr-1" /> Validate All</>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={handleApprove} disabled={saving} className={cn("h-8 text-xs", !canApprove && "opacity-70")}>
              <Check className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={onRejected}>
              <X className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
            {onNeedsFix && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-amber-500 hover:text-amber-400" onClick={onNeedsFix}>
                <Wrench className="h-3.5 w-3.5 mr-1" /> Needs Fix
              </Button>
            )}
            {hasEdits && (
              <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={handleSaveEdits} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save"}
              </Button>
            )}
            <span className="text-[9px] text-muted-foreground ml-auto hidden sm:inline">Ctrl+F = Approve & Next</span>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px]">
            {variant.asset_name || variant.variant_label || "Variant"}
          </Badge>
          {editVersion > 0 && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">v{editVersion}</Badge>
          )}
          {skeleton && totalDates > 0 && (
            <Badge variant="outline" className={cn(
              "text-[10px]",
              allDatesValidated ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"
            )}>
              {validatedCount}/{totalDates} entries validated
            </Badge>
          )}
          {globalFailed && (
            <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30 bg-red-500/10">
              <AlertTriangle className="h-3 w-3 mr-1" /> Validation errors
            </Badge>
          )}
          </div>
        </div>

        {/* ═══ MAIN SECTION: Problem + Answer (hold to peek) ═══ */}
        <div
          className="select-none"
          onMouseDown={() => setShowMainSection(true)}
          onMouseUp={() => setShowMainSection(false)}
          onMouseLeave={() => setShowMainSection(false)}
          onTouchStart={() => setShowMainSection(true)}
          onTouchEnd={() => setShowMainSection(false)}
        >
          <div className="flex items-center gap-2 py-2 border-b border-border cursor-pointer">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {showMainSection ? "Problem & Answer" : "Hold to view Problem & Answer"}
            </span>
          </div>
          {showMainSection && (
            <div className="pt-3 space-y-3 animate-in fade-in-0 duration-150">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Problem Text</p>
                <div className="rounded-md border border-border bg-muted/20 p-2.5 max-h-28 overflow-y-auto">
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                    {variant.survive_problem_text || variant.variant_problem_text || "—"}
                  </p>
                </div>
              </div>

              {(variant.answer_only || hasTextParts) && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Answer Summary</p>
                  <div className="rounded-md border border-border bg-muted/20 p-2.5 max-h-24 overflow-y-auto">
                    {hasTextParts ? (
                      <div className="space-y-1">
                        {textParts.map((tp, i) => (
                          <p key={i} className="text-xs text-foreground">
                            <span className="font-semibold text-primary">{formatPartLabel(tp.label)}</span>{" "}
                            {tp.final_answer}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-foreground font-mono">{variant.answer_only}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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

        {/* ═══ COLLAPSIBLE SECTIONS — show only what exists ═══ */}

        {/* ▶ Journal Entries Section */}
        {(hasJEParts || skeleton) && (
          <Collapsible open={showJESection} onOpenChange={setShowJESection}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 border-b border-border hover:text-foreground">
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showJESection && "rotate-90")} />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Journal Entries</span>
              {hasJEParts && (
                <Badge variant="outline" className="text-[9px] h-4 ml-auto">{jeParts.length} part{jeParts.length !== 1 ? "s" : ""}</Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Parts-based JE display */}
              {jeParts.map((part, i) => (
                <JEPartInlineCard key={i} part={part} />
              ))}

              {/* Skeleton-first workflow */}
              {!skeleton && requiresJE && jeParts.length === 0 && (
                <div className="border border-dashed border-border rounded-lg p-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Generate entry skeleton to structure JE review.</p>
                  <Button size="sm" onClick={handleGenerateSkeleton} disabled={generatingSkeleton}>
                    {generatingSkeleton ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate Skeleton</>}
                  </Button>
                </div>
              )}

              {skeleton && (
                <div className="space-y-3">
                  <ScenarioAccordion
                    scenarios={skeleton.scenario_sections.map(sc => {
                      const vc = sc.entry_dates.filter(d => statuses[dateKey(sc.scenario_label, d)] === "validated").length;
                      const allBal = sc.entry_dates.every(d => {
                        const e = entries[dateKey(sc.scenario_label, d)];
                        if (!e?.rows?.length) return true;
                        return entryBalanceFromRows(e.rows).balanced;
                      });
                      return { label: sc.scenario_label, totalDates: sc.entry_dates.length, validatedDates: vc, allBalanced: allBal };
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
                            const priorValidated = di === 0 || statuses[dateKey(sc.scenario_label, sc.entry_dates[di - 1])] === "validated";
                            return (
                              <EntryByDateCard
                                key={key} date={date} rows={entry?.rows || []}
                                status={status as CardDateEntryStatus} unlocked={priorValidated}
                                isGenerating={isGenerating} balance={bal}
                                validationErrors={dateVR.map(r => ({ status: r.status, message: r.message }))}
                                onGenerateRows={() => handleGenerateRows(sc.scenario_label, date)}
                                onMarkCorrect={(override?: boolean) => handleMarkCorrect(key, override)}
                                onEditRows={() => setEditingDate(isEditing ? null : key)}
                                isEditing={isEditing}
                                editorSlot={hasRows ? (
                                  <JournalEntryEditor
                                    sections={[{
                                      entry_date: date,
                                      lines: entry.rows.map(r => ({
                                        account_name: r.account_name, debit: r.debit, credit: r.credit,
                                        memo: r.memo || "",
                                        indentation_level: (r.credit != null && r.credit !== 0 ? 1 : 0) as 0 | 1,
                                        coa_id: r.coa_id, display_name: r.display_name, unknown_account: r.unknown_account,
                                      })),
                                    }]}
                                    onChange={(newSections) => { if (newSections[0]) handleDateRowsChange(key, newSections[0]); }}
                                    chapterId={chapterId} approvedAccounts={approvedAccounts}
                                  />
                                ) : undefined}
                              />
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={handleGenerateSkeleton} disabled={generatingSkeleton}>
                    <Sparkles className="h-3 w-3 mr-1" /> Regenerate Skeleton
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ▶ Text Answers Section */}
        {hasTextParts && (
          <Collapsible open={showTextSection} onOpenChange={setShowTextSection}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 border-b border-border hover:text-foreground">
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showTextSection && "rotate-90")} />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Text Answers</span>
              <Badge variant="outline" className="text-[9px] h-4 ml-auto">{textParts.length} part{textParts.length !== 1 ? "s" : ""}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {textParts.map((part, i) => (
                <TextPartInlineCard key={i} part={part} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ▶ Worked Steps Section */}
        {hasWorkedSteps && (
          <Collapsible open={showWorkedSteps} onOpenChange={setShowWorkedSteps}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 border-b border-border hover:text-foreground">
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showWorkedSteps && "rotate-90")} />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Worked Steps</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="rounded-md border border-border bg-muted/20 p-3 max-h-64 overflow-y-auto">
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {variant.survive_solution_text || variant.variant_solution_text}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Global Validation (collapsible) */}
        {globalValidation.length > 0 && (
          <Collapsible open={showValidation} onOpenChange={setShowValidation}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 border-b border-border hover:text-foreground">
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showValidation && "rotate-90")} />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Validation Results</span>
              {globalFailed && (
                <Badge variant="outline" className="text-[9px] h-4 ml-auto text-red-400 border-red-500/30 bg-red-500/10">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Errors
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <ValidationPanel results={globalValidation} />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ═══ BOTTOM: Debug tools ═══ */}
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Debug Tools</p>
          <div className="flex gap-2 flex-wrap">
            <Collapsible open={showGenLog} onOpenChange={setShowGenLog} className="w-full">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start">
                  <ScrollText className="h-3 w-3 mr-1.5" /> View Generation Log
                  <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showGenLog && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ActivityLogPanel entityType="source_problem" entityId={problem?.id ?? ""} />
              </CollapsibleContent>
            </Collapsible>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleViewPayload} disabled={payloadLoading}>
              {payloadLoading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Code className="h-3 w-3 mr-1.5" />}
              View AI Payload
            </Button>
          </div>
        </div>
      </div>

      {/* AI Payload Modal */}
      <Dialog open={payloadModalOpen} onOpenChange={setPayloadModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Code className="h-4 w-4" /> AI Payload Inspector</DialogTitle>
            <DialogDescription>Generation run details and raw AI output for debugging.</DialogDescription>
          </DialogHeader>
          {payloadLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {payloadData?.empty && <p className="text-sm text-muted-foreground text-center py-6">No generation run found for this variant.</p>}
          {payloadData?.error && <p className="text-sm text-destructive text-center py-6">{payloadData.error}</p>}
          {payloadData && !payloadData.empty && !payloadData.error && !payloadLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-border p-2"><span className="text-muted-foreground">Provider</span><p className="font-mono font-medium text-foreground">{payloadData.provider || "—"}</p></div>
                <div className="rounded border border-border p-2"><span className="text-muted-foreground">Model</span><p className="font-mono font-medium text-foreground">{payloadData.model || "—"}</p></div>
                <div className="rounded border border-border p-2"><span className="text-muted-foreground">Temperature</span><p className="font-mono font-medium text-foreground">{String(payloadData.temperature)}</p></div>
                <div className="rounded border border-border p-2"><span className="text-muted-foreground">Prompt Hash</span><p className="font-mono font-medium text-foreground truncate">{payloadData.prompt_hash}</p></div>
                <div className="rounded border border-border p-2"><span className="text-muted-foreground">Run ID</span><p className="font-mono font-medium text-foreground truncate">{payloadData.run_id}</p></div>
                <div className="rounded border border-border p-2"><span className="text-muted-foreground">Whitelist</span><p className="font-mono font-medium text-foreground">{payloadData.whitelist_enabled ? `Enabled (${payloadData.whitelist_count})` : "Disabled"}</p></div>
              </div>
              <PayloadSection title="Parsed Candidate JSON" content={payloadData.candidate_json} />
              <PayloadSection title="Raw Tool Call Arguments" content={payloadData.raw_tool_call} isString />
              {payloadData.debug_bundle && <PayloadSection title="Debug Bundle" content={payloadData.debug_bundle} />}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Blocked Modal */}
      <Dialog open={approvalBlockedModal} onOpenChange={setApprovalBlockedModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /> Validation Required</DialogTitle>
            <DialogDescription>
              {skeleton && !allDatesGenerated && <span className="block mt-2 text-foreground font-medium">{Object.keys(entries).length} of {totalDates} dates have generated rows.</span>}
              {skeleton && allDatesGenerated && !allDatesValidated && <span className="block mt-2 text-foreground font-medium">{validatedCount} of {totalDates} entries validated.</span>}
              {!skeleton && requiresJE && "Generate a skeleton first to identify entry dates."}
              {globalFailed && <span className="block mt-1 text-destructive">There are global validation errors that must be fixed.</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setApprovalBlockedModal(false)}>Back to Review</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Inline Part Cards for the collapsible sections ──

function TextPartInlineCard({ part }: { part: VariantTextPart }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-primary">{formatPartLabel(part.label)}</span>
        <Badge variant="outline" className="text-[9px] h-4">text</Badge>
      </div>
      <div className="pl-4 space-y-1.5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Final Answer</p>
          <p className="text-sm text-foreground font-medium">{part.final_answer}</p>
          {part.final_value != null && (
            <p className="text-xs text-muted-foreground font-mono">= {typeof part.final_value === "number" ? part.final_value.toLocaleString() : part.final_value}{part.units ? ` ${part.units}` : ""}</p>
          )}
        </div>
        {part.explanation && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Explanation</p>
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">{part.explanation}</p>
          </div>
        )}
        {part.worked_steps && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Worked Steps</p>
            <pre className="text-xs text-foreground/70 font-mono whitespace-pre-wrap bg-muted/30 rounded p-2">{part.worked_steps}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function JEPartInlineCard({ part }: { part: VariantJEPart }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-3 py-2 bg-muted/20 border-b border-border flex items-baseline gap-2">
        <span className="text-sm font-semibold text-primary">{formatPartLabel(part.label)}</span>
        <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-400 border-blue-500/30">journal entry</Badge>
      </div>
      <div className="p-3 space-y-3">
        {part.je_structured.map((entry, ei) => {
          const totalDebit = entry.entries.reduce((s, e) => s + (e.debit ?? 0), 0);
          const totalCredit = entry.entries.reduce((s, e) => s + (e.credit ?? 0), 0);
          const balanced = Math.abs(totalDebit - totalCredit) < 0.02;
          return (
            <div key={ei}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{entry.date}</span>
                <Badge variant="outline" className={cn("text-[9px] h-4", balanced ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30")}>
                  {balanced ? "Balanced" : `Off by $${Math.abs(totalDebit - totalCredit).toLocaleString()}`}
                </Badge>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-2 py-1 font-medium">Account</th>
                    <th className="text-right px-2 py-1 font-medium w-20">Debit</th>
                    <th className="text-right px-2 py-1 font-medium w-20">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.entries.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/30 last:border-0">
                      <td className={cn("px-2 py-1 text-foreground", row.credit != null && row.credit > 0 && "pl-6")}>{row.account}</td>
                      <td className="text-right px-2 py-1 font-mono text-foreground">{row.debit != null && row.debit > 0 ? `$${row.debit.toLocaleString()}` : ""}</td>
                      <td className="text-right px-2 py-1 font-mono text-foreground">{row.credit != null && row.credit > 0 ? `$${row.credit.toLocaleString()}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// VariantReviewDrawer — Sheet wrapper (kept for backward compat)
// ══════════════════════════════════════════════

export function VariantReviewDrawer({ open, onOpenChange, variant, problem, chapterId, onApproved, onRejected }: VariantReviewDrawerProps) {
  if (!variant) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="text-base">Variant Review</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-4">
          <VariantReviewContent variant={variant} problem={problem} chapterId={chapterId} onApproved={onApproved} onRejected={onRejected} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PayloadSection({ title, content, isString }: { title: string; content: any; isString?: boolean }) {
  if (!content) return null;
  const text = isString ? String(content) : JSON.stringify(content, null, 2);
  const handleCopy = () => { navigator.clipboard.writeText(text); toast.success(`Copied ${title}`); };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleCopy}><Copy className="h-3 w-3 mr-1" /> Copy JSON</Button>
      </div>
      <pre className="rounded border border-border bg-muted/30 p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">{text}</pre>
    </div>
  );
}
