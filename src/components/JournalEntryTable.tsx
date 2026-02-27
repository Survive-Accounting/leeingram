import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  JournalEntryGroup,
  formatAmount,
  groupsToTSV,
  resolveJournalEntries,
  parseLegacyJEBlock,
  toTemplate,
} from "@/lib/journalEntryParser";

interface JournalEntryTableProps {
  completedJson?: JournalEntryGroup[] | null;
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
  let groups: JournalEntryGroup[];

  if (mode === "template") {
    if (templateJson && Array.isArray(templateJson) && templateJson.length > 0) {
      groups = templateJson;
    } else {
      const completed = resolveJournalEntries(completedJson, legacyAnswerText);
      if (completed.length > 0) {
        groups = toTemplate(completed);
      } else {
        const fromBlock = parseLegacyJEBlock(legacyJEBlock);
        groups = toTemplate(fromBlock);
      }
    }
  } else {
    groups = resolveJournalEntries(completedJson, legacyAnswerText);
    if (groups.length === 0 && legacyJEBlock) {
      groups = parseLegacyJEBlock(legacyJEBlock);
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
                          {mode === "template"
                            ? ""
                            : (isCredit ? "" : formatAmount(line.debit))}
                        </td>
                        <td className="text-right px-3 py-1.5 text-foreground font-mono">
                          {mode === "template"
                            ? ""
                            : (isCredit ? formatAmount(line.credit) : "")}
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
