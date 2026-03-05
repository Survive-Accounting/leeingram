import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Undo2, Trash2, Copy, FileJson, FileText, ClipboardList, BookOpen, Link2, Lightbulb, TableProperties } from "lucide-react";
import { toast } from "sonner";

type JEEntry = {
  date?: string;
  requirement?: string;
  accounts: { account: string; debit?: number | string; credit?: number | string }[];
};

type TeachingAssetFull = {
  id: string;
  course_id: string;
  chapter_id: string;
  base_raw_problem_id: string | null;
  asset_name: string;
  tags: string[];
  survive_problem_text: string;
  journal_entry_block: string | null;
  survive_solution_text: string;
  difficulty: string | null;
  source_ref: string | null;
  asset_type: string;
  created_at: string;
  updated_at: string;
  journal_entry_completed_json: any;
  journal_entry_template_json: any;
  google_sheet_url?: string | null;
};

type JEMode = "completed" | "template" | "all_question_marks";

interface AssetDetailDrawerProps {
  asset: TeachingAssetFull | null;
  open: boolean;
  onClose: () => void;
  chapterLabel: string;
  sheetUrl?: string;
  onRevert: () => void;
  onDelete: () => void;
}

function parseJEData(json: any): JEEntry[] | null {
  if (!json) return null;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (Array.isArray(data)) return data;
    // Handle parts_json wrapper
    if (data.parts && Array.isArray(data.parts)) {
      const entries: JEEntry[] = [];
      for (const part of data.parts) {
        if (part.journal_entries && Array.isArray(part.journal_entries)) {
          entries.push(...part.journal_entries);
        }
        if (part.entries && Array.isArray(part.entries)) {
          entries.push(...part.entries);
        }
      }
      return entries.length > 0 ? entries : null;
    }
    if (data.journal_entries) return data.journal_entries;
    if (data.entries) return data.entries;
    return null;
  } catch {
    return null;
  }
}

function formatAmount(val: number | string | undefined | null, mode: JEMode): string {
  if (mode === "all_question_marks") return val != null && val !== "" && val !== 0 ? "???" : "";
  if (mode === "template") return val != null && val !== "" && val !== 0 ? "???" : "";
  if (val == null || val === "") return "";
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

function stripDateParens(dateStr: string): string {
  return dateStr.replace(/\s*\(.*?\)\s*$/, "").trim();
}

function JETable({ entries, mode }: { entries: JEEntry[]; mode: JEMode }) {
  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => {
        const label = entry.date ? stripDateParens(entry.date) : entry.requirement || `Entry ${idx + 1}`;
        return (
          <div key={idx} className="border border-border rounded-md overflow-hidden">
            <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-foreground border-b border-border">
              {label}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-3 py-1 w-1/2">Account</th>
                  <th className="text-right px-3 py-1 w-1/4">Debit</th>
                  <th className="text-right px-3 py-1 w-1/4">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(entry.accounts || []).map((acc, aIdx) => {
                  const isCredit = acc.credit != null && acc.credit !== "" && acc.credit !== 0;
                  return (
                    <tr key={aIdx} className="border-b border-border/50 last:border-0">
                      <td className={`px-3 py-1 text-foreground ${isCredit ? "pl-8" : ""}`}>
                        {acc.account}
                      </td>
                      <td className="px-3 py-1 text-right text-foreground font-mono text-xs">
                        {mode === "completed" ? formatAmount(acc.debit, mode) : (acc.debit != null && acc.debit !== "" && acc.debit !== 0 ? "???" : "")}
                      </td>
                      <td className="px-3 py-1 text-right text-foreground font-mono text-xs">
                        {mode === "completed" ? formatAmount(acc.credit, mode) : (acc.credit != null && acc.credit !== "" && acc.credit !== 0 ? "???" : "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function entriesToTSV(entries: JEEntry[], mode: JEMode): string {
  const lines: string[] = [];
  for (const entry of entries) {
    const label = entry.date ? stripDateParens(entry.date) : entry.requirement || "";
    lines.push(label);
    lines.push("Account\tDebit\tCredit");
    for (const acc of entry.accounts || []) {
      const d = mode === "completed" ? formatAmount(acc.debit, mode) : (acc.debit != null && acc.debit !== "" && acc.debit !== 0 ? "???" : "");
      const c = mode === "completed" ? formatAmount(acc.credit, mode) : (acc.credit != null && acc.credit !== "" && acc.credit !== 0 ? "???" : "");
      lines.push(`${acc.account}\t${d}\t${c}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function entriesToPlainText(entries: JEEntry[], mode: JEMode): string {
  const lines: string[] = [];
  for (const entry of entries) {
    const label = entry.date ? stripDateParens(entry.date) : entry.requirement || "";
    if (label) lines.push(label);
    for (const acc of entry.accounts || []) {
      const isCredit = acc.credit != null && acc.credit !== "" && acc.credit !== 0;
      const d = mode === "completed" ? formatAmount(acc.debit, mode) : (acc.debit != null && acc.debit !== "" && acc.debit !== 0 ? "???" : "");
      const c = mode === "completed" ? formatAmount(acc.credit, mode) : (acc.credit != null && acc.credit !== "" && acc.credit !== 0 ? "???" : "");
      const indent = isCredit ? "    " : "";
      const amount = d || c;
      lines.push(`${indent}${acc.account}${amount ? "  " + amount : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export default function AssetDetailDrawer({ asset, open, onClose, chapterLabel, sheetUrl, onRevert, onDelete }: AssetDetailDrawerProps) {
  const [jeMode, setJeMode] = useState<JEMode>("completed");

  if (!asset) return null;

  const completedEntries = parseJEData(asset.journal_entry_completed_json);
  const templateEntries = parseJEData(asset.journal_entry_template_json);
  const activeEntries = jeMode === "completed" ? completedEntries : (templateEntries || completedEntries);
  const hasJE = !!activeEntries && activeEntries.length > 0;

  const handleCopy = (format: "tsv" | "text" | "json") => {
    if (!activeEntries) return;
    let content: string;
    if (format === "json") {
      content = JSON.stringify(activeEntries, null, 2);
    } else if (format === "tsv") {
      content = entriesToTSV(activeEntries, jeMode);
    } else {
      content = entriesToPlainText(activeEntries, jeMode);
    }
    navigator.clipboard.writeText(content);
    toast.success(`Copied as ${format.toUpperCase()}`);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-lg">{asset.asset_name}</SheetTitle>
          <p className="text-xs text-muted-foreground">{chapterLabel}</p>
          {asset.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {asset.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            </div>
          )}
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mb-0 w-fit">
            <TabsTrigger value="overview" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Overview</TabsTrigger>
            <TabsTrigger value="journal" className="text-xs gap-1"><TableProperties className="h-3 w-3" />Journal Entries</TabsTrigger>
            <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="h-3 w-3" />Links</TabsTrigger>
            <TabsTrigger value="future" className="text-xs gap-1"><Lightbulb className="h-3 w-3" />Future</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* Overview */}
            <TabsContent value="overview" className="px-6 pb-6 space-y-4 mt-4">
              <div className="rounded-lg border border-border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem Text</h2>
                <p className="text-sm text-foreground whitespace-pre-wrap">{asset.survive_problem_text || "—"}</p>
              </div>
              {asset.journal_entry_block && (
                <div className="rounded-lg border border-border p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Journal Entry Block</h2>
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">{asset.journal_entry_block}</pre>
                </div>
              )}
              <div className="rounded-lg border border-border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Solution</h2>
                <p className="text-sm text-foreground whitespace-pre-wrap">{asset.survive_solution_text || "—"}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={onRevert}>
                  <Undo2 className="h-3 w-3 mr-1" /> Revert to Generated
                </Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </TabsContent>

            {/* Journal Entries */}
            <TabsContent value="journal" className="px-6 pb-6 space-y-4 mt-4">
              {!hasJE && !completedEntries ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No journal entries for this asset.
                </div>
              ) : (
                <>
                  {/* Mode toggle */}
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant={jeMode === "completed" ? "default" : "outline"} onClick={() => setJeMode("completed")} className="text-xs h-7">
                      Completed
                    </Button>
                    <Button size="sm" variant={jeMode === "template" ? "default" : "outline"} onClick={() => setJeMode("template")} className="text-xs h-7">
                      Template
                    </Button>
                    <Button size="sm" variant={jeMode === "all_question_marks" ? "default" : "outline"} onClick={() => setJeMode("all_question_marks")} className="text-xs h-7">
                      All ???
                    </Button>
                  </div>

                  {/* JE Display */}
                  {activeEntries && <JETable entries={activeEntries} mode={jeMode} />}

                  {/* Copy buttons */}
                  <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCopy("tsv")}>
                      <ClipboardList className="h-3 w-3 mr-1" /> Copy TSV
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCopy("text")}>
                      <FileText className="h-3 w-3 mr-1" /> Copy Plain Text
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCopy("json")}>
                      <FileJson className="h-3 w-3 mr-1" /> Copy JSON
                    </Button>
                  </div>

                  {/* Future auto-inject placeholder */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs h-7 opacity-50" disabled>
                        <Copy className="h-3 w-3 mr-1" /> Insert JE Template into Whiteboard Helper Area
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Coming soon — will auto-write into the non-visible helper block in the asset sheet.
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </TabsContent>

            {/* Links */}
            <TabsContent value="links" className="px-6 pb-6 space-y-3 mt-4">
              {sheetUrl ? (
                <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Link2 className="h-4 w-4" /> Google Sheet
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No linked Google Sheet.</p>
              )}
            </TabsContent>

            {/* Future */}
            <TabsContent value="future" className="px-6 pb-6 mt-4">
              <p className="text-sm text-muted-foreground">Future features will appear here.</p>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
