import { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Check, X, RefreshCw, Flag, Expand, Zap, ChevronRight } from "lucide-react";
import { HighlightedText } from "./HighlightedText";
import { type Highlight, validateHighlights } from "@/lib/highlightTypes";
import { normalizeToParts, isTextPart, isJEPart, formatPartLabel } from "@/lib/variantParts";
import { toast } from "sonner";

// ── Problem Type Detection ──

type ProblemType = "JE" | "CALC" | "CONCEPT" | "MIXED";

function detectProblemType(variant: any): ProblemType {
  const parts = normalizeToParts(variant);
  const hasJE = parts.some(isJEPart) || !!variant.journal_entry_completed_json;
  const hasText = parts.some(isTextPart);
  const problemText = (variant.survive_problem_text || variant.variant_problem_text || "").toLowerCase();
  
  const jeKeywords = ["record", "journal entr", "prepare the entry", "journalize"];
  const calcKeywords = ["compute", "calculate", "determine the amount", "what is the"];
  const conceptKeywords = ["which of the following", "true or false", "select the best", "identify"];
  
  const isJEProblem = jeKeywords.some(k => problemText.includes(k));
  const isCalcProblem = calcKeywords.some(k => problemText.includes(k));
  const isConceptProblem = conceptKeywords.some(k => problemText.includes(k));
  
  if (hasJE && hasText) return "MIXED";
  if (hasJE || isJEProblem) return "JE";
  if (isConceptProblem) return "CONCEPT";
  if (isCalcProblem || hasText) return "CALC";
  return "MIXED";
}

const PROBLEM_TYPE_COLORS: Record<ProblemType, string> = {
  JE: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  CALC: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  CONCEPT: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  MIXED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

// ── Props ──

interface SpeedReviewPanelProps {
  variant: any;
  problem: any;
  variantIndex: number;
  totalVariants: number;
  isApproving?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onFlagForDeepReview: () => void;
  onNext: () => void;
  onBack?: () => void;
  onOpenFullReview: () => void;
}

export function SpeedReviewPanel({
  variant,
  problem,
  variantIndex,
  totalVariants,
  isApproving = false,
  onApprove,
  onReject,
  onRegenerate,
  onFlagForDeepReview,
  onNext,
  onBack,
  onOpenFullReview,
}: SpeedReviewPanelProps) {
  const parts = useMemo(() => normalizeToParts(variant), [variant]);
  const textParts = useMemo(() => parts.filter(isTextPart), [parts]);
  const jeParts = useMemo(() => parts.filter(isJEPart), [parts]);
  const problemType = useMemo(() => detectProblemType(variant), [variant]);

  const problemText = variant.survive_problem_text || variant.variant_problem_text || "";
  const solutionText = variant.survive_solution_text || variant.variant_solution_text || "";
  const highlights: Highlight[] = useMemo(() => {
    const raw = variant.highlight_key_json;
    if (Array.isArray(raw) && raw.length > 0) return validateHighlights(raw, problemText);
    return [];
  }, [variant.highlight_key_json, problemText]);

  const hasJE = jeParts.length > 0 || !!variant.journal_entry_completed_json;

  // Collapsible state — matches asset detail modal order
  const [showProblem, setShowProblem] = useState(true);
  const [showJE, setShowJE] = useState(false);
  const [showWorkedSteps, setShowWorkedSteps] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [showExamTraps, setShowExamTraps] = useState(false);

  // Keyboard shortcuts — A/R/F auto-advance, S=skip, B=back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          onApprove();
          break;
        case "r":
          e.preventDefault();
          onRegenerate();
          break;
        case "f":
          e.preventDefault();
          onFlagForDeepReview();
          break;
        case "s":
          e.preventDefault();
          onNext();
          break;
        case "b":
          e.preventDefault();
          onBack?.();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onApprove, onRegenerate, onFlagForDeepReview, onNext, onBack]);

  const confidence = variant.confidence_score ?? variant.candidate_data?.confidence_score ?? null;
  const difficulty = variant.difficulty_estimate ?? variant.candidate_data?.difficulty ?? null;

  return (
    <div className="space-y-3">
      {/* ── Metadata Bar ── */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-md border border-border bg-muted/10">
        <Badge variant="outline" className="text-[10px] font-mono">
          V{variantIndex + 1}/{totalVariants}
        </Badge>
        <Badge variant="outline" className={cn("text-[10px] font-semibold", PROBLEM_TYPE_COLORS[problemType])}>
          {problemType}
        </Badge>
        {difficulty != null && (
          <Badge variant="outline" className="text-[10px]">
            Diff: {difficulty}/10
          </Badge>
        )}
        {confidence != null && (
          <Badge variant="outline" className="text-[10px]">
            Conf: {confidence}%
          </Badge>
        )}
        {highlights.length > 0 && (
          <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
            {highlights.length} highlights
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" />
          <span className="text-[9px] text-muted-foreground font-medium">Speed Review</span>
        </div>
      </div>

      {/* ── Collapsible Sections (matching Asset Detail order) ── */}
      <div className="space-y-0 rounded-lg border border-border bg-background overflow-hidden">

        {/* ── PROBLEM TEXT ── */}
        <Collapsible open={showProblem} onOpenChange={setShowProblem}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showProblem ? "rotate-90" : ""}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Problem Text</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3 space-y-3">
            <div className="text-sm text-foreground leading-relaxed">
              <HighlightedText
                text={problemText || "—"}
                highlights={highlights}
                showHighlights={highlights.length > 0}
              />
            </div>

            {/* Answer text */}
            {solutionText && (
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Answer Text</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {solutionText.slice(0, 600)}{solutionText.length > 600 ? "…" : ""}
                </p>
              </div>
            )}

            {/* Final Answer values from parts */}
            {textParts.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Final Answer</p>
                <div className="space-y-1.5">
                  {textParts.map((tp, i) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-primary">{formatPartLabel(tp.label)}</span>
                      <span className="text-sm font-medium text-foreground">{tp.final_answer}</span>
                      {tp.final_value != null && (
                        <span className="text-xs font-mono text-muted-foreground">
                          = {typeof tp.final_value === "number" ? tp.final_value.toLocaleString() : tp.final_value}
                          {tp.units ? ` ${tp.units}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy answer_only fallback */}
            {textParts.length === 0 && variant.answer_only && (
              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Final Answer</p>
                <p className="text-sm font-mono font-medium text-foreground">{variant.answer_only}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ── JOURNAL ENTRIES ── */}
        {hasJE && (
          <Collapsible open={showJE} onOpenChange={setShowJE}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showJE ? "rotate-90" : ""}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Journal Entries</span>
              {jeParts.length > 0 && (
                <Badge variant="outline" className="text-[9px] h-4 ml-auto">{jeParts.length} {jeParts.length === 1 ? "part" : "parts"}</Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-3 pb-3">
              <div className="space-y-2">
                {jeParts.map((jp, pi) => (
                  <div key={pi} className="rounded border border-border overflow-hidden">
                    {jp.je_structured.map((entry, ei) => {
                      const totalDebit = entry.entries.reduce((s, e) => s + (e.debit ?? 0), 0);
                      const totalCredit = entry.entries.reduce((s, e) => s + (e.credit ?? 0), 0);
                      const balanced = Math.abs(totalDebit - totalCredit) < 0.02;
                      return (
                        <div key={ei}>
                          <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/50">
                            <span className="text-[10px] font-medium text-foreground">{entry.date}</span>
                            <Badge variant="outline" className={cn("text-[9px] h-3.5", balanced ? "text-green-600 dark:text-green-400 border-green-500/30" : "text-red-600 dark:text-red-400 border-red-500/30")}>
                              {balanced ? "✓" : `Off $${Math.abs(totalDebit - totalCredit).toFixed(0)}`}
                            </Badge>
                          </div>
                          <table className="w-full text-[11px]">
                            <tbody>
                              {entry.entries.map((row, ri) => (
                                <tr key={ri} className="border-b border-border/20 last:border-0">
                                  <td className={cn("px-2 py-0.5 text-foreground", row.credit && row.credit > 0 && "pl-5")}>
                                    {row.account}
                                  </td>
                                  <td className="text-right px-2 py-0.5 font-mono text-foreground w-16">
                                    {row.debit && row.debit > 0 ? `$${row.debit.toLocaleString()}` : ""}
                                  </td>
                                  <td className="text-right px-2 py-0.5 font-mono text-foreground w-16">
                                    {row.credit && row.credit > 0 ? `$${row.credit.toLocaleString()}` : ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── WORKED STEPS ── */}
        {solutionText && (
          <Collapsible open={showWorkedSteps} onOpenChange={setShowWorkedSteps}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showWorkedSteps ? "rotate-90" : ""}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Worked Steps</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-3 pb-3">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{solutionText}</p>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── IMPORTANT FORMULAS ── */}
        <Collapsible open={showFormulas} onOpenChange={setShowFormulas}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showFormulas ? "rotate-90" : ""}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Important Formulas</span>
            <Badge variant="outline" className="text-[9px] h-4 ml-auto">Preview</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3">
            <p className="text-sm text-muted-foreground text-center py-4">Generated after approval in Asset Library.</p>
          </CollapsibleContent>
        </Collapsible>

        {/* ── CONCEPTS ── */}
        <Collapsible open={showConcepts} onOpenChange={setShowConcepts}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showConcepts ? "rotate-90" : ""}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concepts</span>
            <Badge variant="outline" className="text-[9px] h-4 ml-auto">Preview</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3">
            <p className="text-sm text-muted-foreground text-center py-4">Generated after approval in Asset Library.</p>
          </CollapsibleContent>
        </Collapsible>

        {/* ── EXAM TRAPS ── */}
        <Collapsible open={showExamTraps} onOpenChange={setShowExamTraps}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showExamTraps ? "rotate-90" : ""}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam Traps</span>
            <Badge variant="outline" className="text-[9px] h-4 ml-auto">Preview</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3">
            <p className="text-sm text-muted-foreground text-center py-4">Generated after approval in Asset Library.</p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-md border border-border bg-muted/10">
        {onBack && (
          <Button size="sm" variant="ghost" onClick={onBack} className="h-8 text-xs">
            Back
            <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">B</kbd>
          </Button>
        )}
        <Button size="sm" onClick={onApprove} disabled={isApproving} className="h-8 text-xs font-medium">
          {isApproving ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Approving…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Approve
              <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">A</kbd>
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate} className="h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
          <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">R</kbd>
        </Button>
        <Button size="sm" variant="outline" onClick={onFlagForDeepReview} className="h-8 text-xs text-amber-500 hover:text-amber-400">
          <Flag className="h-3.5 w-3.5 mr-1" /> Flag
          <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">F</kbd>
        </Button>
        <Button size="sm" variant="ghost" onClick={onNext} className="h-8 text-xs">
          Skip
          <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">S</kbd>
        </Button>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={onOpenFullReview} className="h-8 text-xs">
            <Expand className="h-3.5 w-3.5 mr-1" /> Open Full Review
          </Button>
        </div>
      </div>
    </div>
  );
}
