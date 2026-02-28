import { useState, useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, X, Save, ChevronDown, AlertTriangle, ArrowLeftRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JournalEntryEditor, groupsToSections, type JESection } from "./JournalEntryEditor";
import { ValidationPanel } from "./ValidationPanel";
import { runValidation, hasFailures, type AnswerPackageData, type ValidationResult } from "@/lib/validation";
import { parseLegacyAnswerOnly } from "@/lib/journalEntryParser";
import { logActivity } from "@/lib/activityLogger";

interface VariantReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: any;
  problem: any;
  chapterId: string;
  onApproved: () => void;
  onRejected: () => void;
}

/** Auto-tag common correction patterns */
function autoTagCorrections(before: JESection[], after: JESection[]): string[] {
  const tags: string[] = [];
  
  const beforeFlat = before.flatMap(s => s.lines);
  const afterFlat = after.flatMap(s => s.lines);
  
  // Check for date removal from account names
  const datePattern = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d{2})\b/i;
  const hadDates = beforeFlat.some(l => datePattern.test(l.account_name));
  const hasDates = afterFlat.some(l => datePattern.test(l.account_name));
  if (hadDates && !hasDates) tags.push("no_dates_in_account_names");
  
  // Check for narrative prefix removal
  const prefixPattern = /^.{4,}:\s*/;
  const hadPrefixes = beforeFlat.some(l => prefixPattern.test(l.account_name));
  const hasPrefixes = afterFlat.some(l => prefixPattern.test(l.account_name));
  if (hadPrefixes && !hasPrefixes) tags.push("no_narrative_prefix_in_account");
  
  // Check for debit/credit side changes on Cash rows
  for (let i = 0; i < Math.min(beforeFlat.length, afterFlat.length); i++) {
    const bLine = beforeFlat[i];
    const aLine = afterFlat[i];
    if (bLine.account_name.toLowerCase().includes("cash") || aLine.account_name.toLowerCase().includes("cash")) {
      const bSide = bLine.debit != null ? "debit" : "credit";
      const aSide = aLine.debit != null ? "debit" : "credit";
      if (bSide !== aSide) {
        tags.push("cash_direction_fix");
        break;
      }
    }
  }
  
  // Check for discount/premium side changes
  for (let i = 0; i < Math.min(beforeFlat.length, afterFlat.length); i++) {
    const bLine = beforeFlat[i];
    const aLine = afterFlat[i];
    const name = (bLine.account_name + aLine.account_name).toLowerCase();
    if (name.includes("discount") || name.includes("premium")) {
      const bSide = bLine.debit != null ? "debit" : "credit";
      const aSide = aLine.debit != null ? "debit" : "credit";
      if (bSide !== aSide) {
        tags.push("discount_premium_side_fix");
        break;
      }
    }
  }
  
  return [...new Set(tags)];
}

/** Build a simple diff of changed rows */
function buildDiff(before: JESection[], after: JESection[]): any {
  const changes: any[] = [];
  const maxSections = Math.max(before.length, after.length);
  for (let si = 0; si < maxSections; si++) {
    const bSection = before[si];
    const aSection = after[si];
    if (!bSection && aSection) {
      changes.push({ type: "section_added", sectionIndex: si });
      continue;
    }
    if (bSection && !aSection) {
      changes.push({ type: "section_removed", sectionIndex: si });
      continue;
    }
    if (bSection.entry_date !== aSection.entry_date) {
      changes.push({ type: "date_changed", sectionIndex: si, from: bSection.entry_date, to: aSection.entry_date });
    }
    const maxLines = Math.max(bSection.lines.length, aSection.lines.length);
    for (let li = 0; li < maxLines; li++) {
      const bLine = bSection.lines[li];
      const aLine = aSection.lines[li];
      if (JSON.stringify(bLine) !== JSON.stringify(aLine)) {
        changes.push({ type: "line_changed", sectionIndex: si, lineIndex: li, from: bLine || null, to: aLine || null });
      }
    }
  }
  return { changes };
}

export function VariantReviewDrawer({ open, onOpenChange, variant, problem, chapterId, onApproved, onRejected }: VariantReviewDrawerProps) {
  // Parse initial JE sections from variant data
  const initialSections = useCallback((): JESection[] => {
    if (!variant) return [];
    // Try structured JSON first
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
      // Legacy groups format
      return groupsToSections(variant.journal_entry_completed_json);
    }
    // Try parsing from answer_only text
    if (variant.answer_only) {
      const parsed = parseLegacyAnswerOnly(variant.answer_only);
      if (parsed.length > 0) {
        return parsed.map((g: any) => ({
          entry_date: g.label || "",
          lines: (g.lines || []).map((l: any) => ({
            account_name: l.account || "",
            debit: l.debit,
            credit: l.credit,
            memo: "",
            indentation_level: (l.side === "credit" ? 1 : 0) as 0 | 1,
          })),
        }));
      }
    }
    return [];
  }, [variant]);

  const [sections, setSections] = useState<JESection[]>([]);
  const [originalSections, setOriginalSections] = useState<JESection[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [recentFixes, setRecentFixes] = useState<any[]>([]);
  const [showFixes, setShowFixes] = useState(false);

  // Load data when variant changes
  useEffect(() => {
    if (variant && open) {
      const s = initialSections();
      setSections(s);
      setOriginalSections(JSON.parse(JSON.stringify(s)));
      setHasEdits(false);
      runValidationOnSections(s);
      loadRecentFixes();
    }
  }, [variant, open]);

  const loadRecentFixes = async () => {
    if (!chapterId) return;
    const { data } = await supabase
      .from("correction_events")
      .select("*")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentFixes(data || []);
  };

  const runValidationOnSections = (s: JESection[]) => {
    const pkg: AnswerPackageData = {
      answer_payload: {
        teaching_aids: { journal_entries: s },
      },
      extracted_inputs: {},
      computed_values: {},
    };
    const results = runValidation(pkg);
    setValidationResults(results);
  };

  const handleSectionsChange = (newSections: JESection[]) => {
    setSections(newSections);
    setHasEdits(true);
    runValidationOnSections(newSections);
  };

  const handleAutoFix = (fixedSections: JESection[], description: string) => {
    setSections(fixedSections);
    setHasEdits(true);
    runValidationOnSections(fixedSections);
    toast.success(description);
  };

  const handleFlipSide = (si: number, li: number) => {
    const newSections = sections.map((s, i) => {
      if (i !== si) return s;
      return {
        ...s,
        lines: s.lines.map((l, j) => {
          if (j !== li) return l;
          // Flip debit <-> credit
          return {
            ...l,
            debit: l.credit,
            credit: l.debit,
            indentation_level: (l.debit != null ? 1 : 0) as 0 | 1,
          };
        }),
      };
    });
    handleSectionsChange(newSections);
  };

  const handleSaveEdits = async () => {
    if (!variant || !problem) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Build correction event
      const diff = buildDiff(originalSections, sections);
      const autoTags = autoTagCorrections(originalSections, sections);
      const summary = autoTags.length > 0 
        ? `Fixed: ${autoTags.join(", ")}` 
        : `Manual JE edits (${diff.changes.length} changes)`;

      // Save correction event
      await supabase.from("correction_events").insert({
        source_problem_id: problem.id,
        chapter_id: chapterId,
        user_id: user?.id || null,
        before_json: originalSections,
        after_json: sections,
        diff_json: diff,
        auto_tags: autoTags,
        summary,
      } as any);

      // Update the variant's candidate_data with new JE
      const updatedCandidate = {
        ...(variant.candidate_data || variant),
        journal_entry_completed_json: sections,
      };

      if (variant._variantId) {
        await supabase.from("problem_variants").update({
          candidate_data: updatedCandidate,
          journal_entry_completed_json: sections as any,
        } as any).eq("id", variant._variantId);
      }

      // Log activity
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: problem.id,
        event_type: "USER_JE_EDIT",
        payload_json: { 
          variant_id: variant._variantId,
          auto_tags: autoTags,
          change_count: diff.changes.length,
        },
      });

      setOriginalSections(JSON.parse(JSON.stringify(sections)));
      setHasEdits(false);
      toast.success("Edits saved with correction event logged");
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (hasEdits) {
      await handleSaveEdits();
    }
    onApproved();
  };

  const failed = hasFailures(validationResults);
  const hasWarnings = validationResults.some(r => r.status === "warn");

  if (!variant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="text-base flex items-center gap-2">
            Variant Review
            <Badge variant="outline" className="text-[10px]">
              {variant.asset_name || variant.variant_label || "Variant"}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Recent Fixes Badge */}
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(fix.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Problem Text (read-only) */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Problem Text</p>
            <div className="rounded-md border border-border bg-muted/20 p-3 max-h-40 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {variant.survive_problem_text || variant.variant_problem_text || "—"}
              </p>
            </div>
          </div>

          {/* Final Answers */}
          {variant.answer_only && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Answer Summary</p>
              <div className="rounded-md border border-border bg-muted/20 p-3 max-h-32 overflow-y-auto">
                <p className="text-sm text-foreground whitespace-pre-wrap font-mono">{variant.answer_only}</p>
              </div>
            </div>
          )}

          {/* Journal Entry Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Journal Entry Editor
              </p>
              {hasEdits && (
                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Unsaved changes
                </Badge>
              )}
            </div>
            {sections.length > 0 ? (
              <JournalEntryEditor
                sections={sections}
                onChange={handleSectionsChange}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic border border-dashed border-border rounded p-4 text-center">
                No structured journal entry data. The variant may not include JE content.
              </p>
            )}
          </div>

          {/* Validation Panel */}
          {validationResults.length > 0 && (
            <ValidationPanel
              results={validationResults}
              sections={sections}
              onAutoFix={handleAutoFix}
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
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRejected}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <div className="flex gap-2">
            {hasEdits && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveEdits}
                disabled={saving}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving…" : "Save Edits"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={failed || saving}
            >
              {failed ? (
                <>Validation Errors</>
              ) : hasWarnings ? (
                <><AlertTriangle className="h-3.5 w-3.5 mr-1" /> Override & Approve</>
              ) : (
                <><Check className="h-3.5 w-3.5 mr-1" /> Approve Variant</>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
