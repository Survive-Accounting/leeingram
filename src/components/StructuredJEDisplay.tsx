/**
 * StructuredJEDisplay — Renders canonical scenario_sections → entries_by_date
 * with accordion toggles, balance indicators, and Copy for Sheets.
 *
 * Used in JournalEntryTable and VariantReviewDrawer for read-only display.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  type CanonicalJEPayload,
  type CanonicalJERow,
  computeBalance,
  formatAmount,
  canonicalRowsToTSV,
} from "@/lib/journalEntryParser";
import { cn } from "@/lib/utils";

interface StructuredJEDisplayProps {
  data: CanonicalJEPayload;
  heading?: string;
  showHeading?: boolean;
}

function EntryTable({ rows, entryDate }: { rows: CanonicalJERow[]; entryDate: string }) {
  const bal = computeBalance(rows);

  const handleCopy = () => {
    navigator.clipboard.writeText(canonicalRowsToTSV(rows));
    toast.success("Copied for Google Sheets");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {bal.balanced ? (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Balanced
            </span>
          ) : (
            <span className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Off by ${bal.diff.toFixed(2)}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={handleCopy}>
          <Copy className="h-3 w-3 mr-1" /> Copy for Sheets
        </Button>
      </div>
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
            {rows.map((row, ri) => {
              const isCredit = row.credit != null && row.credit !== 0;
              return (
                <tr key={ri} className="border-b border-border/50 last:border-0">
                  <td className={cn("px-3 py-1.5 text-foreground", isCredit && "pl-10")}>
                    {row.account_name}
                  </td>
                  <td className="text-right px-3 py-1.5 text-foreground font-mono">
                    {!isCredit && row.debit != null ? formatAmount(row.debit) : ""}
                  </td>
                  <td className="text-right px-3 py-1.5 text-foreground font-mono">
                    {isCredit ? formatAmount(row.credit) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StructuredJEDisplay({ data, heading, showHeading = true }: StructuredJEDisplayProps) {
  const sections = data.scenario_sections;
  const singleScenario = sections.length === 1;

  return (
    <div>
      {showHeading && (
        <p className="text-[10px] text-foreground/60 uppercase tracking-wider font-semibold mb-1.5">
          {heading || "Journal Entries"}
        </p>
      )}

      <Accordion type="multiple" className="space-y-2">
        {sections.map((scenario, si) => (
          <AccordionItem key={si} value={`scenario-${si}`} className="border border-border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <span>{scenario.label}</span>
                <Badge variant="outline" className="text-[9px] h-4">
                  {scenario.entries_by_date.length} {scenario.entries_by_date.length === 1 ? "entry" : "entries"}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <Accordion type="multiple" className="space-y-1">
                {scenario.entries_by_date.map((entry, ei) => (
                  <AccordionItem key={ei} value={`entry-${si}-${ei}`} className="border border-border/50 rounded-md overflow-hidden">
                    <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.entry_date}</span>
                        {(() => {
                          const bal = computeBalance(entry.rows);
                          return bal.balanced ? (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4 text-destructive border-destructive/30">
                              Off ${bal.diff.toFixed(2)}
                            </Badge>
                          );
                        })()}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <EntryTable rows={entry.rows} entryDate={entry.entry_date} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
