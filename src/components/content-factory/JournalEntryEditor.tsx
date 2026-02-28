import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Copy, CheckCircle2, XCircle,
  Wand2, ListPlus, ArrowLeftRight, Scissors, PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  chapterId?: string;
  approvedAccounts?: string[];
}

function emptyLine(): JELine {
  return { account_name: "", debit: null, credit: null, memo: "", indentation_level: 0 };
}

function sectionBalance(section: JESection): { debits: number; credits: number; balanced: boolean; diff: number } {
  const debits = section.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credits = section.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const diff = Math.abs(debits - credits);
  return { debits, credits, balanced: diff < 0.02, diff };
}

// ── Account Name Validation ──

function validateAccountName(name: string): string | null {
  if (!name.trim()) return null;
  if (name.includes(":")) return "Colons not allowed — use the memo field for context";
  if (/\$[\d,]+/.test(name)) return "Dollar amounts not allowed in account names";
  if (/^\d+\.\s/.test(name)) return "Numbered list prefixes detected — use Split Row";
  if (/\brequire|must\b/i.test(name)) return "Narrative text detected in account name";
  return null;
}

function isSplittable(name: string): boolean {
  return /\b[a-z]\.\s+/i.test(name) || name.includes(";");
}

function splitAccountName(line: JELine): JELine[] {
  const name = line.account_name;
  const letterParts = name.split(/\b([a-z])\.\s+/i);
  if (letterParts.length > 2) {
    const results: JELine[] = [];
    for (let i = 1; i < letterParts.length; i += 2) {
      const text = (letterParts[i + 1] || "").trim();
      if (!text) continue;
      const amountMatch = text.match(/^(.+?)\s+\$?([\d,]+(?:\.\d+)?)\s*$/);
      if (amountMatch) {
        const accountName = amountMatch[1].trim();
        const amount = parseFloat(amountMatch[2].replace(/,/g, ""));
        const isCredit = line.indentation_level === 1;
        results.push({
          account_name: accountName,
          debit: isCredit ? null : amount,
          credit: isCredit ? amount : null,
          memo: line.memo,
          indentation_level: line.indentation_level,
        });
      } else {
        results.push({ ...line, account_name: text });
      }
    }
    if (results.length > 0) return results;
  }
  const semiParts = name.split(";").map(s => s.trim()).filter(Boolean);
  if (semiParts.length > 1) {
    return semiParts.map(part => ({ ...line, account_name: part }));
  }
  return [line];
}

const ACCOUNT_NORMALIZATIONS: Record<string, string> = {
  "n/p": "Notes Payable",
  "a/p": "Accounts Payable",
  "a/r": "Accounts Receivable",
  "ppd": "Prepaid",
};

// ── Account Autocomplete Component ──

function AccountAutocomplete({
  value,
  onChange,
  onBlur,
  onKeyDown,
  suggestions,
  chapterId,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  suggestions: string[];
  chapterId?: string;
}) {
  const [showDropdown, setShowDropdown] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const qc = useQueryClient();

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  const isNewAccount = value.trim() && !suggestions.some(s => s.toLowerCase() === value.trim().toLowerCase());

  const addToWhitelist = async () => {
    if (!chapterId || !value.trim()) return;
    try {
      await supabase.from("chapter_accounts" as any).insert({
        chapter_id: chapterId,
        account_name: value.trim(),
        source: "user",
        is_approved: true,
      } as any);
      qc.invalidateQueries({ queryKey: ["chapter-accounts", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-accounts-approved", chapterId] });
      toast.success(`"${value.trim()}" added to chapter whitelist`);
    } catch {
      // Unique constraint - already exists
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && filtered.length > 0) {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, -1));
      return;
    }
    if (e.key === "Enter" && selectedIdx >= 0 && filtered[selectedIdx]) {
      e.preventDefault();
      onChange(filtered[selectedIdx]);
      setShowDropdown(false);
      onBlur();
      return;
    }
    onKeyDown(e);
  };

  return (
    <div className="relative">
      <Input
        autoFocus
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
          setSelectedIdx(-1);
        }}
        onBlur={() => {
          setTimeout(() => {
            setShowDropdown(false);
            onBlur();
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        className="h-6 text-sm p-0 border-0 bg-transparent focus-visible:ring-1"
        placeholder="Type account name..."
      />
      {showDropdown && (filtered.length > 0 || isNewAccount) && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-md">
          {filtered.map((s, i) => (
            <button
              key={s}
              className={cn(
                "w-full text-left px-2 py-1 text-xs hover:bg-accent transition-colors",
                i === selectedIdx && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setShowDropdown(false);
                onBlur();
              }}
            >
              {s}
            </button>
          ))}
          {isNewAccount && chapterId && (
            <button
              className="w-full text-left px-2 py-1.5 text-xs border-t border-border text-primary hover:bg-accent/50 flex items-center gap-1"
              onMouseDown={(e) => {
                e.preventDefault();
                addToWhitelist();
                setShowDropdown(false);
                onBlur();
              }}
            >
              <Plus className="h-3 w-3" /> Add "{value.trim()}" to whitelist
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function JournalEntryEditor({ sections, onChange, readOnly = false, courseShort, chapterId, approvedAccounts }: JournalEntryEditorProps) {
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

  // Build combined suggestions from approved accounts prop + aliases + existing accounts in sections
  const accountSuggestions = (() => {
    const set = new Set<string>();
    (approvedAccounts ?? []).forEach(a => set.add(a));
    if (aliases) {
      for (const [_, display] of aliases) set.add(display);
    }
    for (const s of sections) {
      for (const l of s.lines) {
        if (l.account_name.trim()) set.add(l.account_name.trim());
      }
    }
    return Array.from(set).sort();
  })();

  const displayName = useCallback((canonical: string) => {
    return aliases?.get(canonical) ?? canonical;
  }, [aliases]);

  // ── Row operations ──

  const updateLine = (si: number, li: number, patch: Partial<JELine>) => {
    const finalPatch = { ...patch };
    if ("debit" in finalPatch && finalPatch.debit != null && finalPatch.debit !== 0) {
      finalPatch.credit = null;
      finalPatch.indentation_level = 0;
    }
    if ("credit" in finalPatch && finalPatch.credit != null && finalPatch.credit !== 0) {
      finalPatch.debit = null;
      finalPatch.indentation_level = 1;
    }
    const next = sections.map((s, i) =>
      i === si ? { ...s, lines: s.lines.map((l, j) => (j === li ? { ...l, ...finalPatch } : l)) } : s
    );
    onChange(next);
  };

  const addLineAt = (si: number, li: number, position: "above" | "below") => {
    const next = sections.map((s, i) => {
      if (i !== si) return s;
      const newLines = [...s.lines];
      newLines.splice(position === "above" ? li : li + 1, 0, emptyLine());
      return { ...s, lines: newLines };
    });
    onChange(next);
  };

  const addLine = (si: number) => {
    const next = sections.map((s, i) => (i === si ? { ...s, lines: [...s.lines, emptyLine()] } : s));
    onChange(next);
  };

  const removeLine = (si: number, li: number) => {
    const next = sections.map((s, i) => (i === si ? { ...s, lines: s.lines.filter((_, j) => j !== li) } : s));
    onChange(next);
  };

  const moveLine = (si: number, li: number, dir: -1 | 1) => {
    const target = li + dir;
    const s = sections[si];
    if (target < 0 || target >= s.lines.length) return;
    const lines = [...s.lines];
    [lines[li], lines[target]] = [lines[target], lines[li]];
    const next = sections.map((sec, i) => (i === si ? { ...sec, lines } : sec));
    onChange(next);
  };

  const duplicateLine = (si: number, li: number) => {
    const s = sections[si];
    const newLines = [...s.lines];
    newLines.splice(li + 1, 0, { ...s.lines[li] });
    const next = sections.map((sec, i) => (i === si ? { ...sec, lines: newLines } : sec));
    onChange(next);
  };

  const flipSide = (si: number, li: number) => {
    const line = sections[si].lines[li];
    const amount = line.debit ?? line.credit ?? null;
    if (amount == null) return;
    const wasDebit = line.debit != null && line.debit !== 0;
    updateLine(si, li, {
      debit: wasDebit ? null : amount,
      credit: wasDebit ? amount : null,
      indentation_level: wasDebit ? 1 : 0,
    });
  };

  const splitRow = (si: number, li: number) => {
    const line = sections[si].lines[li];
    const splitLines = splitAccountName(line);
    if (splitLines.length <= 1) {
      toast.info("Nothing to split — no a./b. patterns or semicolons found");
      return;
    }
    const next = sections.map((s, i) => {
      if (i !== si) return s;
      const newLines = [...s.lines];
      newLines.splice(li, 1, ...splitLines);
      return { ...s, lines: newLines };
    });
    onChange(next);
    toast.success(`Split into ${splitLines.length} rows`);
  };

  // ── Section operations ──

  const addSection = () => {
    onChange([...sections, { entry_date: "", lines: [emptyLine(), emptyLine()] }]);
  };

  const removeSection = (si: number) => {
    onChange(sections.filter((_, i) => i !== si));
  };

  const updateSectionDate = (si: number, date: string) => {
    const next = sections.map((s, i) => (i === si ? { ...s, entry_date: date } : s));
    onChange(next);
  };

  const addStandardRows = (si: number, template: "bonds" | "revenue" | "blank3") => {
    const templates: Record<string, JELine[]> = {
      bonds: [
        { account_name: "Cash", debit: null, credit: null, memo: "", indentation_level: 0 },
        { account_name: "Discount on Bonds Payable", debit: null, credit: null, memo: "", indentation_level: 0 },
        { account_name: "Bonds Payable", debit: null, credit: null, memo: "", indentation_level: 1 },
      ],
      revenue: [
        { account_name: "Cash", debit: null, credit: null, memo: "", indentation_level: 0 },
        { account_name: "Sales Revenue", debit: null, credit: null, memo: "", indentation_level: 1 },
        { account_name: "Cost of Goods Sold", debit: null, credit: null, memo: "", indentation_level: 0 },
        { account_name: "Inventory", debit: null, credit: null, memo: "", indentation_level: 1 },
      ],
      blank3: [emptyLine(), emptyLine(), emptyLine()],
    };
    const next = sections.map((s, i) => (i === si ? { ...s, lines: [...s.lines, ...templates[template]] } : s));
    onChange(next);
  };

  const handleNormalize = () => {
    const aliasMap = aliases ?? new Map<string, string>();
    const next = sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => {
        let name = l.account_name.trim();
        name = name.replace(
          /^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\s*[-:–]\s*/i,
          ""
        );
        const colonIdx = name.indexOf(":");
        if (colonIdx >= 4) {
          const after = name.slice(colonIdx + 1).trim();
          if (after) name = after;
        }
        name = name.replace(/\s*\$[\d,]+(?:\.\d+)?\s*/g, " ").trim();
        const lower = name.toLowerCase();
        const builtIn = ACCOUNT_NORMALIZATIONS[lower];
        if (builtIn) name = builtIn;
        for (const [key, canonical] of aliasMap) {
          if (lower === key.toLowerCase()) {
            name = canonical;
            break;
          }
        }
        return { ...l, account_name: name };
      }),
    }));
    onChange(next);
  };

  // ── Render ──

  // Group sections by scenario label
  const scenarioPattern = /^((?:Situation|Case|Scenario)\s+(?:\d+|[A-Z]|[IVX]+))\s*[—\-–:]\s*/i;
  type SectionGroup = { scenarioLabel: string | null; sectionIndices: number[] };
  const sectionGroups: SectionGroup[] = [];
  let currentScenario: string | null = null;

  sections.forEach((section, si) => {
    const match = section.entry_date.match(scenarioPattern);
    const label = match ? match[1] : null;
    if (label !== currentScenario || label === null) {
      sectionGroups.push({ scenarioLabel: label, sectionIndices: [si] });
      currentScenario = label;
    } else {
      sectionGroups[sectionGroups.length - 1].sectionIndices.push(si);
    }
  });

  const hasScenarioGroups = sectionGroups.some(g => g.scenarioLabel !== null);

  return (
    <div className="space-y-4">
      {sectionGroups.map((group, gi) => (
        <div key={gi}>
          {hasScenarioGroups && group.scenarioLabel && (
            <div className="flex items-center gap-2 mb-2 mt-1">
              <div className="h-px flex-1 bg-primary/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {group.scenarioLabel}
              </span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
          )}
          <div className="space-y-3">
      {group.sectionIndices.map((si) => {
        const section = sections[si];
        const bal = sectionBalance(section);
        const displayDate = section.entry_date.replace(scenarioPattern, "").trim() || section.entry_date;
        return (
          <div key={si} className="border border-border rounded-lg overflow-hidden">
            {/* Section header */}
            <div className="bg-muted/40 px-3 py-1.5 flex items-center justify-between border-b border-border">
              {readOnly ? (
                <span className="text-xs font-semibold text-foreground">{hasScenarioGroups ? displayDate : (section.entry_date || "Journal Entry")}</span>
              ) : (
                <Input
                  value={section.entry_date}
                  onChange={(e) => updateSectionDate(si, e.target.value)}
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
                    <XCircle className="h-2.5 w-2.5 mr-0.5" /> Off by ${bal.diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <th className="text-left px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Account
                  </th>
                  <th className="text-right px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-28">
                    Debit
                  </th>
                  <th className="text-right px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-28">
                    Credit
                  </th>
                  {!readOnly && <th className="w-28" />}
                </tr>
              </thead>
              <tbody>
                {section.lines.map((line, li) => {
                  const isEditing = (field: string) =>
                    editingCell?.si === si && editingCell?.li === li && editingCell?.field === field;
                  const accountError = !readOnly ? validateAccountName(line.account_name) : null;
                  const canSplit = !readOnly && isSplittable(line.account_name);
                  const whitelistLower = approvedAccounts && approvedAccounts.length > 0
                    ? new Set(approvedAccounts.map(a => a.toLowerCase()))
                    : null;
                  const notInWhitelist = !readOnly && whitelistLower && line.account_name.trim() && !whitelistLower.has(line.account_name.trim().toLowerCase());

                  return (
                    <tr
                      key={li}
                      className={cn(
                        "border-b border-border/30 last:border-0 group/row hover:bg-muted/20",
                        (accountError || notInWhitelist) && "bg-destructive/5"
                      )}
                    >
                      {/* Account */}
                      <td className={cn("px-3 py-1", line.indentation_level === 1 && "pl-8")}>
                        {readOnly ? (
                          <span className="text-foreground text-sm">{displayName(line.account_name)}</span>
                        ) : isEditing("account") ? (
                          <div className="space-y-0.5">
                            <AccountAutocomplete
                              value={line.account_name}
                              onChange={(v) => updateLine(si, li, { account_name: v })}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Tab") {
                                  e.preventDefault();
                                  setEditingCell({ si, li, field: "debit" });
                                }
                              }}
                              suggestions={accountSuggestions}
                              chapterId={chapterId}
                            />
                            {accountError && (
                              <p className="text-[9px] text-destructive">{accountError}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span
                              className="text-foreground text-sm cursor-text hover:bg-muted/40 px-1 -mx-1 rounded flex-1"
                              onClick={() => setEditingCell({ si, li, field: "account" })}
                            >
                              {displayName(line.account_name) || (
                                <span className="text-muted-foreground italic">Click to edit</span>
                              )}
                            </span>
                            {accountError && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-48">
                                  {accountError}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {notInWhitelist && !accountError && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <XCircle className="h-3 w-3 text-amber-400 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-48">
                                  Not in chapter whitelist
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {canSplit && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="p-0.5 text-amber-400 hover:text-amber-300"
                                    onClick={() => splitRow(si, li)}
                                  >
                                    <Scissors className="h-3 w-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Split into separate rows
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Debit — always editable */}
                      <td className="text-right px-3 py-1">
                        {readOnly ? (
                          <span className="font-mono text-foreground">
                            {line.debit != null ? line.debit.toLocaleString() : ""}
                          </span>
                        ) : isEditing("debit") ? (
                          <Input
                            autoFocus
                            type="number"
                            step="any"
                            value={line.debit ?? ""}
                            onChange={(e) =>
                              updateLine(si, li, { debit: e.target.value ? Number(e.target.value) : null })
                            }
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingCell(null);
                              if (e.key === "Tab") {
                                e.preventDefault();
                                setEditingCell({ si, li, field: "credit" });
                              }
                            }}
                            className="h-6 text-sm p-0 border-0 bg-transparent text-right font-mono focus-visible:ring-1 w-24 ml-auto"
                          />
                        ) : (
                          <span
                            className={cn(
                              "font-mono cursor-text hover:bg-muted/40 px-1 rounded inline-block min-w-[3rem] min-h-[1.25rem] text-right",
                              line.debit != null ? "text-foreground" : "text-muted-foreground/30"
                            )}
                            onClick={() => setEditingCell({ si, li, field: "debit" })}
                          >
                            {line.debit != null ? line.debit.toLocaleString() : "—"}
                          </span>
                        )}
                      </td>

                      {/* Credit — always editable */}
                      <td className="text-right px-3 py-1">
                        {readOnly ? (
                          <span className="font-mono text-foreground">
                            {line.credit != null ? line.credit.toLocaleString() : ""}
                          </span>
                        ) : isEditing("credit") ? (
                          <Input
                            autoFocus
                            type="number"
                            step="any"
                            value={line.credit ?? ""}
                            onChange={(e) =>
                              updateLine(si, li, { credit: e.target.value ? Number(e.target.value) : null })
                            }
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingCell(null);
                              if (e.key === "Tab" && !e.shiftKey) {
                                e.preventDefault();
                                if (li + 1 < section.lines.length) {
                                  setEditingCell({ si, li: li + 1, field: "account" });
                                } else {
                                  setEditingCell(null);
                                }
                              }
                            }}
                            className="h-6 text-sm p-0 border-0 bg-transparent text-right font-mono focus-visible:ring-1 w-24 ml-auto"
                          />
                        ) : (
                          <span
                            className={cn(
                              "font-mono cursor-text hover:bg-muted/40 px-1 rounded inline-block min-w-[3rem] min-h-[1.25rem] text-right",
                              line.credit != null ? "text-foreground" : "text-muted-foreground/30"
                            )}
                            onClick={() => setEditingCell({ si, li, field: "credit" })}
                          >
                            {line.credit != null ? line.credit.toLocaleString() : "—"}
                          </span>
                        )}
                      </td>

                      {/* Row Actions */}
                      {!readOnly && (
                        <td className="px-1 py-1">
                          <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity items-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-0.5 text-muted-foreground hover:text-foreground"
                                  onClick={() => flipSide(si, li)}
                                  disabled={line.debit == null && line.credit == null}
                                >
                                  <ArrowLeftRight className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Flip debit↔credit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-0.5 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    updateLine(si, li, {
                                      indentation_level: line.indentation_level === 0 ? 1 : 0,
                                    })
                                  }
                                >
                                  <span className="text-[9px] font-mono">⇥</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Toggle indent</TooltipContent>
                            </Tooltip>
                            <button
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() => moveLine(si, li, -1)}
                              disabled={li === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() => moveLine(si, li, 1)}
                              disabled={li === section.lines.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-0.5 text-muted-foreground hover:text-foreground"
                                  onClick={() => addLineAt(si, li, "above")}
                                >
                                  <PlusCircle className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Add row above</TooltipContent>
                            </Tooltip>
                            <button
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() => duplicateLine(si, li)}
                              title="Duplicate"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              className="p-0.5 text-muted-foreground hover:text-destructive"
                              onClick={() => removeLine(si, li)}
                              title="Delete row"
                            >
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
                  <td className="text-right px-3 py-1 font-mono text-xs font-semibold text-foreground">
                    {bal.debits > 0 ? bal.debits.toLocaleString() : ""}
                  </td>
                  <td className="text-right px-3 py-1 font-mono text-xs font-semibold text-foreground">
                    {bal.credits > 0 ? bal.credits.toLocaleString() : ""}
                  </td>
                  {!readOnly && <td />}
                </tr>
              </tfoot>
            </table>

            {/* Add line button + standard rows */}
            {!readOnly && (
              <div className="px-3 py-1 border-t border-border/30 flex gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground"
                  onClick={() => addLine(si)}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> Add Row
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground"
                  onClick={() => addStandardRows(si, "bonds")}
                >
                  <ListPlus className="h-3 w-3 mr-0.5" /> + Bonds Template
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground"
                  onClick={() => addStandardRows(si, "revenue")}
                >
                  <ListPlus className="h-3 w-3 mr-0.5" /> + Revenue Template
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-muted-foreground"
                  onClick={() => addStandardRows(si, "blank3")}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> + 3 Blank
                </Button>
              </div>
            )}
          </div>
        );
      })}
          </div>
        </div>
      ))}

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
  return groups.map((g) => ({
    entry_date: g.label || "",
    lines: g.lines.map((l) => ({
      account_name: l.account,
      debit: l.debit,
      credit: l.credit,
      memo: "",
      indentation_level: (l.side === "credit" ? 1 : 0) as 0 | 1,
    })),
  }));
}

/** Convert JESection[] back to JournalEntryGroup[] for storage */
export function sectionsToGroups(
  sections: JESection[]
): import("@/lib/journalEntryParser").JournalEntryGroup[] {
  return sections.map((s) => ({
    label: s.entry_date || "Journal Entry",
    lines: s.lines.map((l) => ({
      account: l.account_name,
      debit: l.debit,
      credit: l.credit,
      side: (l.indentation_level === 1
        ? "credit"
        : l.debit != null
          ? "debit"
          : l.credit != null
            ? "credit"
            : "debit") as "debit" | "credit",
    })),
  }));
}
