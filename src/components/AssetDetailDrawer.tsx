import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Undo2, Trash2, Copy, ClipboardList, BookOpen, Link2,
  Image, TableProperties, ExternalLink, ChevronDown, ChevronUp, Video,
  BookMarked, Share2, CheckCircle2, Layers, Highlighter,
  AlertTriangle, Check, RefreshCw, Loader2, Settings2, MessageSquare,
  ZoomIn, X, ChevronLeft, ChevronRight, Sparkles, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { HighlightedText, HighlightLegend } from "@/components/content-factory/HighlightedText";
import { type Highlight, HIGHLIGHT_GENERATION_PROMPT, validateHighlights } from "@/lib/highlightTypes";
import { normalizeToParts, isTextPart, isJEPart, formatPartLabel } from "@/lib/variantParts";
import { tAccountToTSV } from "@/components/content-factory/LearningStructuresEditor";

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
  sheet_master_url?: string | null;
  sheet_practice_url?: string | null;
  sheet_promo_url?: string | null;
  sheet_path_url?: string | null;
  times_used?: number;
  sheet_template_version?: string | null;
  source_type?: string | null;
  source_number?: string | null;
  problem_type?: string | null;
  important_formulas?: string | null;
  concept_notes?: string | null;
  exam_traps?: string | null;
};

type JEMode = "completed" | "template" | "accounts_missing" | "all_question_marks";

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
    // Keep side info so indentation works, but null out amounts
    return { account, debit: null, credit: null, side };
  }
  if (mode === "accounts_missing") {
    // Show amounts, hide account names
    return { account: "???", debit: rawDebit, credit: rawCredit, side };
  }
  // all_question_marks — hide both account and amount with ???
  return { account: "???", debit: side === "debit" ? "???" : null, credit: side === "credit" ? "???" : null, side };
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
                // Use the side property for indentation (works even when amounts are null in template mode)
                const isCredit = row.side === "credit" || (row.credit != null && row.credit !== "");
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
    if (idx > 0) lines.push("\t\t\t"); // blank row between groups
    if (settings.includeDate) {
      lines.push(`${toShortDate(entry.label)}\t\t\t`);
    }
    for (const row of entry.rows) {
      const isCredit = row.side === "credit" || (row.credit != null && row.credit !== "" && (row.debit == null || row.debit === ""));
      const amount = isCredit ? formatAmount(row.credit) : formatAmount(row.debit);
      if (isCredit) {
        lines.push(`\t${row.account}${spacer}\t${amount}`);
      } else {
        lines.push(`${row.account}${spacer}\t${amount}\t`);
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

// ── Source Image Gallery ─────────────────────────────────────────────

function SourceImageGallery({ urls, label }: { urls: string[]; label: string }) {
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (urls.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
        {urls.length > 1 && (
          <span className="text-[10px] text-muted-foreground">{current + 1} / {urls.length}</span>
        )}
      </div>
      <div className="relative group rounded-lg border border-border bg-card overflow-hidden">
        <img
          src={urls[current]}
          alt={`${label} ${current + 1}`}
          className="w-full object-contain max-h-[50vh] cursor-zoom-in"
          onClick={() => setZoomed(true)}
        />
        <button
          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setZoomed(true)}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        {urls.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              onClick={() => setCurrent((c) => c - 1)}
              disabled={current === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              onClick={() => setCurrent((c) => c + 1)}
              disabled={current === urls.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 h-12 w-16 rounded border object-cover overflow-hidden transition-all ${
                i === current ? "border-primary ring-1 ring-primary/50" : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-md text-white/70 hover:text-white" onClick={() => setZoomed(false)}>
            <X className="h-5 w-5" />
          </button>
          <img src={urls[current]} alt="" className="max-w-[95vw] max-h-[95vh] object-contain" onClick={(e) => e.stopPropagation()} />
          {urls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); setCurrent((c) => c - 1); }}
                disabled={current === 0}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); setCurrent((c) => c + 1); }}
                disabled={current === urls.length - 1}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}
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
  const [sourceProblem, setSourceProblem] = useState<any>(null);

  // Collapsible section states
  const [showProblemSection, setShowProblemSection] = useState(false);
  const [showAnswerSection, setShowAnswerSection] = useState(false);
  const [showJESection, setShowJESection] = useState(false);
  const [showWorkedSteps, setShowWorkedSteps] = useState(false);
  const [showFormulasSection, setShowFormulasSection] = useState(false);
  const [showConceptsSection, setShowConceptsSection] = useState(false);
  const [showExamTrapsSection, setShowExamTrapsSection] = useState(false);
  const [showStructuresSection, setShowStructuresSection] = useState(false);
  const [showSourceSection, setShowSourceSection] = useState(false);

  // Flag issue
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);

  // Instructions (read-only fetch)
  const [instructions, setInstructions] = useState<{ instruction_number: number; instruction_text: string }[]>([]);

  // Highlights
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlights, setShowHighlights] = useState(false);
  const [generatingHighlights, setGeneratingHighlights] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);

  // Fetch linked source problem for images + title + variant highlights
  useEffect(() => {
    if (!open || !asset?.base_raw_problem_id) {
      setSourceProblem(null);
      setHighlights([]);
      setVariantId(null);
      return;
    }
    // Fetch source problem
    supabase
      .from("chapter_problems")
      .select("title, problem_screenshot_urls, solution_screenshot_urls, problem_screenshot_url, solution_screenshot_url, source_label, problem_text, solution_text")
      .eq("id", asset.base_raw_problem_id)
      .single()
      .then(({ data }) => setSourceProblem(data || null));

    // Fetch approved variant's highlights
    supabase
      .from("problem_variants")
      .select("id, highlight_key_json")
      .eq("base_problem_id", asset.base_raw_problem_id)
      .eq("variant_status", "approved")
      .limit(1)
      .then(({ data }) => {
        const v = data?.[0];
        if (v) {
          setVariantId(v.id);
          const raw = v.highlight_key_json as any;
          if (Array.isArray(raw) && raw.length > 0) {
            setHighlights(validateHighlights(raw, asset.survive_problem_text || ""));
          } else {
            setHighlights([]);
          }
        }
      });
  }, [open, asset?.base_raw_problem_id, asset?.survive_problem_text]);

  // Reset section states when asset changes
  // Fetch instructions for this asset
  useEffect(() => {
    if (!open || !asset?.id) { setInstructions([]); return; }
    supabase
      .from("problem_instructions")
      .select("instruction_number, instruction_text")
      .eq("teaching_asset_id", asset.id)
      .order("instruction_number")
      .then(({ data }) => setInstructions(data || []));
  }, [open, asset?.id]);

  // Reset section states when asset changes
  useEffect(() => {
    setShowProblemSection(false);
    setShowAnswerSection(false);
    setShowJESection(false);
    setShowWorkedSteps(false);
    setShowFormulasSection(false);
    setShowConceptsSection(false);
    setShowExamTrapsSection(false);
    setShowStructuresSection(false);
    setShowSourceSection(false);
    setShowHighlights(false);
    setShowFlagForm(false);
    setFlagReason("");
  }, [asset?.id]);

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
        body: { asset_id: asset.id },
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

  // Parts analysis for collapsible sections (must be before early return for hooks rules)
  const parts = useMemo(() => asset ? normalizeToParts({
    survive_problem_text: asset.survive_problem_text,
    survive_solution_text: asset.survive_solution_text,
    journal_entry_completed_json: asset.journal_entry_completed_json,
    parts_json: (asset as any).parts_json,
  }) : [], [asset]);
  const textParts = useMemo(() => parts.filter(isTextPart), [parts]);
  const jeParts = useMemo(() => parts.filter(isJEPart), [parts]);

  if (!asset) return null;

  // Resolve effective sheet URL: prefer teaching_assets.google_sheet_url, fall back to sheetUrls lookup
  const effectiveSheetUrl = asset.google_sheet_url || sheetUrl;

  // Parse JE with robust format handling
  const activeSource = jeMode === "completed" || jeMode === "accounts_missing"
    ? asset.journal_entry_completed_json
    : (asset.journal_entry_template_json || asset.journal_entry_completed_json);
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

  const handleGenerateHighlights = async () => {
    if (!asset || !variantId) {
      toast.error("No linked variant found for generation");
      return;
    }
    setGeneratingHighlights(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "lovable",
          model: "google/gemini-2.5-flash",
          temperature: 0.15,
          max_output_tokens: 3000,
          source_problem_id: asset.base_raw_problem_id || "unknown",
          messages: [
            {
              role: "system",
              content: `You are an expert accounting instructor. Given a problem text and its solution steps, produce a JSON object with these keys:

1. "highlights" — An array of 6-10 objects marking the most important information a student must notice. Each object: { "text": "<exact substring from problem>", "type": "key_input"|"rate"|"amount"|"timing"|"rule"|"definition" }. Rules: exact case-sensitive substrings only, no narrative filler, focus on inputs used in calculations.

2. "important_formulas" — A concise list of formulas/equations needed to solve this problem. Use one formula per line, e.g. "Interest = Principal × Rate × Time". Only include formulas actually relevant to this specific problem.

3. "concept_notes" — Brief concept notes (2-5 bullet points) explaining the key accounting concepts tested. Write for a student who understands basics but needs reminders.

4. "exam_traps" — 2-4 common mistakes or traps students fall into when solving this type of problem. Be specific and actionable, e.g. "Don't forget to adjust for the partial-year period."

Return valid JSON only.`,
            },
            {
              role: "user",
              content: `Problem Text:\n${asset.survive_problem_text}\n\nSolution Steps:\n${asset.survive_solution_text || "(not provided)"}`,
            },
          ],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const raw = data?.parsed;
      const obj = typeof raw === "object" && raw !== null ? raw : {};

      // Highlights
      const hlArr = Array.isArray(obj) ? obj : (obj.highlights || []);
      const valid = validateHighlights(Array.isArray(hlArr) ? hlArr : [], asset.survive_problem_text || "");
      if (valid.length > 0) {
        await supabase
          .from("problem_variants")
          .update({ highlight_key_json: valid as any } as any)
          .eq("id", variantId);
        setHighlights(valid);
        setShowHighlights(true);
      }

      // Persist new fields to teaching_assets
      const updates: Record<string, string> = {};
      if (obj.important_formulas) updates.important_formulas = typeof obj.important_formulas === "string" ? obj.important_formulas : (Array.isArray(obj.important_formulas) ? obj.important_formulas.join("\n") : String(obj.important_formulas));
      if (obj.concept_notes) updates.concept_notes = typeof obj.concept_notes === "string" ? obj.concept_notes : (Array.isArray(obj.concept_notes) ? obj.concept_notes.join("\n") : String(obj.concept_notes));
      if (obj.exam_traps) updates.exam_traps = typeof obj.exam_traps === "string" ? obj.exam_traps : (Array.isArray(obj.exam_traps) ? obj.exam_traps.join("\n") : String(obj.exam_traps));

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("teaching_assets")
          .update(updates as any)
          .eq("id", asset.id);
        // Update local asset state
        if (updates.important_formulas) (asset as any).important_formulas = updates.important_formulas;
        if (updates.concept_notes) (asset as any).concept_notes = updates.concept_notes;
        if (updates.exam_traps) (asset as any).exam_traps = updates.exam_traps;
      }

      const parts = [
        valid.length > 0 ? `${valid.length} highlights` : null,
        updates.important_formulas ? "formulas" : null,
        updates.concept_notes ? "concepts" : null,
        updates.exam_traps ? "exam traps" : null,
      ].filter(Boolean);
      toast.success(`Generated: ${parts.join(", ") || "content"}`);
      onAssetUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "Generation failed");
    } finally {
      setGeneratingHighlights(false);
    }
  };

  // Derive display values
  const sourceType = asset.source_type || parsed.sourceType || "—";
  const sourceNumber = asset.source_number || parsed.sourceNumber || "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold font-mono tracking-tight">{asset.asset_name}</DialogTitle>
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
              {(asset.sheet_master_url || effectiveSheetUrl) && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                    <a href={asset.sheet_master_url || effectiveSheetUrl!} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Master
                    </a>
                  </Button>
                  {asset.sheet_practice_url && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={asset.sheet_practice_url} target="_blank" rel="noopener noreferrer">
                        Practice
                      </a>
                    </Button>
                  )}
                  {asset.sheet_promo_url && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={asset.sheet_promo_url} target="_blank" rel="noopener noreferrer">
                        Promo
                      </a>
                    </Button>
                  )}
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
        </DialogHeader>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 mb-0 w-fit">
            <TabsTrigger value="overview" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Overview</TabsTrigger>
            <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="h-3 w-3" />Links</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* Overview */}
            <TabsContent value="overview" className="px-6 pb-6 space-y-3 mt-4">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetaItem label="Course" value={parsed.course || courseLabel} />
                <MetaItem label="Chapter" value={parsed.chapter ? `Ch ${parsed.chapter}` : chapterLabel} />
                <MetaItem label="Source Type" value={sourceType} />
                <MetaItem label="Source #" value={sourceNumber} />
                <MetaItem label="Difficulty" value={asset.difficulty ?? "—"} />
                <MetaItem label="Problem Type" value={asset.problem_type || "—"} />
              </div>

              {/* Highlights toggle */}
              <div className="flex items-center gap-2 flex-wrap px-1">
                <Highlighter className="h-3 w-3 text-yellow-500" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Highlights</span>
                <Switch
                  checked={showHighlights}
                  onCheckedChange={setShowHighlights}
                  className="h-4 w-8 [&>span]:h-3 [&>span]:w-3"
                />
                <span className="text-[10px] text-muted-foreground">{showHighlights ? "On" : "Off"}</span>
                {variantId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={handleGenerateHighlights}
                    disabled={generatingHighlights}
                  >
                    {generatingHighlights ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {highlights.length > 0 ? "Regenerate All" : "Generate All"}
                  </Button>
                )}
                {showHighlights && highlights.length > 0 && (
                  <HighlightLegend highlights={highlights} />
                )}
              </div>

              {/* ── PROBLEM TEXT & INSTRUCTIONS ── */}
              <Collapsible open={showProblemSection} onOpenChange={setShowProblemSection}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showProblemSection ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Problem Text & Instructions</span>
                  {instructions.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 ml-auto">{instructions.length} instr.</Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="text-sm text-foreground leading-relaxed">
                      <HighlightedText
                        text={asset.survive_problem_text || "—"}
                        highlights={highlights}
                        showHighlights={showHighlights && highlights.length > 0}
                      />
                    </div>
                  </div>

                  {/* Read-only Instructions with copy buttons */}
                  {instructions.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Instructions</p>
                      {instructions.map((inst, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-primary w-5 shrink-0 text-right">
                            {inst.instruction_number}
                          </span>
                          <p className="text-sm text-foreground flex-1">{inst.instruction_text}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(inst.instruction_text);
                              toast.success(`Instruction ${inst.instruction_number} copied`);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Final Answer values from parts */}
                  {textParts.length > 0 && (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Final Answer</p>
                      <div className="space-y-1.5">
                        {textParts.map((tp, i) => (
                          <div key={i} className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-primary">{formatPartLabel(tp.label)}</span>
                            <span className="text-sm font-medium text-foreground">{tp.final_answer}</span>
                            {tp.final_value != null && (
                              <span className="text-xs font-mono text-muted-foreground">
                                = {typeof tp.final_value === "number" ? tp.final_value.toLocaleString() : tp.final_value}
                                {tp.units ? ` ${tp.units}` : ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── JOURNAL ENTRIES ── */}
              {hasJE && (
              <Collapsible open={showJESection} onOpenChange={setShowJESection}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showJESection ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Journal Entries</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {jeParts.length > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4">{jeParts.length} {jeParts.length === 1 ? "part" : "parts"}</Badge>
                    )}
                  </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {/* Mode selector */}
                    <div className="flex gap-1 flex-wrap">
                      {([
                        { key: "completed", label: "Completed" },
                        { key: "accounts_missing", label: "Acct Titles Missing" },
                        { key: "template", label: "Amounts Missing" },
                        { key: "all_question_marks", label: "Fully Blank" },
                      ] as { key: JEMode; label: string }[]).map((m) => (
                        <Button key={m.key} size="sm" variant={jeMode === m.key ? "default" : "outline"} onClick={() => setJeMode(m.key)} className="text-xs h-7">
                          {m.label}
                        </Button>
                      ))}
                    </div>

                    {/* JE Table */}
                    {jeParts.length > 0 ? (
                      <div className="space-y-2">
                        {jeParts.map((jp, pi) => (
                          <div key={pi} className="rounded border border-border overflow-hidden">
                            {jp.je_structured.map((entry, ei) => {
                              const totalDebit = entry.entries.reduce((s, e) => s + (e.debit ?? 0), 0);
                              const totalCredit = entry.entries.reduce((s, e) => s + (e.credit ?? 0), 0);
                              const balanced = Math.abs(totalDebit - totalCredit) < 0.02;
                              return (
                                <div key={ei}>
                                  <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/50">
                                    <span className="text-[10px] font-medium text-foreground">{entry.date}</span>
                                    <Badge variant="outline" className={`text-[9px] h-3.5 ${balanced ? "text-green-600 dark:text-green-400 border-green-500/30" : "text-red-600 dark:text-red-400 border-red-500/30"}`}>
                                      {balanced ? "✓" : `Off $${Math.abs(totalDebit - totalCredit).toFixed(0)}`}
                                    </Badge>
                                  </div>
                                  <table className="w-full text-[11px]">
                                    <tbody>
                                      {entry.entries.map((row, ri) => (
                                        <tr key={ri} className="border-b border-border/20 last:border-0">
                                          <td className={`px-2 py-0.5 text-foreground ${row.credit && row.credit > 0 ? "pl-5" : ""}`}>
                                            {row.account}
                                          </td>
                                          <td className="text-right px-2 py-0.5 font-mono text-foreground w-16">
                                            {row.debit && row.debit > 0 ? `$${row.debit.toLocaleString()}` : ""}
                                          </td>
                                          <td className="text-right px-2 py-0.5 font-mono text-foreground w-16">
                                            {row.credit && row.credit > 0 ? `$${row.credit.toLocaleString()}` : ""}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : activeEntries ? (
                      <JETable entries={activeEntries} />
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No structured JE data available.</p>
                    )}

                    {/* Copy TSV for each mode */}
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Copy TSV for Sheets</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { key: "completed" as JEMode, label: "Completed" },
                          { key: "accounts_missing" as JEMode, label: "Acct Titles Missing" },
                          { key: "template" as JEMode, label: "Amounts Missing" },
                          { key: "all_question_marks" as JEMode, label: "Fully Blank" },
                        ]).map((m) => (
                          <Button
                            key={m.key}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 justify-start"
                            onClick={() => {
                              const modeEntries = normalizeJEEntries(
                                m.key === "completed" ? asset.journal_entry_completed_json : (asset.journal_entry_template_json || asset.journal_entry_completed_json),
                                m.key
                              );
                              if (!modeEntries) return;
                              const tsv = entriesToTSV(modeEntries, copySettings);
                              navigator.clipboard.writeText(tsv);
                              toast.success(`${m.label} TSV copied`);
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1.5 shrink-0" /> {m.label}
                          </Button>
                        ))}
                      </div>

                      {/* Copy Settings */}
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => setShowCopySettings(!showCopySettings)}>
                          <Settings2 className="h-3 w-3 mr-1" /> Copy Settings
                        </Button>
                      </div>

                      {showCopySettings && (
                        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="include-date"
                              checked={copySettings.includeDate}
                              onCheckedChange={(checked) => updateCopySettings({ includeDate: !!checked })}
                            />
                            <label htmlFor="include-date" className="text-xs text-foreground cursor-pointer">Include Date Row</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-foreground">Spacer Columns:</label>
                            <Select
                              value={String(copySettings.spacerColumns)}
                              onValueChange={(v) => updateCopySettings({ spacerColumns: Number(v) })}
                            >
                              <SelectTrigger className="h-7 w-16 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0</SelectItem>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-[10px] text-muted-foreground">TSV dates use M/d/yy format. Spacers add blank columns between account and amount.</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── WORKED STEPS ── */}
              {asset.survive_solution_text && (
              <Collapsible open={showWorkedSteps} onOpenChange={setShowWorkedSteps}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showWorkedSteps ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Worked Steps</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {asset.survive_solution_text}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── IMPORTANT FORMULAS ── */}
              <Collapsible open={showFormulasSection} onOpenChange={setShowFormulasSection}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showFormulasSection ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Important Formulas</span>
                  {!asset.important_formulas && <Badge variant="outline" className="text-[9px] h-4 ml-auto">Not generated</Badge>}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {asset.important_formulas ? (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{asset.important_formulas}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">Click Generate above to create important formulas.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── CONCEPTS ── */}
              <Collapsible open={showConceptsSection} onOpenChange={setShowConceptsSection}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showConceptsSection ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concepts</span>
                  {!asset.concept_notes && <Badge variant="outline" className="text-[9px] h-4 ml-auto">Not generated</Badge>}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {asset.concept_notes ? (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{asset.concept_notes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">Click Generate above to create concept notes.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── EXAM TRAPS ── */}
              <Collapsible open={showExamTrapsSection} onOpenChange={setShowExamTrapsSection}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showExamTrapsSection ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam Traps</span>
                  {!asset.exam_traps && <Badge variant="outline" className="text-[9px] h-4 ml-auto">Not generated</Badge>}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {asset.exam_traps ? (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{asset.exam_traps}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">Click Generate above to create exam traps.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── T ACCOUNTS ── */}
              {(asset as any).t_accounts_json && Array.isArray((asset as any).t_accounts_json) && (asset as any).t_accounts_json.length > 0 && (
                <Collapsible open={showTAccountsSection} onOpenChange={setShowTAccountsSection}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showTAccountsSection ? "rotate-90" : ""}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">T Accounts</span>
                    <Badge variant="outline" className="text-[9px] h-4 ml-auto">{(asset as any).t_accounts_json.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {((asset as any).t_accounts_json as any[]).map((ta: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground">{ta.account_name || `T Account ${i + 1}`}</p>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                            navigator.clipboard.writeText(tAccountToTSV(ta));
                            toast.success(`T Account "${ta.account_name}" TSV copied`);
                          }}>
                            <Copy className="h-3 w-3 mr-1" /> Copy TSV
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Debits</p>
                            {(ta.debits || []).filter((d: string) => d).map((d: string, di: number) => (
                              <p key={di} className="text-foreground font-mono">{d}</p>
                            ))}
                            {(!ta.debits || ta.debits.filter((d: string) => d).length === 0) && <p className="text-muted-foreground italic">—</p>}
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Credits</p>
                            {(ta.credits || []).filter((c: string) => c).map((c: string, ci: number) => (
                              <p key={ci} className="text-foreground font-mono">{c}</p>
                            ))}
                            {(!ta.credits || ta.credits.filter((c: string) => c).length === 0) && <p className="text-muted-foreground italic">—</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── TABLES ── */}
              {(asset as any).tables_json && Array.isArray((asset as any).tables_json) && (asset as any).tables_json.length > 0 && (
                <Collapsible open={showTablesSection} onOpenChange={setShowTablesSection}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showTablesSection ? "rotate-90" : ""}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tables</span>
                    <Badge variant="outline" className="text-[9px] h-4 ml-auto">{(asset as any).tables_json.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {((asset as any).tables_json as any[]).map((t: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground">{t.title || `Table ${i + 1}`}</p>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                            navigator.clipboard.writeText(t.tsv || "");
                            toast.success(`Table "${t.title}" TSV copied`);
                          }}>
                            <Copy className="h-3 w-3 mr-1" /> Copy TSV
                          </Button>
                        </div>
                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap bg-muted rounded p-2">{t.tsv || "—"}</pre>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── FINANCIAL STATEMENTS ── */}
              {(asset as any).financial_statements_json && Array.isArray((asset as any).financial_statements_json) && (asset as any).financial_statements_json.length > 0 && (
                <Collapsible open={showFSSection} onOpenChange={setShowFSSection}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showFSSection ? "rotate-90" : ""}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial Statements</span>
                    <Badge variant="outline" className="text-[9px] h-4 ml-auto">{(asset as any).financial_statements_json.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {((asset as any).financial_statements_json as any[]).map((s: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground">{s.title || `Statement ${i + 1}`}</p>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                            navigator.clipboard.writeText(s.tsv || "");
                            toast.success(`Statement "${s.title}" TSV copied`);
                          }}>
                            <Copy className="h-3 w-3 mr-1" /> Copy TSV
                          </Button>
                        </div>
                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap bg-muted rounded p-2">{s.tsv || "—"}</pre>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── LEARNING STRUCTURES EDITOR ── */}
              <div className="rounded-lg border border-border bg-card p-3">
                <LearningStructuresEditor
                  assetId={asset.id}
                  usesT={(asset as any).uses_t_accounts || false}
                  usesTables={(asset as any).uses_tables || false}
                  usesFS={(asset as any).uses_financial_statements || false}
                  tAccountsJson={(asset as any).t_accounts_json}
                  tablesJson={(asset as any).tables_json}
                  financialStatementsJson={(asset as any).financial_statements_json}
                  onUpdated={onAssetUpdated}
                />
              </div>

              {/* ── SOURCE (from import) ── */}
              <Collapsible open={showSourceSection} onOpenChange={setShowSourceSection}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 border-b border-border cursor-pointer">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showSourceSection ? "rotate-90" : ""}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-4">
                  {(() => {
                    const pUrls = sourceProblem?.problem_screenshot_urls?.length
                      ? sourceProblem.problem_screenshot_urls
                      : sourceProblem?.problem_screenshot_url
                        ? [sourceProblem.problem_screenshot_url]
                        : [];
                    const sUrls = sourceProblem?.solution_screenshot_urls?.length
                      ? sourceProblem.solution_screenshot_urls
                      : sourceProblem?.solution_screenshot_url
                        ? [sourceProblem.solution_screenshot_url]
                        : [];
                    if (pUrls.length === 0 && sUrls.length === 0 && !sourceProblem?.problem_text && !sourceProblem?.solution_text && !sourceProblem?.title) {
                      return <p className="text-sm text-muted-foreground text-center py-4">No source data available.</p>;
                    }
                    return (
                      <div className="space-y-5">
                        {sourceProblem?.title && (
                          <div className="rounded-md border border-border p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source Title</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{sourceProblem.title}</p>
                          </div>
                        )}

                        {/* Problem Screenshot + Copy Text */}
                        {pUrls.length > 0 && <SourceImageGallery urls={pUrls} label="Source Problem Screenshot" />}
                        {sourceProblem?.problem_text && (
                          <div className="rounded-lg border border-border bg-background p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Problem Text (OCR)</p>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                                navigator.clipboard.writeText(sourceProblem.problem_text);
                                toast.success("Problem text copied");
                              }}>
                                <Copy className="h-3 w-3 mr-1" /> Copy Text
                              </Button>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{sourceProblem.problem_text}</p>
                          </div>
                        )}

                        {/* Solution Screenshot + Copy Text */}
                        {sUrls.length > 0 && <SourceImageGallery urls={sUrls} label="Source Solution Screenshot" />}
                        {sourceProblem?.solution_text && (
                          <div className="rounded-lg border border-border bg-background p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Solution Text (OCR)</p>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                                navigator.clipboard.writeText(sourceProblem.solution_text);
                                toast.success("Solution text copied");
                              }}>
                                <Copy className="h-3 w-3 mr-1" /> Copy Text
                              </Button>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{sourceProblem.solution_text}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CollapsibleContent>
              </Collapsible>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={onRevert}>
                  <Undo2 className="h-3 w-3 mr-1" /> Revert to Generated
                </Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </TabsContent>

            {/* Links */}
            <TabsContent value="links" className="px-6 pb-6 space-y-3 mt-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Sheets</h3>
                <LinkCard
                  icon={Layers}
                  label="Master Sheet"
                  subtitle={asset.sheet_master_url ? "Open in Drive" : "Not created yet"}
                  href={asset.sheet_master_url || effectiveSheetUrl || undefined}
                  onCopy={asset.sheet_master_url || effectiveSheetUrl ? () => { navigator.clipboard.writeText((asset.sheet_master_url || effectiveSheetUrl)!); toast.success("Copied"); } : undefined}
                  disabled={!asset.sheet_master_url && !effectiveSheetUrl}
                />
                <LinkCard
                  icon={Layers}
                  label="Practice Sheet"
                  subtitle={asset.sheet_practice_url ? "Open in Drive" : "Not created yet"}
                  href={asset.sheet_practice_url || undefined}
                  onCopy={asset.sheet_practice_url ? () => { navigator.clipboard.writeText(asset.sheet_practice_url!); toast.success("Copied"); } : undefined}
                  disabled={!asset.sheet_practice_url}
                />
                <LinkCard
                  icon={Layers}
                  label="Promo Sheet"
                  subtitle={asset.sheet_promo_url ? "Open in Drive" : "Not created yet"}
                  href={asset.sheet_promo_url || undefined}
                  onCopy={asset.sheet_promo_url ? () => { navigator.clipboard.writeText(asset.sheet_promo_url!); toast.success("Copied"); } : undefined}
                  disabled={!asset.sheet_promo_url}
                />
                {asset.sheet_path_url && (
                  <LinkCard
                    icon={ExternalLink}
                    label="Chapter Folder"
                    subtitle="Open Drive folder"
                    href={asset.sheet_path_url}
                  />
                )}
              </div>

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

              <Separator className="my-2" />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Asset Actions</h3>
                <div className="space-y-1.5">
                  <a href="https://forms.gle/QnWFjHKc1DxaGVjMA" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Report Issue</p>
                      <p className="text-[10px] text-muted-foreground">Something looks incorrect in a sheet or asset</p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                  <a href="https://forms.gle/7Dz2i8eKiRangmNs9" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Mark Sheet Prep Complete</p>
                      <p className="text-[10px] text-muted-foreground">Finished organizing and preparing this sheet</p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                  <a href="https://forms.gle/QLCMqsV1YZMbkfSD8" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Submit Feedback / Idea</p>
                      <p className="text-[10px] text-muted-foreground">Suggestions for improving the workflow</p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 px-1">
                  Asset code: <span className="font-mono font-medium text-foreground">{asset.asset_name}</span>
                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1 inline-flex" onClick={() => {
                    navigator.clipboard.writeText(asset.asset_name);
                    toast.success("Asset code copied");
                  }}>
                    <Copy className="h-2.5 w-2.5" />
                  </Button>
                </p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
