import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, AlertTriangle, ChevronDown, Bug } from "lucide-react";
import { toast } from "sonner";
import {
  JournalEntryGroup,
  formatAmount,
  groupsToTSV,
  resolveJournalEntries,
  parseLegacyJEBlock,
  toTemplate,
  isCanonicalJE,
  type CanonicalJEPayload,
} from "@/lib/journalEntryParser";
import { StructuredJEDisplay } from "@/components/StructuredJEDisplay";

interface JournalEntryTableProps {
  completedJson?: JournalEntryGroup[] | CanonicalJEPayload | null;
  legacyAnswerText?: string | null;
  legacyJEBlock?: string | null;
  templateJson?: JournalEntryGroup[] | null;
  mode?: "completed" | "template";
  heading?: string;
  showHeading?: boolean;
}

export function JournalEntryTable({
  completedJson,
  legacyAnswerText,
  legacyJEBlock,
  templateJson,
  mode = "completed",
  heading,
  showHeading = true,
}: JournalEntryTableProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  // ── Determine JE source for debug info ──
  let jeSource = "none";
  let debugInfo: Record<string, any> = {};

  // ── Check for canonical structured format first ──
  if (mode === "completed" && isCanonicalJE(completedJson)) {
    jeSource = "journal_entry_completed_json (canonical)";
    const payload = completedJson as CanonicalJEPayload;
    debugInfo = {
      scenarios: payload.scenario_sections.length,
      entries_by_date: payload.scenario_sections.reduce((s, sc) => s + sc.entries_by_date.length, 0),
      total_rows: payload.scenario_sections.reduce((s, sc) => s + sc.entries_by_date.reduce((s2, e) => s2 + e.rows.length, 0), 0),
    };

    return (
      <div>
        <StructuredJEDisplay
          data={payload}
          heading={heading || "Answer (Journal Entry)"}
          showHeading={showHeading}
        />
        <JEDebugPanel open={debugOpen} onToggle={setDebugOpen} source={jeSource} info={debugInfo} />
      </div>
    );
  }

  // ── Legacy / flat group rendering ──
  let groups: JournalEntryGroup[];
  let isLegacyFallback = false;

  if (mode === "template") {
    // Check if templateJson is actually canonical structured
    if (isCanonicalJE(templateJson)) {
      jeSource = "journal_entry_template_json (canonical)";
      // For template mode with canonical data, render StructuredJEDisplay
      return (
        <div>
          <StructuredJEDisplay
            data={templateJson as unknown as CanonicalJEPayload}
            heading={heading || "Journal Entry (Template)"}
            showHeading={showHeading}
          />
          <JEDebugPanel open={debugOpen} onToggle={setDebugOpen} source={jeSource} info={{}} />
        </div>
      );
    }

    if (templateJson && Array.isArray(templateJson) && templateJson.length > 0) {
      groups = templateJson;
      jeSource = "journal_entry_template_json (legacy array)";
    } else {
      const completed = resolveJournalEntries(
        Array.isArray(completedJson) ? completedJson : null,
        legacyAnswerText,
      );
      if (completed.length > 0) {
        groups = toTemplate(completed);
        jeSource = "derived from completed (legacy)";
      } else {
        const fromBlock = parseLegacyJEBlock(legacyJEBlock);
        groups = toTemplate(fromBlock);
        jeSource = "derived from legacy JE block";
      }
    }
  } else {
    groups = resolveJournalEntries(
      Array.isArray(completedJson) ? completedJson : null,
      legacyAnswerText,
    );
    if (groups.length === 0 && legacyJEBlock) {
      groups = parseLegacyJEBlock(legacyJEBlock);
      jeSource = "legacy JE block parse";
    } else if (groups.length > 0) {
      jeSource = completedJson ? "journal_entry_completed_json (legacy array)" : "legacy answer text parse";
    }
    // If we ended up with legacy-parsed data, flag it
    if (groups.length > 0 && !completedJson) {
      isLegacyFallback = true;
    }
  }

  if (groups.length === 0) return null;

  debugInfo = { group_count: groups.length, total_lines: groups.reduce((s, g) => s + g.lines.length, 0) };

  const defaultHeading = mode === "template" ? "Journal Entry (Template)" : "Answer (Journal Entry)";
  const displayHeading = heading || defaultHeading;

  const handleCopyTSV = () => {
    const tsv = groupsToTSV(groups, mode);
    navigator.clipboard.writeText(tsv);
    toast.success("Copied for Google Sheets");
  };

  return (
    <div>
      {/* Legacy fallback banner */}
      {isLegacyFallback && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 mb-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-destructive">Structured JE missing — legacy fallback shown</p>
            <p className="text-[10px] text-destructive/70 mt-0.5">
              Re-generate this answer package to get structured journal entries with scenario/date toggles.
            </p>
          </div>
        </div>
      )}

      {showHeading && (
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-foreground/60 uppercase tracking-wider font-semibold">
            {displayHeading}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={handleCopyTSV}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy for Sheets
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group, gi) => (
          <div key={gi}>
            {groups.length > 1 && (
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold text-foreground">{group.label}</p>
                {group.unbalanced && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-400 border-amber-400/40">
                    Unbalanced — review needed
                  </Badge>
                )}
              </div>
            )}
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/60 font-semibold">
                      Account
                    </th>
                    <th className="text-right px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/60 font-semibold w-24">
                      Debit
                    </th>
                    <th className="text-right px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/60 font-semibold w-24">
                      Credit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line, li) => {
                    const isCredit = line.side === "credit";
                    return (
                      <tr key={li} className="border-b border-border/50 last:border-0">
                        <td className={`px-3 py-1.5 text-foreground ${isCredit ? "pl-10" : ""}`}>
                          {line.account}
                          {line.needs_review && (
                            <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 text-amber-400 border-amber-400/40">
                              Needs review
                            </Badge>
                          )}
                        </td>
                        <td className="text-right px-3 py-1.5 text-foreground font-mono">
                          {mode === "template" ? "" : (isCredit ? "" : formatAmount(line.debit))}
                        </td>
                        <td className="text-right px-3 py-1.5 text-foreground font-mono">
                          {mode === "template" ? "" : (isCredit ? formatAmount(line.credit) : "")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {group.note && (
              <p className="text-[10px] text-foreground/50 mt-1 italic">{group.note}</p>
            )}
          </div>
        ))}
      </div>

      <JEDebugPanel open={debugOpen} onToggle={setDebugOpen} source={jeSource} info={debugInfo} />
    </div>
  );
}

/** Collapsed debug panel showing JE source */
function JEDebugPanel({
  open,
  onToggle,
  source,
  info,
}: {
  open: boolean;
  onToggle: (v: boolean) => void;
  source: string;
  info: Record<string, any>;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle} className="mt-1">
      <CollapsibleTrigger className="flex items-center gap-1 text-[9px] text-foreground/40 hover:text-foreground/60 transition-colors">
        <Bug className="h-3 w-3" />
        <span>JE Debug</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className="rounded border border-border/50 bg-muted/30 px-2 py-1.5 text-[10px] text-foreground/50 font-mono space-y-0.5">
          <p>Source: <span className="text-foreground/70">{source}</span></p>
          {Object.entries(info).map(([k, v]) => (
            <p key={k}>{k}: <span className="text-foreground/70">{JSON.stringify(v)}</span></p>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
