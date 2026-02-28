import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, AlertTriangle } from "lucide-react";
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
  // ── Check for canonical structured format first ──
  if (mode === "completed" && isCanonicalJE(completedJson)) {
    return (
      <StructuredJEDisplay
        data={completedJson}
        heading={heading || "Answer (Journal Entry)"}
        showHeading={showHeading}
      />
    );
  }

  // ── Legacy / flat group rendering ──
  let groups: JournalEntryGroup[];
  let isLegacyFallback = false;

  if (mode === "template") {
    if (templateJson && Array.isArray(templateJson) && templateJson.length > 0) {
      groups = templateJson;
    } else {
      const completed = resolveJournalEntries(
        Array.isArray(completedJson) ? completedJson : null,
        legacyAnswerText,
      );
      if (completed.length > 0) {
        groups = toTemplate(completed);
      } else {
        const fromBlock = parseLegacyJEBlock(legacyJEBlock);
        groups = toTemplate(fromBlock);
      }
    }
  } else {
    groups = resolveJournalEntries(
      Array.isArray(completedJson) ? completedJson : null,
      legacyAnswerText,
    );
    if (groups.length === 0 && legacyJEBlock) {
      groups = parseLegacyJEBlock(legacyJEBlock);
    }
    // If we ended up with legacy-parsed data, flag it
    if (groups.length > 0 && !completedJson) {
      isLegacyFallback = true;
    }
  }

  if (groups.length === 0) return null;

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
    </div>
  );
}
