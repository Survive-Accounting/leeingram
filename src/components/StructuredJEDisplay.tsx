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
import { format as fnsFormat } from "date-fns";

const IS_DEV = import.meta.env.DEV;

/** Parse a YYYY-MM-DD string as a local date (avoids UTC shift) */
function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  return new Date(y, m - 1, d);
}

/** Format a raw date string for display */
function formatEntryDate(raw: string | undefined | null, fallbackIndex: number): { display: string; raw: string; missing: boolean } {
  if (!raw || raw.trim() === "" || raw === "Undated") {
    return { display: `Entry ${fallbackIndex + 1}`, raw: raw ?? "(empty)", missing: true };
  }
  const local = parseLocalDate(raw);
  if (local && !isNaN(local.getTime())) {
    return { display: fnsFormat(local, "MMM d, yyyy"), raw, missing: false };
  }
  // Fallback: try native parse for ISO with time/tz
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return { display: fnsFormat(parsed, "MMM d, yyyy"), raw, missing: false };
  }
  // Unparseable – show raw string
  return { display: raw, raw, missing: false };
}

/** Extract the date string from an entry, supporting both 'entry_date' and 'date' field names */
function getEntryDate(entry: any): string | undefined {
  return entry?.entry_date ?? entry?.date;
}

interface StructuredJEDisplayProps {
  data: CanonicalJEPayload;
  heading?: string;
  showHeading?: boolean;
  templateMode?: boolean;
}

/** Infer side from row data, with backwards-compatible fallback */
function inferSide(row: any): "debit" | "credit" {
  if (row.side === "credit" || row.side === "debit") return row.side;
  if (row.credit != null && row.credit !== 0) return "credit";
  if (row.debit != null && row.debit !== 0) return "debit";
  console.warn(`[StructuredJEDisplay] No side info for account "${row.account_name}", defaulting to debit`);
  return "debit";
}

function EntryTable({ rows, entryDate, templateMode }: { rows: CanonicalJERow[]; entryDate: string; templateMode?: boolean }) {
  const bal = computeBalance(rows);

  const handleCopy = () => {
    navigator.clipboard.writeText(canonicalRowsToTSV(rows));
    toast.success("Copied for Google Sheets");
  };

  return (
    <div className="space-y-1.5">
      {!templateMode && (
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
            {rows.map((row, ri) => {
              const side = templateMode ? inferSide(row) : ((row.credit != null && row.credit !== 0) ? "credit" : "debit");
              const isCredit = side === "credit";
              return (
                <tr key={ri} className="border-b border-border/50 last:border-0">
                  <td className={cn("px-3 py-1.5 text-foreground", isCredit && "pl-10")}>
                    {row.account_name}
                  </td>
                  <td className="text-right px-3 py-1.5 text-foreground font-mono">
                    {templateMode
                      ? (side === "debit" ? <span className="text-muted-foreground">???</span> : "")
                      : (!isCredit && row.debit != null ? formatAmount(row.debit) : "")}
                  </td>
                  <td className="text-right px-3 py-1.5 text-foreground font-mono">
                    {templateMode
                      ? (side === "credit" ? <span className="text-muted-foreground">???</span> : "")
                      : (isCredit ? formatAmount(row.credit) : "")}
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

export function StructuredJEDisplay({ data, heading, showHeading = true, templateMode = false }: StructuredJEDisplayProps) {
  const sections = data.scenario_sections;

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
                {scenario.entries_by_date.map((entry, ei) => {
                  const rawDate = getEntryDate(entry);
                  const { display, raw, missing } = formatEntryDate(rawDate, ei);
                  if (missing) {
                    console.warn(`[StructuredJEDisplay] Missing date for entry index ${ei} in scenario "${scenario.label}"`);
                  }
                  return (
                    <AccordionItem key={ei} value={`entry-${si}-${ei}`} className="border border-border/50 rounded-md overflow-hidden">
                      <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{display}</span>
                          {IS_DEV && (
                            <Badge variant="secondary" className="text-[8px] h-3.5 font-mono opacity-60">
                              raw: {raw}
                            </Badge>
                          )}
                          {!templateMode && (() => {
                            const bal = computeBalance(entry.rows);
                            return bal.balanced ? (
                              <CheckCircle2 className="h-3 w-3 text-green-400" />
                            ) : (
                              <Badge variant="outline" className="text-[9px] h-4 text-destructive border-destructive/30">
                                Off ${bal.diff.toFixed(2)}
                              </Badge>
                            );
                          })()}
                          {templateMode && (
                            <Badge variant="secondary" className="text-[9px] h-4">Template</Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <EntryTable rows={entry.rows} entryDate={display} templateMode={templateMode} />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
