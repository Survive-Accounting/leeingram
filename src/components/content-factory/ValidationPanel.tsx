import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, Wand2, ShieldCheck, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationResult } from "@/lib/validation";
import { autoFixDatesInAccountNames, autoFixNarrativePrefixes } from "@/lib/validation/jeValidators";

interface Props {
  results: ValidationResult[];
  sections?: any[];
  onAutoFix?: (fixedSections: any[], description: string) => void;
  onHighlightRow?: (sectionIndex: number, lineIndex: number) => void;
}

const VALIDATOR_LABELS: Record<string, string> = {
  JE_BALANCES: "Debits = Credits",
  NO_DATES_IN_ACCOUNT_NAMES: "No dates in account names",
  NO_NARRATIVE_PREFIX: "No narrative prefixes",
  ONE_SIDED_ROWS: "One-sided rows",
  CASH_DIRECTION_SANITY: "Cash direction sanity",
  SCENARIO_SECTIONS_PRESENT: "Scenario sections present",
  ACCOUNT_FIELD_FORMATTING: "Account field formatting",
  REQUIRES_JE: "Requires journal entries",
  ENTRIES_BY_DATE: "Entries by date present",
  STRUCTURED_JE_REQUIRED_MISSING: "Structured JE required",
  ACCOUNT_WHITELIST: "Account whitelist",
  required_fields_present: "Required fields",
  mc_correct_answer_in_range: "MC answer range",
  answers_count_valid: "Answer count",
  journal_entry_balances: "JE balances (legacy)",
  no_empty_required_lines: "No empty rows",
  formatting_sanity: "Formatting",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "skip") return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
}

function statusBadgeClass(status: string) {
  if (status === "pass") return "text-green-400 border-green-500/30 bg-green-500/10";
  if (status === "fail") return "text-destructive border-destructive/30 bg-destructive/10";
  if (status === "skip") return "text-muted-foreground border-border bg-muted/20";
  return "text-amber-400 border-amber-500/30 bg-amber-500/10";
}

export function ValidationPanel({ results, sections, onAutoFix, onHighlightRow }: Props) {
  const [expanded, setExpanded] = useState(true);

  if (!results || results.length === 0) return null;

  const failures = results.filter(r => r.status === "fail");
  const warnings = results.filter(r => r.status === "warn");
  const passes = results.filter(r => r.status === "pass");
  const skipped = results.filter(r => r.status === "skip");

  // If STRUCTURED_JE_REQUIRED_MISSING is failing, show only that
  const structuredBlocker = failures.find(r => r.validator === "STRUCTURED_JE_REQUIRED_MISSING");

  const canAutoFixDates = results.some(r => r.validator === "NO_DATES_IN_ACCOUNT_NAMES" && r.status === "fail");
  const canAutoFixPrefixes = results.some(r => r.validator === "NO_NARRATIVE_PREFIX" && r.status === "fail");

  const handleAutoFixDates = () => {
    if (!sections || !onAutoFix) return;
    const result = autoFixDatesInAccountNames(sections);
    if (result.fixed) onAutoFix(result.sections, result.description);
  };

  const handleAutoFixPrefixes = () => {
    if (!sections || !onAutoFix) return;
    const result = autoFixNarrativePrefixes(sections);
    if (result.fixed) onAutoFix(result.sections, result.description);
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="rounded-lg border border-border overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Validation Results</span>
          {failures.length > 0 && (
            <Badge variant="outline" className={cn("text-[9px] h-4", statusBadgeClass("fail"))}>
              {failures.length} error{failures.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {warnings.length > 0 && (
            <Badge variant="outline" className={cn("text-[9px] h-4", statusBadgeClass("warn"))}>
              {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {passes.length > 0 && (
            <Badge variant="outline" className={cn("text-[9px] h-4", statusBadgeClass("pass"))}>
              {passes.length} passed
            </Badge>
          )}
          {skipped.length > 0 && (
            <Badge variant="outline" className={cn("text-[9px] h-4", statusBadgeClass("skip"))}>
              {skipped.length} skipped
            </Badge>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-3 space-y-1.5">
          {/* If structured blocker exists, show only that */}
          {structuredBlocker ? (
            <ValidatorRow result={structuredBlocker} onHighlightRow={onHighlightRow} />
          ) : (
            <>
              {/* Failures first */}
              {failures.map((r, i) => (
                <ValidatorRow key={`fail-${i}`} result={r} onHighlightRow={onHighlightRow} />
              ))}
              {/* Warnings */}
              {warnings.map((r, i) => (
                <ValidatorRow key={`warn-${i}`} result={r} onHighlightRow={onHighlightRow} />
              ))}
              {/* Passes (collapsed) */}
              {passes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1">
                    <ChevronDown className="h-3 w-3" /> {passes.length} passed
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pt-1">
                    {passes.map((r, i) => (
                      <ValidatorRow key={`pass-${i}`} result={r} onHighlightRow={onHighlightRow} />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
              {/* Skipped (collapsed) */}
              {skipped.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1">
                    <ChevronDown className="h-3 w-3" /> {skipped.length} skipped
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pt-1">
                    {skipped.map((r, i) => (
                      <ValidatorRow key={`skip-${i}`} result={r} onHighlightRow={onHighlightRow} />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}

          {/* Auto-fix buttons */}
          {!structuredBlocker && (canAutoFixDates || canAutoFixPrefixes) && sections && onAutoFix && (
            <div className="pt-2 border-t border-border/50 flex gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold self-center">Auto-fix:</span>
              {canAutoFixDates && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleAutoFixDates}>
                  <Wand2 className="h-3 w-3 mr-1" /> Strip dates from accounts
                </Button>
              )}
              {canAutoFixPrefixes && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleAutoFixPrefixes}>
                  <Wand2 className="h-3 w-3 mr-1" /> Split narrative prefixes
                </Button>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ValidatorRow({ result, onHighlightRow }: { result: ValidationResult; onHighlightRow?: (si: number, li: number) => void }) {
  const label = VALIDATOR_LABELS[result.validator] || result.validator;
  const offending = result.details?.offending as Array<{ sectionIndex: number; lineIndex: number }> | undefined;
  const warnings = result.details?.warnings as Array<{ sectionIndex: number; lineIndex: number; reason: string }> | undefined;

  return (
    <div className={cn(
      "rounded px-2.5 py-1.5 flex items-start gap-2 text-xs",
      result.status === "fail" && "bg-destructive/5 border border-destructive/20",
      result.status === "warn" && "bg-amber-500/5 border border-amber-500/20",
      result.status === "skip" && "bg-muted/10 border border-border/30",
      result.status === "pass" && "bg-muted/20",
    )}>
      <StatusIcon status={result.status} />
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", result.status === "skip" ? "text-muted-foreground" : "text-foreground")}>{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 break-words">
          {result.status === "skip" ? `skipped: ${result.message}` : result.message}
        </p>
        {/* Clickable offending rows */}
        {offending && offending.length > 0 && onHighlightRow && (
          <div className="flex flex-wrap gap-1 mt-1">
            {offending.map((o, i) => (
              <button
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                onClick={() => onHighlightRow(o.sectionIndex, o.lineIndex)}
              >
                S{o.sectionIndex + 1} R{o.lineIndex + 1}
              </button>
            ))}
          </div>
        )}
        {warnings && warnings.length > 0 && onHighlightRow && (
          <div className="flex flex-wrap gap-1 mt-1">
            {warnings.map((w, i) => (
              <button
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                onClick={() => onHighlightRow(w.sectionIndex, w.lineIndex)}
                title={w.reason}
              >
                S{w.sectionIndex + 1} R{w.lineIndex + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
