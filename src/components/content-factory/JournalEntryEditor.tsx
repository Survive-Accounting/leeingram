import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, CheckCircle2, XCircle, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface JELine {
  account_name: string;
  debit: number | null;
  credit: number | null;
  memo: string;
  indentation_level: 0 | 1;
}

export interface JESection {
  entry_date: string;
  lines: JELine[];
}

export interface JournalEntryEditorProps {
  sections: JESection[];
  onChange: (sections: JESection[]) => void;
  readOnly?: boolean;
  courseShort?: string;
}

function emptyLine(): JELine {
  return { account_name: "", debit: null, credit: null, memo: "", indentation_level: 0 };
}

function sectionBalance(section: JESection): { debits: number; credits: number; balanced: boolean } {
  const debits = section.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credits = section.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  return { debits, credits, balanced: Math.abs(debits - credits) < 0.02 };
}

const ACCOUNT_NORMALIZATIONS: Record<string, string> = {
  "n/p": "Notes Payable",
  "a/p": "Accounts Payable",
  "a/r": "Accounts Receivable",
  "ppd": "Prepaid",
};

function normalizeAccountName(name: string, aliases: Map<string, string>): string {
  let result = name.trim();
  // Strip leading dates
  result = result.replace(/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\s*[-:–]\s*/i, "");
  result = result.trim();

  // Check aliases
  const lower = result.toLowerCase();
  for (const [key, canonical] of aliases) {
    if (lower === key.toLowerCase()) {
      return canonical;
    }
  }

  // Built-in normalizations
  const builtIn = ACCOUNT_NORMALIZATIONS[lower];
  if (builtIn) return builtIn;

  return result;
}

export function JournalEntryEditor({ sections, onChange, readOnly = false, courseShort }: JournalEntryEditorProps) {
  const [editingCell, setEditingCell] = useState<{ si: number; li: number; field: string } | null>(null);

  const { data: aliases } = useQuery({
    queryKey: ["account-aliases", courseShort],
    queryFn: async () => {
      let q = supabase.from("account_aliases").select("*");
      if (courseShort) {
        q = q.or(`course_short.is.null,course_short.eq.${courseShort}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return new Map((data ?? []).map((a: any) => [a.canonical_name, a.preferred_display_name]));
    },
  });

  const displayName = useCallback((canonical: string) => {
    return aliases?.get(canonical) ?? canonical;
  }, [aliases]);

  const updateLine = (si: number, li: number, patch: Partial<JELine>) => {
    const next = sections.map((s, i) => i === si ? {
      ...s,
      lines: s.lines.map((l, j) => j === li ? { ...l, ...patch } : l),
    } : s);
    onChange(next);
  };

  const addLine = (si: number) => {
    const next = sections.map((s, i) => i === si ? { ...s, lines: [...s.lines, emptyLine()] } : s);
    onChange(next);
  };

  const removeLine = (si: number, li: number) => {
    const next = sections.map((s, i) => i === si ? { ...s, lines: s.lines.filter((_, j) => j !== li) } : s);
    onChange(next);
  };

  const moveLine = (si: number, li: number, dir: -1 | 1) => {
    const target = li + dir;
    const s = sections[si];
    if (target < 0 || target >= s.lines.length) return;
    const lines = [...s.lines];
    [lines[li], lines[target]] = [lines[target], lines[li]];
    const next = sections.map((sec, i) => i === si ? { ...sec, lines } : sec);
    onChange(next);
  };

  const duplicateLine = (si: number, li: number) => {
    const s = sections[si];
    const newLines = [...s.lines];
    newLines.splice(li + 1, 0, { ...s.lines[li] });
    const next = sections.map((sec, i) => i === si ? { ...sec, lines: newLines } : sec);
    onChange(next);
  };

  const addSection = () => {
    onChange([...sections, { entry_date: "", lines: [emptyLine(), emptyLine()] }]);
  };

  const removeSection = (si: number) => {
    onChange(sections.filter((_, i) => i !== si));
  };

  const updateSectionDate = (si: number, date: string) => {
    const next = sections.map((s, i) => i === si ? { ...s, entry_date: date } : s);
    onChange(next);
  };

  const handleNormalize = () => {
    const aliasMap = aliases ?? new Map<string, string>();
    // Build reverse map: preferred -> canonical
    const reverseMap = new Map<string, string>();
    for (const [canonical, preferred] of aliasMap) {
      reverseMap.set(preferred.toLowerCase(), canonical);
    }

    const next = sections.map(s => ({
      ...s,
      lines: s.lines.map(l => {
        let name = l.account_name.trim();
        // Strip dates
        name = name.replace(/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\s*[-:–]\s*/i, "");
        // Normalize abbreviations
        const lower = name.toLowerCase();
        const builtIn = ACCOUNT_NORMALIZATIONS[lower];
        if (builtIn) name = builtIn;

        return { ...l, account_name: name };
      }),
    }));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {sections.map((section, si) => {
        const bal = sectionBalance(section);
        return (
          <div key={si} className="border border-border rounded-lg overflow-hidden">
            {/* Section header */}
            <div className="bg-muted/40 px-3 py-1.5 flex items-center justify-between border-b border-border">
              {readOnly ? (
                <span className="text-xs font-semibold text-foreground">{section.entry_date || "Journal Entry"}</span>
              ) : (
                <Input
                  value={section.entry_date}
                  onChange={e => updateSectionDate(si, e.target.value)}
                  placeholder="Entry date (e.g. Jan 1, 2025)"
                  className="h-6 text-xs font-semibold w-48 bg-transparent border-0 p-0 focus-visible:ring-0"
                />
              )}
              <div className="flex items-center gap-2">
                {bal.balanced ? (
                  <Badge variant="outline" className="text-[9px] h-4 text-green-400 border-green-500/30">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Balanced
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-4 text-destructive border-destructive/30">
                    <XCircle className="h-2.5 w-2.5 mr-0.5" /> Off by {Math.abs(bal.debits - bal.credits).toFixed(2)}
                  </Badge>
                )}
                {!readOnly && sections.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeSection(si)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Account</th>
                  <th className="text-right px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-24">Debit</th>
                  <th className="text-right px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-24">Credit</th>
                  {!readOnly && <th className="w-20" />}
                </tr>
              </thead>
              <tbody>
                {section.lines.map((line, li) => {
                  const isEditing = (field: string) =>
                    editingCell?.si === si && editingCell?.li === li && editingCell?.field === field;

                  return (
                    <tr key={li} className="border-b border-border/30 last:border-0 group/row hover:bg-muted/20">
                      {/* Account */}
                      <td className={cn("px-3 py-1", line.indentation_level === 1 && "pl-8")}>
                        {readOnly ? (
                          <span className="text-foreground text-sm">{displayName(line.account_name)}</span>
                        ) : isEditing("account") ? (
                          <Input
                            autoFocus
                            value={line.account_name}
                            onChange={e => updateLine(si, li, { account_name: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={e => e.key === "Enter" && setEditingCell(null)}
                            className="h-6 text-sm p-0 border-0 bg-transparent focus-visible:ring-1"
                          />
                        ) : (
                          <span
                            className="text-foreground text-sm cursor-text hover:bg-muted/40 px-1 -mx-1 rounded"
                            onClick={() => setEditingCell({ si, li, field: "account" })}
                          >
                            {displayName(line.account_name) || <span className="text-muted-foreground italic">Click to edit</span>}
                          </span>
                        )}
                      </td>

                      {/* Debit */}
                      <td className="text-right px-3 py-1">
                        {readOnly ? (
                          <span className="font-mono text-foreground">{line.debit != null ? line.debit.toLocaleString() : ""}</span>
                        ) : isEditing("debit") ? (
                          <Input
                            autoFocus
                            type="number"
                            value={line.debit ?? ""}
                            onChange={e => updateLine(si, li, { debit: e.target.value ? Number(e.target.value) : null })}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={e => e.key === "Enter" && setEditingCell(null)}
                            className="h-6 text-sm p-0 border-0 bg-transparent text-right font-mono focus-visible:ring-1 w-20 ml-auto"
                          />
                        ) : (
                          <span
                            className="font-mono text-foreground cursor-text hover:bg-muted/40 px-1 rounded inline-block min-w-[2rem] text-right"
                            onClick={() => setEditingCell({ si, li, field: "debit" })}
                          >
                            {line.debit != null ? line.debit.toLocaleString() : ""}
                          </span>
                        )}
                      </td>

                      {/* Credit */}
                      <td className="text-right px-3 py-1">
                        {readOnly ? (
                          <span className="font-mono text-foreground">{line.credit != null ? line.credit.toLocaleString() : ""}</span>
                        ) : isEditing("credit") ? (
                          <Input
                            autoFocus
                            type="number"
                            value={line.credit ?? ""}
                            onChange={e => updateLine(si, li, { credit: e.target.value ? Number(e.target.value) : null })}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={e => e.key === "Enter" && setEditingCell(null)}
                            className="h-6 text-sm p-0 border-0 bg-transparent text-right font-mono focus-visible:ring-1 w-20 ml-auto"
                          />
                        ) : (
                          <span
                            className="font-mono text-foreground cursor-text hover:bg-muted/40 px-1 rounded inline-block min-w-[2rem] text-right"
                            onClick={() => setEditingCell({ si, li, field: "credit" })}
                          >
                            {line.credit != null ? line.credit.toLocaleString() : ""}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {!readOnly && (
                        <td className="px-1 py-1">
                          <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => updateLine(si, li, { indentation_level: line.indentation_level === 0 ? 1 : 0 })} title="Toggle indent">
                              <span className="text-[9px] font-mono">⇥</span>
                            </button>
                            <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => moveLine(si, li, -1)} title="Move up">
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => moveLine(si, li, 1)} title="Move down">
                              <ArrowDown className="h-3 w-3" />
                            </button>
                            <button className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => duplicateLine(si, li)} title="Duplicate">
                              <Copy className="h-3 w-3" />
                            </button>
                            <button className="p-0.5 text-muted-foreground hover:text-destructive" onClick={() => removeLine(si, li)} title="Remove">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Total</td>
                  <td className="text-right px-3 py-1 font-mono text-xs font-semibold text-foreground">{bal.debits > 0 ? bal.debits.toLocaleString() : ""}</td>
                  <td className="text-right px-3 py-1 font-mono text-xs font-semibold text-foreground">{bal.credits > 0 ? bal.credits.toLocaleString() : ""}</td>
                  {!readOnly && <td />}
                </tr>
              </tfoot>
            </table>

            {/* Add line button */}
            {!readOnly && (
              <div className="px-3 py-1 border-t border-border/30">
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground" onClick={() => addLine(si)}>
                  <Plus className="h-3 w-3 mr-0.5" /> Add Row
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom actions */}
      {!readOnly && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addSection}>
            <Plus className="h-3 w-3 mr-1" /> Add Entry Section
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleNormalize}>
            <Wand2 className="h-3 w-3 mr-1" /> Normalize
          </Button>
        </div>
      )}
    </div>
  );
}

/** Convert legacy JournalEntryGroup[] to structured JESection[] */
export function groupsToSections(groups: import("@/lib/journalEntryParser").JournalEntryGroup[]): JESection[] {
  return groups.map(g => ({
    entry_date: g.label || "",
    lines: g.lines.map(l => ({
      account_name: l.account,
      debit: l.debit,
      credit: l.credit,
      memo: "",
      indentation_level: (l.side === "credit" ? 1 : 0) as 0 | 1,
    })),
  }));
}

/** Convert JESection[] back to JournalEntryGroup[] for storage */
export function sectionsToGroups(sections: JESection[]): import("@/lib/journalEntryParser").JournalEntryGroup[] {
  return sections.map(s => ({
    label: s.entry_date || "Journal Entry",
    lines: s.lines.map(l => ({
      account: l.account_name,
      debit: l.debit,
      credit: l.credit,
      side: (l.indentation_level === 1 ? "credit" : l.debit != null ? "debit" : l.credit != null ? "credit" : "debit") as "debit" | "credit",
    })),
  }));
}
