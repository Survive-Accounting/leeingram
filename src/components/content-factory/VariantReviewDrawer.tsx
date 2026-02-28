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
  Circle, XCircle, ScrollText, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JournalEntryEditor, groupsToSections, type JESection } from "./JournalEntryEditor";
import { ValidationPanel } from "./ValidationPanel";
import { runValidation, hasFailures, type AnswerPackageData, type ValidationResult } from "@/lib/validation";
import { parseLegacyAnswerOnly, parseLegacyJEBlock, isCanonicalJE, type CanonicalJEPayload } from "@/lib/journalEntryParser";
import { detectRequiresJE, normalizeLegacyJEText } from "@/lib/legacyJENormalizer";
import { logActivity } from "@/lib/activityLogger";
import { useChapterApprovedAccounts } from "./ChapterAccountsSetup";
import { ActivityLogPanel } from "./ActivityLogPanel";

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

type EntryStatus = "draft" | "corrected" | "validated";

interface EntryMeta {
  status: EntryStatus;
  originalLines: JESection["lines"];
  editedAt: string | null;
  editedBy: string | null;
  validationResults: ValidationResult[];
}

// ── Helpers ──

function autoTagCorrections(before: JESection[], after: JESection[]): string[] {
  const tags: string[] = [];
  const beforeFlat = before.flatMap(s => s.lines);
  const afterFlat = after.flatMap(s => s.lines);
  const datePattern = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d{2})\b/i;
  if (beforeFlat.some(l => datePattern.test(l.account_name)) && !afterFlat.some(l => datePattern.test(l.account_name)))
    tags.push("no_dates_in_account_names");
  const prefixPattern = /^.{4,}:\s*/;
  if (beforeFlat.some(l => prefixPattern.test(l.account_name)) && !afterFlat.some(l => prefixPattern.test(l.account_name)))
    tags.push("no_narrative_prefix_in_account");
  for (let i = 0; i < Math.min(beforeFlat.length, afterFlat.length); i++) {
    const bLine = beforeFlat[i], aLine = afterFlat[i];
    if ((bLine.account_name + aLine.account_name).toLowerCase().includes("cash")) {
      if ((bLine.debit != null ? "debit" : "credit") !== (aLine.debit != null ? "debit" : "credit")) {
        tags.push("cash_direction_fix"); break;
      }
    }
  }
  for (let i = 0; i < Math.min(beforeFlat.length, afterFlat.length); i++) {
    const name = (beforeFlat[i].account_name + afterFlat[i].account_name).toLowerCase();
    if (name.includes("discount") || name.includes("premium")) {
      if ((beforeFlat[i].debit != null ? "debit" : "credit") !== (afterFlat[i].debit != null ? "debit" : "credit")) {
        tags.push("discount_premium_side_fix"); break;
      }
    }
  }
  return [...new Set(tags)];
}

function buildDiff(before: JESection[], after: JESection[]): any {
  const changes: any[] = [];
  const max = Math.max(before.length, after.length);
  for (let si = 0; si < max; si++) {
    const b = before[si], a = after[si];
    if (!b) { changes.push({ type: "section_added", sectionIndex: si }); continue; }
    if (!a) { changes.push({ type: "section_removed", sectionIndex: si }); continue; }
    if (b.entry_date !== a.entry_date) changes.push({ type: "date_changed", sectionIndex: si, from: b.entry_date, to: a.entry_date });
    const maxL = Math.max(b.lines.length, a.lines.length);
    for (let li = 0; li < maxL; li++) {
      if (JSON.stringify(b.lines[li]) !== JSON.stringify(a.lines[li]))
        changes.push({ type: "line_changed", sectionIndex: si, lineIndex: li, from: b.lines[li] || null, to: a.lines[li] || null });
    }
  }
  return { changes };
}

/** Group sections by scenario label */
const scenarioPattern = /^((?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+))\s*[—\-–:]\s*/i;

interface ScenarioGroup {
  label: string;
  sectionIndices: number[];
}

function groupByScenario(sections: JESection[]): ScenarioGroup[] {
  const groups: ScenarioGroup[] = [];
  let current: string | null = null;
  sections.forEach((s, i) => {
    const m = s.entry_date.match(scenarioPattern);
    const label = m ? m[1] : "Journal Entries";
    if (label !== current) {
      groups.push({ label, sectionIndices: [i] });
      current = label;
    } else {
      groups[groups.length - 1].sectionIndices.push(i);
    }
  });
  return groups;
}

function entryBalance(section: JESection): { balanced: boolean; diff: number } {
  const d = section.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const c = section.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  return { balanced: Math.abs(d - c) < 0.02, diff: Math.abs(d - c) };
}

function runSingleEntryValidation(section: JESection, reqJE?: boolean): ValidationResult[] {
  const pkg: AnswerPackageData = {
    answer_payload: { teaching_aids: { journal_entries: [section] } },
    extracted_inputs: {},
    computed_values: {},
    requires_je: reqJE,
  };
  return runValidation(pkg);
}

// ── Component ──

export function VariantReviewDrawer({ open, onOpenChange, variant, problem, chapterId, onApproved, onRejected }: VariantReviewDrawerProps) {
  const { data: approvedAccounts } = useChapterApprovedAccounts(chapterId);

  // Parse initial sections
  const initialSections = useCallback((): JESection[] => {
    if (!variant) return [];
    const scenarioSections: any[] = variant.candidate_data?.scenario_sections || variant.journal_entry_completed_json?.scenario_sections || [];
    if (scenarioSections.length > 0) {
      const all: JESection[] = [];
      for (const sc of scenarioSections) {
        const entries: any[] = sc.entries_by_date || sc.journal_entries || [];
        for (const entry of entries) {
          const label = scenarioSections.length > 1 ? `${sc.label} — ${entry.entry_date || ""}` : (entry.entry_date || "");
          all.push({
            entry_date: label,
            lines: (entry.rows || entry.lines || []).map((l: any) => ({
              account_name: l.account_name || l.account || "",
              debit: l.debit != null ? Number(l.debit) : null,
              credit: l.credit != null ? Number(l.credit) : null,
              memo: l.memo || "",
              indentation_level: (l.credit != null && l.credit !== 0 ? 1 : 0) as 0 | 1,
            })),
          });
        }
      }
      if (all.length > 0) return all;
    }
    if (variant.journal_entry_completed_json && Array.isArray(variant.journal_entry_completed_json)) {
      if (variant.journal_entry_completed_json[0]?.entry_date !== undefined) {
        return variant.journal_entry_completed_json.map((s: any) => ({
          entry_date: s.entry_date || "",
          lines: (s.lines || s.rows || []).map((l: any) => ({
            account_name: l.account_name || l.account || "",
            debit: l.debit != null ? Number(l.debit) : null,
            credit: l.credit != null ? Number(l.credit) : null,
            memo: l.memo || "",
            indentation_level: (l.indentation_level ?? (l.credit != null ? 1 : 0)) as 0 | 1,
          })),
        }));
      }
      return groupsToSections(variant.journal_entry_completed_json);
    }
    if (variant.journal_entry_block) {
      const parsed = parseLegacyJEBlock(variant.journal_entry_block);
      if (parsed.length > 0) return parsed.map((g: any) => ({
        entry_date: g.label || "", lines: (g.lines || []).map((l: any) => ({
          account_name: l.account || "", debit: l.debit, credit: l.credit, memo: "",
          indentation_level: (l.side === "credit" ? 1 : 0) as 0 | 1,
        })),
      }));
    }
    if (variant.answer_only) {
      const parsed = parseLegacyAnswerOnly(variant.answer_only);
      if (parsed.length > 0) return parsed.map((g: any) => ({
        entry_date: g.label || "", lines: (g.lines || []).map((l: any) => ({
          account_name: l.account || "", debit: l.debit, credit: l.credit, memo: "",
          indentation_level: (l.side === "credit" ? 1 : 0) as 0 | 1,
        })),
      }));
    }
    return [];
  }, [variant]);

  // State
  const [sections, setSections] = useState<JESection[]>([]);
  const [entryMeta, setEntryMeta] = useState<EntryMeta[]>([]);
  const [globalValidation, setGlobalValidation] = useState<ValidationResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const [recentFixes, setRecentFixes] = useState<any[]>([]);
  const [showFixes, setShowFixes] = useState(false);
  const [openEntryIndex, setOpenEntryIndex] = useState<number | null>(null);
  const [approvalBlockedModal, setApprovalBlockedModal] = useState(false);
  const [isLegacyFallback, setIsLegacyFallback] = useState(false);
  const [showGenLog, setShowGenLog] = useState(false);
  const [requiresJE, setRequiresJE] = useState(false);
  const [missingStructuredJE, setMissingStructuredJE] = useState(false);

  // Init
  useEffect(() => {
    if (variant && open) {
      const problemText = variant.survive_problem_text || variant.variant_problem_text || problem?.problem_text || "";
      const needsJE = detectRequiresJE(problemText);
      setRequiresJE(needsJE);

      let s = initialSections();

      // Detect if we're using legacy fallback (no canonical structured data)
      const hasCanonical = isCanonicalJE(variant.candidate_data) ||
        isCanonicalJE(variant.journal_entry_completed_json) ||
        (variant.candidate_data?.scenario_sections?.length > 0);
      setIsLegacyFallback(s.length > 0 && !hasCanonical);

      // Auto-normalize legacy text if requires_je but no structured JE
      if (needsJE && s.length === 0) {
        const legacyText = variant.journal_entry_block || variant.answer_only || variant.survive_solution_text || "";
        if (legacyText) {
          const result = normalizeLegacyJEText(legacyText);
          if (result.success) {
            s = result.scenario_sections.flatMap(sc =>
              sc.entries_by_date.map(entry => ({
                entry_date: sc.label !== "Journal Entry" ? `${sc.label} — ${entry.entry_date}` : entry.entry_date,
                lines: entry.rows.map(r => ({
                  account_name: r.account_name,
                  debit: r.debit,
                  credit: r.credit,
                  memo: r.memo || "",
                  indentation_level: (r.credit != null && r.credit !== 0 ? 1 : 0) as 0 | 1,
                })),
              }))
            );
            setIsLegacyFallback(true);
          }
        }
      }

      setMissingStructuredJE(needsJE && s.length === 0);
      setSections(s);
      setHasEdits(false);
      setEditVersion(0);
      setOpenEntryIndex(null);

      // Initialize entry meta — all start as draft with per-entry validation
      const meta: EntryMeta[] = s.map(sec => {
        const vr = runSingleEntryValidation(sec, needsJE);
        return {
          status: "draft" as EntryStatus,
          originalLines: JSON.parse(JSON.stringify(sec.lines)),
          editedAt: null,
          editedBy: null,
          validationResults: vr,
        };
      });
      setEntryMeta(meta);
      runGlobalValidation(s);
      loadRecentFixes();
    }
  }, [variant, open]);

  const loadRecentFixes = async () => {
    if (!chapterId) return;
    const { data } = await supabase
      .from("correction_events").select("*")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false }).limit(5);
    setRecentFixes(data || []);
  };

  const runGlobalValidation = (s: JESection[]) => {
    const pkg: AnswerPackageData = {
      answer_payload: { teaching_aids: { journal_entries: s } },
      extracted_inputs: {},
      computed_values: {},
      requires_je: requiresJE,
    };
    setGlobalValidation(runValidation(pkg));
  };

  // Scenario groups
  const scenarioGroups = useMemo(() => groupByScenario(sections), [sections]);

  // Check if entry is unlocked (chronological order within each scenario group)
  const isEntryUnlocked = useCallback((sectionIndex: number): boolean => {
    for (const group of scenarioGroups) {
      const idx = group.sectionIndices.indexOf(sectionIndex);
      if (idx === -1) continue;
      // First entry in group is always unlocked
      if (idx === 0) return true;
      // All prior entries in this group must be validated
      for (let i = 0; i < idx; i++) {
        const priorMeta = entryMeta[group.sectionIndices[i]];
        if (!priorMeta || priorMeta.status !== "validated") return false;
      }
      return true;
    }
    return true;
  }, [scenarioGroups, entryMeta]);

  // All entries validated?
  const allEntriesValidated = useMemo(() =>
    entryMeta.length > 0 && entryMeta.every(m => m.status === "validated"),
    [entryMeta]);

  const globalFailed = hasFailures(globalValidation);
  const canApprove = !globalFailed && allEntriesValidated && !saving && !missingStructuredJE;

  // Handle section change for a single entry
  const handleSingleEntryChange = (si: number, newSection: JESection) => {
    const next = sections.map((s, i) => i === si ? newSection : s);
    setSections(next);
    setHasEdits(true);

    // Update entry meta — re-validate and mark corrected
    const vr = runSingleEntryValidation(newSection, requiresJE);
    setEntryMeta(prev => prev.map((m, i) => i === si ? {
      ...m,
      status: m.status === "validated" ? "corrected" : (m.status === "draft" ? "corrected" : m.status),
      validationResults: vr,
      editedAt: new Date().toISOString(),
    } : m));

    runGlobalValidation(next);
  };

  const handleMarkEntryCorrect = async (si: number) => {
    const section = sections[si];
    const meta = entryMeta[si];
    if (!meta) return;

    const bal = entryBalance(section);
    if (!bal.balanced) {
      toast.error(`Entry is off by $${bal.diff.toFixed(2)} — fix balance first`);
      return;
    }

    const entryFails = meta.validationResults.some(r => r.status === "fail");
    if (entryFails) {
      toast.error("Fix validation errors before marking correct");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    setEntryMeta(prev => prev.map((m, i) => i === si ? {
      ...m,
      status: "validated",
      editedAt: new Date().toISOString(),
      editedBy: user?.id || null,
    } : m));

    toast.success(`"${section.entry_date}" marked as validated`);
  };

  const handleSaveEdits = async () => {
    if (!variant || !problem) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const originalSections = entryMeta.map(m => ({
        entry_date: "",
        lines: m.originalLines,
      }));
      const diff = buildDiff(originalSections, sections);
      const autoTags = autoTagCorrections(originalSections, sections);
      const summary = autoTags.length > 0
        ? `Fixed: ${autoTags.join(", ")}`
        : `Manual JE edits (${diff.changes.length} changes)`;

      await supabase.from("correction_events").insert({
        source_problem_id: problem.id, chapter_id: chapterId,
        user_id: user?.id || null,
        before_json: originalSections, after_json: sections,
        diff_json: diff, auto_tags: autoTags, summary,
      } as any);

      const newVersion = editVersion + 1;
      const updatedCandidate = {
        ...(variant.candidate_data || variant),
        journal_entry_completed_json: sections,
        updated_by_user: true,
        updated_at: new Date().toISOString(),
        _edit_version: newVersion,
        _edited_at: new Date().toISOString(),
        _edited_by: user?.id,
        _entry_meta: entryMeta.map((m, i) => ({
          entry_date: sections[i]?.entry_date,
          status: m.status,
          original_generated_rows: m.originalLines,
          edited_rows: sections[i]?.lines,
          edited_at: m.editedAt,
          edited_by: m.editedBy,
        })),
      };

      if (variant._variantId) {
        const { error } = await supabase.from("problem_variants").insert({
          base_problem_id: problem.id,
          variant_label: `${variant.variant_label || "Variant"} (edit v${newVersion})`,
          variant_problem_text: variant.variant_problem_text || variant.survive_problem_text || "",
          variant_solution_text: variant.variant_solution_text || variant.survive_solution_text || "",
          candidate_data: updatedCandidate,
          journal_entry_completed_json: sections as any,
        } as any);
        if (error) throw error;
      }

      await logActivity({
        actor_type: "user", entity_type: "source_problem", entity_id: problem.id,
        event_type: "USER_JE_EDIT",
        payload_json: {
          variant_id: variant._variantId, auto_tags: autoTags,
          change_count: diff.changes.length, edit_version: newVersion,
          entry_statuses: entryMeta.map(m => m.status),
        },
      });

      // Update original lines to current
      setEntryMeta(prev => prev.map((m, i) => ({
        ...m,
        originalLines: JSON.parse(JSON.stringify(sections[i]?.lines || [])),
      })));
      setHasEdits(false);
      setEditVersion(newVersion);
      toast.success(`Saved as new version (v${newVersion})`);
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!canApprove) {
      setApprovalBlockedModal(true);
      return;
    }
    if (hasEdits) await handleSaveEdits();
    onApproved();
  };

  if (!variant) return null;

  const hasJE = sections.length > 0;
  const validatedCount = entryMeta.filter(m => m.status === "validated").length;
  const totalEntries = entryMeta.length;

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
            {hasJE && (
              <Badge variant="outline" className={cn(
                "text-[10px]",
                allEntriesValidated
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-amber-400 border-amber-500/30 bg-amber-500/10"
              )}>
                {validatedCount}/{totalEntries} entries validated
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

          {/* ════════ JOURNAL ENTRIES — Per-Date Review ════════ */}
          {hasJE && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                Journal Entry Review
              </p>

              {/* Missing structured JE blocking banner */}
              {missingStructuredJE && (
                <div className="rounded-md border border-destructive/60 bg-destructive/15 px-3 py-2.5 mb-3 flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-destructive">Structured JE missing — must fix before approval</p>
                    <p className="text-[10px] text-destructive/70 mt-0.5">
                      This problem requires journal entries but none could be parsed. Re-generate or manually add entries.
                    </p>
                  </div>
                </div>
              )}

              {/* Legacy fallback banner */}
              {isLegacyFallback && !missingStructuredJE && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 mb-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400">Structured JE auto-normalized from legacy text</p>
                    <p className="text-[10px] text-amber-400/70 mt-0.5">
                      Review carefully — re-generate this variant for best results.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {scenarioGroups.map((group, gi) => (
                  <div key={gi}>
                    {/* Scenario label */}
                    {scenarioGroups.length > 1 || group.label !== "Journal Entries" ? (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-px flex-1 bg-primary/20" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {group.label}
                        </span>
                        <div className="h-px flex-1 bg-primary/20" />
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      {group.sectionIndices.map((si) => {
                        const section = sections[si];
                        const meta = entryMeta[si];
                        if (!section || !meta) return null;

                        const unlocked = isEntryUnlocked(si);
                        const isOpen = openEntryIndex === si;
                        const bal = entryBalance(section);
                        const entryFails = meta.validationResults.some(r => r.status === "fail");
                        const displayDate = section.entry_date.replace(scenarioPattern, "").trim() || section.entry_date || "Entry";

                        // Status icon
                        const StatusIcon = meta.status === "validated"
                          ? CheckCircle2
                          : entryFails ? XCircle : Circle;
                        const statusColor = meta.status === "validated"
                          ? "text-green-400"
                          : entryFails ? "text-destructive" : "text-amber-400";

                        return (
                          <div key={si} className="rounded-lg border border-border overflow-hidden">
                            {/* Toggle header */}
                            <button
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                                unlocked ? "hover:bg-muted/30 cursor-pointer" : "opacity-50 cursor-not-allowed",
                                isOpen && "bg-muted/20"
                              )}
                              onClick={() => {
                                if (!unlocked) {
                                  toast.info("Validate earlier entries first");
                                  return;
                                }
                                setOpenEntryIndex(isOpen ? null : si);
                              }}
                              disabled={!unlocked}
                            >
                              {!unlocked ? (
                                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusColor)} />
                              )}

                              <span className="text-xs font-semibold text-foreground flex-1">{displayDate}</span>

                              {meta.status === "validated" && (
                                <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-500/30">
                                  Validated
                                </Badge>
                              )}
                              {meta.status === "corrected" && (
                                <Badge variant="outline" className="text-[9px] h-4 text-amber-400 border-amber-500/30">
                                  Edited
                                </Badge>
                              )}
                              {entryFails && meta.status !== "validated" && (
                                <Badge variant="outline" className="text-[9px] h-4 text-destructive border-destructive/30">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Errors
                                </Badge>
                              )}
                              {!bal.balanced && (
                                <Badge variant="outline" className="text-[9px] h-4 text-destructive border-destructive/30">
                                  Off ${bal.diff.toFixed(2)}
                                </Badge>
                              )}

                              {unlocked && (
                                <ChevronDown className={cn(
                                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                  isOpen && "rotate-180"
                                )} />
                              )}
                            </button>

                            {/* Expanded content */}
                            {isOpen && unlocked && (
                              <div className="border-t border-border px-3 py-3 space-y-3">
                                {/* JE Editor for this single entry */}
                                <JournalEntryEditor
                                  sections={[section]}
                                  onChange={(newSections) => {
                                    if (newSections[0]) handleSingleEntryChange(si, newSections[0]);
                                  }}
                                  chapterId={chapterId}
                                  approvedAccounts={approvedAccounts}
                                />

                                {/* Per-entry validation warnings */}
                                {meta.validationResults.filter(r => r.status !== "pass").length > 0 && (
                                  <div className="space-y-1">
                                    {meta.validationResults.filter(r => r.status !== "pass").map((r, ri) => (
                                      <div key={ri} className={cn(
                                        "rounded border px-2.5 py-1.5 text-xs flex items-start gap-1.5",
                                        r.status === "fail"
                                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                                          : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                                      )}>
                                        {r.status === "fail" ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                                        <span>{r.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Mark Entry Correct */}
                                <div className="flex items-center justify-between pt-1">
                                  <div className="text-[10px] text-muted-foreground">
                                    {bal.balanced ? (
                                      <span className="text-green-400 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Balanced
                                      </span>
                                    ) : (
                                      <span className="text-destructive flex items-center gap-1">
                                        <XCircle className="h-3 w-3" /> Off by ${bal.diff.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                  {meta.status !== "validated" ? (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={!bal.balanced || entryFails}
                                      onClick={() => handleMarkEntryCorrect(si)}
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Entry Correct
                                    </Button>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30 bg-green-500/10">
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> Validated
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No JE content — offer manual creation if requires_je */}
          {!hasJE && (
            <div className="border border-dashed border-border rounded p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground italic">
                No structured journal entry data.
              </p>
              {requiresJE && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    const initial: JESection[] = [
                      { entry_date: "Entry 1", lines: [
                        { account_name: "", debit: null, credit: null, memo: "", indentation_level: 0 },
                        { account_name: "", debit: null, credit: null, memo: "", indentation_level: 1 },
                      ]},
                    ];
                    setSections(initial);
                    setMissingStructuredJE(false);
                    setHasEdits(true);
                    setEntryMeta([{
                      status: "draft",
                      originalLines: [],
                      editedAt: null,
                      editedBy: null,
                      validationResults: [],
                    }]);
                    setOpenEntryIndex(0);
                    runGlobalValidation(initial);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Journal Entries Manually
                </Button>
              )}
            </div>
          )}

          {/* Global Validation */}
          {globalValidation.length > 0 && (
            <ValidationPanel
              results={globalValidation}
              sections={sections}
              onAutoFix={(fixedSections, desc) => {
                setSections(fixedSections);
                setHasEdits(true);
                // Re-init entry meta validation
                setEntryMeta(prev => prev.map((m, i) => ({
                  ...m,
                  status: "corrected" as EntryStatus,
                  validationResults: runSingleEntryValidation(fixedSections[i] || sections[i], requiresJE),
                })));
                runGlobalValidation(fixedSections);
                toast.success(desc);
              }}
            />
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
                <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save as New Version"}
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
              All journal entries must be validated before approval.
              {!allEntriesValidated && (
                <span className="block mt-2 text-foreground font-medium">
                  {validatedCount} of {totalEntries} entries validated.
                </span>
              )}
              {globalFailed && (
                <span className="block mt-1 text-destructive">
                  There are also global validation errors that must be fixed.
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
