import { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Check, X, RefreshCw, Flag, Expand, Zap, ChevronRight, Copy } from "lucide-react";
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

  // Learning structures from candidate_data
  const tAccountsJson = variant.t_accounts_json || variant.candidate_data?.t_accounts_json || null;
  const tablesJson = variant.tables_json || variant.candidate_data?.tables_json || null;
  const financialStatementsJson = variant.financial_statements_json || variant.candidate_data?.financial_statements_json || null;
  const hasTAccounts = Array.isArray(tAccountsJson) && tAccountsJson.length > 0;
  const hasTables = Array.isArray(tablesJson) && tablesJson.length > 0;
  const hasFinancialStatements = Array.isArray(financialStatementsJson) && financialStatementsJson.length > 0;

  // Collapsible state — matches asset detail modal order
  const [showProblem, setShowProblem] = useState(true);
  const [showJE, setShowJE] = useState(false);
  const [showWorkedSteps, setShowWorkedSteps] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [showExamTraps, setShowExamTraps] = useState(false);
  const [showTAccounts, setShowTAccounts] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [showFinStatements, setShowFinStatements] = useState(false);

  // Keyboard shortcuts — A/R/F auto-advance, S=skip, B=back, Ctrl+J=approve&next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl+J = Approve & Next (primary action)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onApprove();
        return;
      }

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
            {!variant.important_formulas && <Badge variant="outline" className="text-[9px] h-4 ml-auto">Not generated</Badge>}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3">
            {variant.important_formulas ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{variant.important_formulas}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Will be generated with variant.</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ── CONCEPTS ── */}
        <Collapsible open={showConcepts} onOpenChange={setShowConcepts}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showConcepts ? "rotate-90" : ""}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concepts</span>
            {!variant.concept_notes && <Badge variant="outline" className="text-[9px] h-4 ml-auto">Not generated</Badge>}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3">
            {variant.concept_notes ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{variant.concept_notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Will be generated with variant.</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ── EXAM TRAPS ── */}
        <Collapsible open={showExamTraps} onOpenChange={setShowExamTraps}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showExamTraps ? "rotate-90" : ""}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam Traps</span>
            {!variant.exam_traps && <Badge variant="outline" className="text-[9px] h-4 ml-auto">Not generated</Badge>}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pt-3 pb-3">
            {variant.exam_traps ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{variant.exam_traps}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Will be generated with variant.</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ── T ACCOUNTS ── */}
        {hasTAccounts && (
          <Collapsible open={showTAccounts} onOpenChange={setShowTAccounts}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showTAccounts ? "rotate-90" : ""}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">T Accounts</span>
              <Badge variant="outline" className="text-[9px] h-4 ml-auto">{tAccountsJson.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-3 pb-3 space-y-2">
              {tAccountsJson.map((ta: any, i: number) => {
                const tsv = `${ta.account_name}\nDebit\tCredit\n${Math.max(ta.debits?.length || 0, ta.credits?.length || 0) > 0 ? Array.from({ length: Math.max(ta.debits?.length || 0, ta.credits?.length || 0) }, (_, ri) => `${ta.debits?.[ri] || ""}\t${ta.credits?.[ri] || ""}`).join("\n") : ""}`;
                return (
                  <div key={i} className="rounded border border-border p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{ta.account_name}</span>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => { navigator.clipboard.writeText(tsv); toast.success("TSV copied"); }}>
                        <Copy className="h-3 w-3 mr-0.5" /> TSV
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <div>
                        <p className="font-medium text-muted-foreground">Debit</p>
                        {(ta.debits || []).map((d: string, di: number) => <p key={di} className="font-mono text-foreground">{d}</p>)}
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Credit</p>
                        {(ta.credits || []).map((c: string, ci: number) => <p key={ci} className="font-mono text-foreground">{c}</p>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── TABLES ── */}
        {hasTables && (
          <Collapsible open={showTables} onOpenChange={setShowTables}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 border-b border-border cursor-pointer hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showTables ? "rotate-90" : ""}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tables</span>
              <Badge variant="outline" className="text-[9px] h-4 ml-auto">{tablesJson.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-3 pb-3 space-y-2">
              {tablesJson.map((t: any, i: number) => (
                <div key={i} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{t.title}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => { navigator.clipboard.writeText(t.tsv || ""); toast.success("TSV copied"); }}>
                      <Copy className="h-3 w-3 mr-0.5" /> TSV
                    </Button>
                  </div>
                  <pre className="text-[10px] font-mono text-foreground whitespace-pre overflow-x-auto bg-muted/20 rounded p-1.5">{t.tsv}</pre>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── FINANCIAL STATEMENTS ── */}
        {hasFinancialStatements && (
          <Collapsible open={showFinStatements} onOpenChange={setShowFinStatements}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 cursor-pointer hover:bg-accent/30 transition-colors">
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showFinStatements ? "rotate-90" : ""}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial Statements</span>
              <Badge variant="outline" className="text-[9px] h-4 ml-auto">{financialStatementsJson.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-3 pb-3 space-y-2">
              {financialStatementsJson.map((fs: any, i: number) => (
                <div key={i} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{fs.title}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => { navigator.clipboard.writeText(fs.tsv || ""); toast.success("TSV copied"); }}>
                      <Copy className="h-3 w-3 mr-0.5" /> TSV
                    </Button>
                  </div>
                  <pre className="text-[10px] font-mono text-foreground whitespace-pre overflow-x-auto bg-muted/20 rounded p-1.5">{fs.tsv}</pre>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-muted/10">
        {onBack && (
          <Button size="sm" variant="ghost" onClick={onBack} className="h-8 text-xs">
            Back
            <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">B</kbd>
          </Button>
        )}

        {/* Primary: Approve & Next — largest, full color */}
        <Button size="lg" onClick={onApprove} disabled={isApproving} className="h-11 px-6 text-sm font-semibold shadow-sm shadow-primary/20">
          {isApproving ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Approving…
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-1.5" /> Approve & Next
              <Badge variant="outline" className="ml-2 text-[9px] h-5 px-1.5 bg-primary-foreground/15 border-primary-foreground/30 text-primary-foreground">
                ⌘J
              </Badge>
            </>
          )}
        </Button>

        {/* Secondary: Approve (stay) — smaller outlined */}
        <Button size="sm" variant="outline" onClick={onApprove} disabled={isApproving} className="h-8 text-xs">
          <Check className="h-3.5 w-3.5 mr-1" /> Approve
          <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">A</kbd>
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Destructive: Reject — small outlined destructive */}
        <Button size="sm" variant="outline" onClick={onRegenerate} className="h-8 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5">
          <X className="h-3.5 w-3.5 mr-1" /> Reject
          <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">R</kbd>
        </Button>

        {/* Warning: Needs Fix — small outlined amber */}
        <Button size="sm" variant="outline" onClick={onFlagForDeepReview} className="h-8 text-xs text-amber-500 hover:text-amber-400 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5">
          <Flag className="h-3.5 w-3.5 mr-1" /> Needs Fix
          <kbd className="ml-1.5 text-[9px] opacity-60 bg-background/50 px-1 rounded">F</kbd>
        </Button>

        {/* Skip — plain text link */}
        <button onClick={onNext} className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors ml-1">
          Skip <kbd className="ml-1 text-[9px] opacity-60">(S)</kbd>
        </button>
      </div>
    </div>
  );
}
