import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Undo2, Trash2, Copy, FileJson, FileText, ClipboardList, BookOpen, Link2,
  Lightbulb, TableProperties, ExternalLink, ChevronDown, ChevronUp, Video,
  BookMarked, Share2, Clock, Users, BarChart3, CheckCircle2, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────

type JEEntry = {
  date?: string;
  requirement?: string;
  accounts: { account: string; debit?: number | string; credit?: number | string }[];
};

export type TeachingAssetFull = {
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
  times_used?: number;
  sheet_template_version?: string | null;
};

type JEMode = "completed" | "template" | "all_question_marks";

interface AssetDetailDrawerProps {
  asset: TeachingAssetFull | null;
  open: boolean;
  onClose: () => void;
  chapterLabel: string;
  courseLabel: string;
  sheetUrl?: string;
  onRevert: () => void;
  onDelete: () => void;
}

// ── JE Helpers ───────────────────────────────────────────────────────

function parseJEData(json: any): JEEntry[] | null {
  if (!json) return null;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (Array.isArray(data)) return data;
    if (data.parts && Array.isArray(data.parts)) {
      const entries: JEEntry[] = [];
      for (const part of data.parts) {
        if (part.journal_entries && Array.isArray(part.journal_entries)) entries.push(...part.journal_entries);
        if (part.entries && Array.isArray(part.entries)) entries.push(...part.entries);
      }
      return entries.length > 0 ? entries : null;
    }
    if (data.journal_entries) return data.journal_entries;
    if (data.entries) return data.entries;
    return null;
  } catch { return null; }
}

function formatAmount(val: number | string | undefined | null, mode: JEMode): string {
  if (mode !== "completed") return val != null && val !== "" && val !== 0 ? "???" : "";
  if (val == null || val === "") return "";
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

function stripDateParens(dateStr: string): string {
  return dateStr.replace(/\s*\(.*?\)\s*$/, "").trim();
}

function JETable({ entries, mode }: { entries: JEEntry[]; mode: JEMode }) {
  return (
    <div className="space-y-3">
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
                      <td className={`px-3 py-1 text-foreground ${isCredit ? "pl-8" : ""}`}>{acc.account}</td>
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

// ── Derive source type from asset code ───────────────────────────────

function parseAssetCode(code: string) {
  // e.g. INTRO1_CH03_E16.19  or  INTRO1_CH03_BE8.1
  const match = code.match(/^([A-Z0-9]+)_CH(\d+)_([A-Z]+)([\d.]+)$/i);
  if (!match) return { course: "", chapter: "", sourceType: "", sourceNumber: "" };
  return {
    course: match[1],
    chapter: parseInt(match[2], 10).toString(),
    sourceType: match[3], // BE, EX, PR, etc.
    sourceNumber: match[4],
  };
}

// ── Link Card ────────────────────────────────────────────────────────

function LinkCard({ icon: Icon, label, href, onCopy, disabled, comingSoon }: {
  icon: any; label: string; href?: string; onCopy?: () => void; disabled?: boolean; comingSoon?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border border-border ${disabled ? "opacity-40" : "bg-card"}`}>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {comingSoon && <p className="text-[10px] text-muted-foreground">Coming soon</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        {href && !disabled && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
          </Button>
        )}
        {onCopy && !disabled && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Future placeholder item ──────────────────────────────────────────

function FuturePlaceholder({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border opacity-40">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">Coming soon</p>
      </div>
    </div>
  );
}

// ── Main Drawer ──────────────────────────────────────────────────────

export default function AssetDetailDrawer({
  asset, open, onClose, chapterLabel, courseLabel, sheetUrl, onRevert, onDelete,
}: AssetDetailDrawerProps) {
  const [jeMode, setJeMode] = useState<JEMode>("completed");
  const [problemExpanded, setProblemExpanded] = useState(false);

  if (!asset) return null;

  const completedEntries = parseJEData(asset.journal_entry_completed_json);
  const templateEntries = parseJEData(asset.journal_entry_template_json);
  const activeEntries = jeMode === "completed" ? completedEntries : (templateEntries || completedEntries);
  const hasJE = !!activeEntries && activeEntries.length > 0;
  const parsed = parseAssetCode(asset.asset_name);

  const handleCopy = (fmt: "tsv" | "text" | "json") => {
    if (!activeEntries) return;
    let content: string;
    if (fmt === "json") content = JSON.stringify(activeEntries, null, 2);
    else if (fmt === "tsv") content = entriesToTSV(activeEntries, jeMode);
    else content = entriesToPlainText(activeEntries, jeMode);
    navigator.clipboard.writeText(content);
    toast.success(`Copied as ${fmt.toUpperCase()}`);
  };

  // Problem preview: first ~10 lines
  const problemLines = (asset.survive_problem_text || "").split("\n");
  const previewLines = problemLines.slice(0, 10);
  const hasMoreLines = problemLines.length > 10;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* ── Header ─────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold font-mono tracking-tight">{asset.asset_name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {courseLabel} · {chapterLabel} · Created {format(new Date(asset.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {sheetUrl && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                    <a href={sheetUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Open Sheet
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    navigator.clipboard.writeText(sheetUrl);
                    toast.success("Sheet link copied");
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default" className="text-[10px]">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Approved
            </Badge>
            {hasJE && (
              <Badge variant="secondary" className="text-[10px]">
                <TableProperties className="h-2.5 w-2.5 mr-0.5" /> Has JE
              </Badge>
            )}
            {sheetUrl && (
              <Badge variant="secondary" className="text-[10px]">
                <Layers className="h-2.5 w-2.5 mr-0.5" /> Sheet
              </Badge>
            )}
            {asset.sheet_template_version && (
              <Badge variant="outline" className="text-[10px]">
                Tmpl {asset.sheet_template_version}
              </Badge>
            )}
            {asset.tags?.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        </SheetHeader>

        <Separator />

        {/* ── Tabs ────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 mb-0 w-fit">
            <TabsTrigger value="overview" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Overview</TabsTrigger>
            <TabsTrigger value="journal" className="text-xs gap-1"><TableProperties className="h-3 w-3" />Journal Entries</TabsTrigger>
            <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="h-3 w-3" />Links</TabsTrigger>
            <TabsTrigger value="future" className="text-xs gap-1"><Lightbulb className="h-3 w-3" />Future</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* ─── Overview ────────────────────────────────── */}
            <TabsContent value="overview" className="px-6 pb-6 space-y-4 mt-4">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetaItem label="Course" value={parsed.course || courseLabel} />
                <MetaItem label="Chapter" value={parsed.chapter ? `Ch ${parsed.chapter}` : chapterLabel} />
                <MetaItem label="Source Type" value={parsed.sourceType || "—"} />
                <MetaItem label="Source #" value={parsed.sourceNumber || "—"} />
                <MetaItem label="Difficulty" value={asset.difficulty ?? "—"} />
                <MetaItem label="Template Ver." value={asset.sheet_template_version || "—"} />
              </div>

              {/* Problem preview */}
              <div className="rounded-lg border border-border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Problem Text</h2>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {problemExpanded ? asset.survive_problem_text : previewLines.join("\n")}
                </p>
                {hasMoreLines && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 mt-1 text-muted-foreground" onClick={() => setProblemExpanded(!problemExpanded)}>
                    {problemExpanded ? <><ChevronUp className="h-3 w-3 mr-1" /> Collapse</> : <><ChevronDown className="h-3 w-3 mr-1" /> Show all ({problemLines.length} lines)</>}
                  </Button>
                )}
              </div>

              {/* Solution / JE preview */}
              {(asset.journal_entry_block || asset.survive_solution_text) && (
                <div className="rounded-lg border border-border p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Solution / JE Preview</h2>
                  {asset.journal_entry_block && (
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono mb-2">{asset.journal_entry_block}</pre>
                  )}
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-6">{asset.survive_solution_text || "—"}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={onRevert}>
                  <Undo2 className="h-3 w-3 mr-1" /> Revert to Generated
                </Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </TabsContent>

            {/* ─── Journal Entries ─────────────────────────── */}
            <TabsContent value="journal" className="px-6 pb-6 space-y-4 mt-4">
              {!hasJE && !completedEntries ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No journal entries for this asset.
                </div>
              ) : (
                <>
                  <div className="flex gap-1 flex-wrap">
                    {(["completed", "template", "all_question_marks"] as JEMode[]).map((m) => (
                      <Button key={m} size="sm" variant={jeMode === m ? "default" : "outline"} onClick={() => setJeMode(m)} className="text-xs h-7">
                        {m === "completed" ? "Completed" : m === "template" ? "Template" : "All ???"}
                      </Button>
                    ))}
                  </div>

                  {activeEntries && <JETable entries={activeEntries} mode={jeMode} />}

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

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs h-7 opacity-50" disabled>
                        <Copy className="h-3 w-3 mr-1" /> Insert JE Template into Whiteboard Helper Area
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Coming soon — will auto-write into the non-visible helper block in the asset sheet.</TooltipContent>
                  </Tooltip>
                </>
              )}
            </TabsContent>

            {/* ─── Links ──────────────────────────────────── */}
            <TabsContent value="links" className="px-6 pb-6 space-y-3 mt-4">
              <LinkCard
                icon={Layers}
                label="Google Sheet"
                href={sheetUrl}
                onCopy={sheetUrl ? () => { navigator.clipboard.writeText(sheetUrl); toast.success("Copied"); } : undefined}
                disabled={!sheetUrl}
                comingSoon={!sheetUrl}
              />
              <LinkCard icon={Video} label="Walkthrough Video" disabled comingSoon />
              <LinkCard icon={BookMarked} label="LearnWorlds / eBook" disabled comingSoon />
              <LinkCard icon={Share2} label="Share Link" disabled comingSoon />
            </TabsContent>

            {/* ─── Future ─────────────────────────────────── */}
            <TabsContent value="future" className="px-6 pb-6 space-y-3 mt-4">
              <p className="text-xs text-muted-foreground mb-2">These modules will be activated as features are built.</p>
              <FuturePlaceholder icon={Clock} label="Times used in tutoring" />
              <FuturePlaceholder icon={Video} label="Filmed?" />
              <FuturePlaceholder icon={BookMarked} label="Deployed to LearnWorlds?" />
              <FuturePlaceholder icon={Layers} label="Export sets included in" />
              <FuturePlaceholder icon={Users} label="Sessions associated" />
              <FuturePlaceholder icon={Users} label="Students associated" />
              <FuturePlaceholder icon={BarChart3} label="Referral / UTM performance" />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ── Small metadata display ───────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}
