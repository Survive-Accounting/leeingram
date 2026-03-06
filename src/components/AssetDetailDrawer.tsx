import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Undo2, Trash2, Copy, FileJson, FileText, ClipboardList, BookOpen, Link2,
  Lightbulb, TableProperties, ExternalLink, ChevronDown, ChevronUp, Video,
  BookMarked, Share2, Clock, Users, BarChart3, CheckCircle2, Layers,
  AlertTriangle, Check, RefreshCw, Loader2, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────

type JERow = { account_name?: string; account?: string; debit?: number | string | null; credit?: number | string | null; side?: string };
type JEEntryByDate = { date?: string; entry_date?: string; requirement?: string; rows?: JERow[]; accounts?: JERow[] };
type JESection = { label?: string; entries_by_date?: JEEntryByDate[]; journal_entries?: JEEntryByDate[] };
type NormalizedEntry = { label: string; rows: { account: string; debit: number | string | null; credit: number | string | null; side?: "debit" | "credit" }[] };

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
  google_sheet_file_id?: string | null;
  sheet_last_synced_at?: string | null;
  times_used?: number;
  sheet_template_version?: string | null;
  source_type?: string | null;
  source_number?: string | null;
  problem_type?: string | null;
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
  onAssetUpdated?: () => void;
}

// ── Normalize JE data from various formats ──────────────────────────

function applyMode(row: JERow, mode: JEMode): { account: string; debit: number | string | null; credit: number | string | null; side: "debit" | "credit" } {
  const account = row.account_name || row.account || "";
  const rawDebit = row.debit;
  const rawCredit = row.credit;
  const side: "debit" | "credit" = row.side === "credit" ? "credit"
    : row.side === "debit" ? "debit"
    : (rawCredit != null && rawCredit !== "" && rawCredit !== 0) ? "credit" : "debit";

  if (mode === "completed") {
    return { account, debit: rawDebit, credit: rawCredit, side };
  }
  if (mode === "template") {
    return { account, debit: null, credit: null, side };
  }
  // all_question_marks — show ??? on the active side
  return { account, debit: side === "debit" ? "???" : null, credit: side === "credit" ? "???" : null, side };
}

function normalizeJEEntries(json: any, mode: JEMode): NormalizedEntry[] | null {
  if (!json) return null;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;

    const processRows = (rawRows: any[]) => rawRows.map((r: JERow) => applyMode(r, mode));

    // Format 1: scenario_sections (our canonical format)
    if (data.scenario_sections && Array.isArray(data.scenario_sections)) {
      const entries: NormalizedEntry[] = [];
      for (const section of data.scenario_sections as JESection[]) {
        const dateEntries = section.entries_by_date || section.journal_entries || [];
        for (const entry of dateEntries) {
          const dateStr = entry.date || entry.entry_date || entry.requirement || section.label || "";
          const rawRows = entry.rows || entry.accounts || [];
          entries.push({ label: stripDateParens(dateStr), rows: processRows(rawRows) });
        }
      }
      return entries.length > 0 ? entries : null;
    }

    // Format 2: flat array of entries
    if (Array.isArray(data)) {
      return data.map((entry: any, idx: number) => ({
        label: stripDateParens(entry.date || entry.requirement || `Entry ${idx + 1}`),
        rows: processRows(entry.accounts || entry.rows || []),
      }));
    }

    // Format 3: { parts: [...] }
    if (data.parts && Array.isArray(data.parts)) {
      const entries: NormalizedEntry[] = [];
      for (const part of data.parts) {
        for (const entry of (part.journal_entries || part.entries || [])) {
          entries.push({
            label: stripDateParens(entry.date || entry.requirement || ""),
            rows: processRows(entry.accounts || entry.rows || []),
          });
        }
      }
      return entries.length > 0 ? entries : null;
    }

    // Format 4: { journal_entries: [...] } or { entries: [...] }
    const arr = data.journal_entries || data.entries;
    if (Array.isArray(arr)) {
      return arr.map((entry: any, idx: number) => ({
        label: stripDateParens(entry.date || entry.requirement || `Entry ${idx + 1}`),
        rows: processRows(entry.accounts || entry.rows || []),
      }));
    }

    return null;
  } catch { return null; }
}

function formatAmount(val: number | string | null | undefined): string {
  if (val == null || val === "") return "";
  if (val === "???") return "???";
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

function stripDateParens(dateStr: string): string {
  return dateStr.replace(/\s*\(.*?\)\s*$/, "").trim();
}

// ── JE Table Component ──────────────────────────────────────────────

function JETable({ entries }: { entries: NormalizedEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => (
        <div key={idx} className="border border-border rounded-md overflow-hidden">
          <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-foreground border-b border-border">
            {entry.label}
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
              {entry.rows.map((row, rIdx) => {
                const isCredit = row.credit != null && row.credit !== "";
                return (
                  <tr key={rIdx} className="border-b border-border/50 last:border-0">
                    <td className={`px-3 py-1 text-foreground ${isCredit ? "pl-8" : ""}`}>{row.account}</td>
                    <td className="px-3 py-1 text-right text-foreground font-mono text-xs">{formatAmount(row.debit)}</td>
                    <td className="px-3 py-1 text-right text-foreground font-mono text-xs">{formatAmount(row.credit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Export helpers ───────────────────────────────────────────────────

// ── Copy Settings ───────────────────────────────────────────────────

type JECopySettings = { includeDate: boolean; spacerColumns: number };

function loadCopySettings(): JECopySettings {
  try {
    const raw = localStorage.getItem("je_copy_settings");
    if (raw) return { includeDate: true, spacerColumns: 1, ...JSON.parse(raw) };
  } catch {}
  return { includeDate: true, spacerColumns: 1 };
}

function saveCopySettings(s: JECopySettings) {
  localStorage.setItem("je_copy_settings", JSON.stringify(s));
}

/** Format a date label to short M/d/yy for TSV */
function toShortDate(label: string): string {
  try {
    // Try parsing common formats
    const d = new Date(label);
    if (!isNaN(d.getTime())) {
      return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
    }
  } catch {}
  return label;
}

function entriesToTSV(entries: NormalizedEntry[], settings: JECopySettings): string {
  const lines: string[] = [];
  const spacer = "\t".repeat(settings.spacerColumns);
  entries.forEach((entry, idx) => {
    if (idx > 0) lines.push(""); // blank row between groups
    if (settings.includeDate) {
      lines.push(toShortDate(entry.label));
    }
    for (const row of entry.rows) {
      const isCredit = row.side === "credit" || (row.credit != null && row.credit !== "" && (row.debit == null || row.debit === ""));
      const amount = isCredit ? formatAmount(row.credit) : formatAmount(row.debit);
      if (isCredit) {
        // Credit: tab-indented account, spacer, then blank debit + amount in credit col
        lines.push(`\t${row.account}${spacer}\t${amount}`);
      } else {
        // Debit: account, spacer, then amount in debit col
        lines.push(`${row.account}${spacer}${amount}`);
      }
    }
  });
  return lines.join("\n");
}

function entriesToPlainText(entries: NormalizedEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.label) lines.push(entry.label);
    for (const row of entry.rows) {
      const isCredit = row.credit != null && row.credit !== "";
      const indent = isCredit ? "    " : "";
      const amount = formatAmount(row.debit) || formatAmount(row.credit);
      lines.push(`${indent}${row.account}${amount ? "  " + amount : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── Parse asset code ────────────────────────────────────────────────

function parseAssetCode(code: string) {
  const match = code.match(/^([A-Z0-9]+)_CH(\d+)_([A-Z]+)([\d.]+)$/i);
  if (!match) return { course: "", chapter: "", sourceType: "", sourceNumber: "" };
  return { course: match[1], chapter: parseInt(match[2], 10).toString(), sourceType: match[3], sourceNumber: match[4] };
}

// ── Data Health ─────────────────────────────────────────────────────

function DataHealthStrip({ asset, hasJE, sheetUrl }: { asset: TeachingAssetFull; hasJE: boolean; sheetUrl?: string }) {
  const items = [
    { label: "JE", ok: hasJE },
    { label: "Sheet", ok: !!(sheetUrl || asset.google_sheet_url) },
    { label: "Source", ok: !!(asset.source_type || asset.source_number) },
    { label: "Difficulty", ok: !!asset.difficulty },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {item.ok ? <Check className="h-2.5 w-2.5 text-green-500" /> : <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ── Link Card ────────────────────────────────────────────────────────

function LinkCard({ icon: Icon, label, subtitle, href, onCopy, disabled, comingSoon }: {
  icon: any; label: string; subtitle?: string; href?: string; onCopy?: () => void; disabled?: boolean; comingSoon?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border border-border ${disabled ? "opacity-40" : "bg-card"}`}>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {comingSoon && <p className="text-[10px] text-muted-foreground">Coming soon</p>}
        {subtitle && !comingSoon && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
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

// ── Future placeholder ──────────────────────────────────────────────

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

// ── Meta Item ───────────────────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

// ── Main Drawer ──────────────────────────────────────────────────────

export default function AssetDetailDrawer({
  asset, open, onClose, chapterLabel, courseLabel, sheetUrl, onRevert, onDelete, onAssetUpdated,
}: AssetDetailDrawerProps) {
  const [jeMode, setJeMode] = useState<JEMode>("completed");
  const [problemExpanded, setProblemExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copySettings, setCopySettings] = useState<JECopySettings>(loadCopySettings);
  const [showCopySettings, setShowCopySettings] = useState(false);

  const updateCopySettings = (patch: Partial<JECopySettings>) => {
    setCopySettings(prev => {
      const next = { ...prev, ...patch };
      saveCopySettings(next);
      return next;
    });
  };

  const handleResyncSheet = async () => {
    if (!asset) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-asset-sheet", {
        body: {
          asset_id: asset.id,
          asset_code: asset.asset_name,
          course_code: courseLabel,
          chapter_number: chapterLabel.match(/\d+/)?.[0] || "0",
          existing_file_id: asset.google_sheet_file_id || undefined,
          force_new_copy: false,
          problem_text: asset.survive_problem_text,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.is_update ? "Sheet synced successfully" : "New sheet created");
      onAssetUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Sheet sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  // Keyboard: Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!asset) return null;

  // Resolve effective sheet URL: prefer teaching_assets.google_sheet_url, fall back to sheetUrls lookup
  const effectiveSheetUrl = asset.google_sheet_url || sheetUrl;

  // Parse JE with robust format handling
  const activeSource = jeMode === "completed" ? asset.journal_entry_completed_json : (asset.journal_entry_template_json || asset.journal_entry_completed_json);
  const activeEntries = normalizeJEEntries(activeSource, jeMode);
  const hasJE = !!(normalizeJEEntries(asset.journal_entry_completed_json, "completed") || normalizeJEEntries(asset.journal_entry_template_json, "completed"));

  const parsed = parseAssetCode(asset.asset_name);

  const handleCopy = (fmt: "tsv" | "text" | "json") => {
    if (!activeEntries) return;
    let content: string;
    if (fmt === "json") content = JSON.stringify(activeSource, null, 2);
    else if (fmt === "tsv") content = entriesToTSV(activeEntries, copySettings);
    else content = entriesToPlainText(activeEntries);
    navigator.clipboard.writeText(content);
    if (fmt === "tsv") {
      toast.success(`TSV copied with spacer = ${copySettings.spacerColumns} column${copySettings.spacerColumns !== 1 ? "s" : ""}`);
    } else {
      toast.success(`Copied as ${fmt.toUpperCase()}`);
    }
  };

  const problemLines = (asset.survive_problem_text || "").split("\n");
  const previewLines = problemLines.slice(0, 10);
  const hasMoreLines = problemLines.length > 10;

  // Derive display values
  const sourceType = asset.source_type || parsed.sourceType || "—";
  const sourceNumber = asset.source_number || parsed.sourceNumber || "—";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg font-bold font-mono tracking-tight">{asset.asset_name}</SheetTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                  navigator.clipboard.writeText(asset.asset_name);
                  toast.success("Asset code copied");
                }} title="Copy Asset Code">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {courseLabel} · {chapterLabel} · Created {format(new Date(asset.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {effectiveSheetUrl && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                    <a href={effectiveSheetUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Open Sheet
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    navigator.clipboard.writeText(effectiveSheetUrl);
                    toast.success("Sheet link copied");
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Status badges + type chips */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default" className="text-[10px]">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Approved
            </Badge>
            {hasJE && (
              <Badge variant="secondary" className="text-[10px]">
                <TableProperties className="h-2.5 w-2.5 mr-0.5" /> Has JE
              </Badge>
            )}
            {effectiveSheetUrl && (
              <Badge variant="secondary" className="text-[10px]">
                <Layers className="h-2.5 w-2.5 mr-0.5" /> Sheet
              </Badge>
            )}
            {asset.problem_type && (
              <Badge variant="outline" className="text-[10px]">{asset.problem_type}</Badge>
            )}
            {asset.difficulty && (
              <Badge variant="outline" className="text-[10px]">Diff: {asset.difficulty}</Badge>
            )}
            {(sourceType !== "—" || sourceNumber !== "—") && sourceType !== "—" && (
              <Badge variant="outline" className="text-[10px]">{sourceType} {sourceNumber}</Badge>
            )}
            {asset.sheet_template_version && (
              <Badge variant="outline" className="text-[10px]">Tmpl {asset.sheet_template_version}</Badge>
            )}
            {asset.tags?.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
            ))}
          </div>

          {/* Data Health */}
          <DataHealthStrip asset={asset} hasJE={hasJE} sheetUrl={effectiveSheetUrl} />
        </SheetHeader>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 mb-0 w-fit">
            <TabsTrigger value="overview" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Overview</TabsTrigger>
            <TabsTrigger value="journal" className="text-xs gap-1"><TableProperties className="h-3 w-3" />Journal Entries</TabsTrigger>
            <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="h-3 w-3" />Links</TabsTrigger>
            <TabsTrigger value="future" className="text-xs gap-1"><Lightbulb className="h-3 w-3" />Future</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* Overview */}
            <TabsContent value="overview" className="px-6 pb-6 space-y-4 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetaItem label="Course" value={parsed.course || courseLabel} />
                <MetaItem label="Chapter" value={parsed.chapter ? `Ch ${parsed.chapter}` : chapterLabel} />
                <MetaItem label="Source Type" value={sourceType} />
                <MetaItem label="Source #" value={sourceNumber} />
                <MetaItem label="Difficulty" value={asset.difficulty ?? "—"} />
                <MetaItem label="Problem Type" value={asset.problem_type || "—"} />
                <MetaItem label="Template Ver." value={asset.sheet_template_version || "—"} />
              </div>

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

              {(asset.journal_entry_block || asset.survive_solution_text) && (
                <div className="rounded-lg border border-border p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Solution / JE Preview</h2>
                  {asset.journal_entry_block && (
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono mb-2">{asset.journal_entry_block}</pre>
                  )}
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-6">{asset.survive_solution_text || "—"}</p>
                </div>
              )}

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
              {!hasJE ? (
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

                  {activeEntries && <JETable entries={activeEntries} />}

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

            {/* Links */}
            <TabsContent value="links" className="px-6 pb-6 space-y-3 mt-4">
              {effectiveSheetUrl ? (
                <LinkCard
                  icon={Layers}
                  label="Google Sheet"
                  subtitle={asset.google_sheet_file_id ? `File: ${asset.google_sheet_file_id.slice(0, 20)}…` : "Open in Drive"}
                  href={effectiveSheetUrl}
                  onCopy={() => { navigator.clipboard.writeText(effectiveSheetUrl); toast.success("Copied"); }}
                />
              ) : (
                <LinkCard
                  icon={Layers}
                  label="Google Sheet"
                  subtitle="No google_sheet_url stored for this asset."
                  disabled
                  comingSoon
                />
              )}

              {/* Last synced + Resync */}
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[10px] text-muted-foreground">
                  {asset.sheet_last_synced_at
                    ? `Last synced: ${format(new Date(asset.sheet_last_synced_at), "MMM d, yyyy h:mm a")}`
                    : "Never synced"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  disabled={isSyncing}
                  onClick={handleResyncSheet}
                >
                  {isSyncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  {asset.google_sheet_file_id ? "Resync Sheet" : "Create Sheet"}
                </Button>
              </div>

              <LinkCard icon={Video} label="Walkthrough Video" disabled comingSoon />
              <LinkCard icon={BookMarked} label="LearnWorlds / eBook" disabled comingSoon />
              <LinkCard icon={Share2} label="Share Link" disabled comingSoon />
            </TabsContent>

            {/* Future */}
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
