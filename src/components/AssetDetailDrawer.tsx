import { useState, useEffect, useMemo } from "react";
import { Tip } from "@/components/Tip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Undo2, Trash2, Copy, BookOpen, Link2,
  ExternalLink, ChevronRight, Video,
  BookMarked, Share2, Layers,
  AlertTriangle, RefreshCw, Loader2, Settings2, MessageSquare,
  ZoomIn, X, ChevronLeft, ChevronRight as ChevronRightIcon, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { HighlightedText } from "@/components/content-factory/HighlightedText";
import { type Highlight, validateHighlights } from "@/lib/highlightTypes";
import { normalizeToParts, isTextPart, isJEPart, formatPartLabel } from "@/lib/variantParts";
import { tAccountToTSV } from "@/components/content-factory/LearningStructuresEditor";
import SmartTextRenderer from "@/components/SmartTextRenderer";

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
  test_slide_id?: string | null;
  test_slide_url?: string | null;
  times_used?: number;
  sheet_template_version?: string | null;
  source_type?: string | null;
  source_number?: string | null;
  problem_type?: string | null;
  important_formulas?: string | null;
  concept_notes?: string | null;
  exam_traps?: string | null;
  google_sheet_status?: string | null;
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
  isAdmin?: boolean;
}

// ── Normalize JE data from various formats ──────────────────────────

function applyMode(row: JERow, mode: JEMode): { account: string; debit: number | string | null; credit: number | string | null; side: "debit" | "credit" } {
  const account = row.account_name || row.account || "";
  const rawDebit = row.debit;
  const rawCredit = row.credit;
  const side: "debit" | "credit" = row.side === "credit" ? "credit"
    : row.side === "debit" ? "debit"
    : (rawCredit != null && rawCredit !== "" && rawCredit !== 0) ? "credit" : "debit";

  if (mode === "completed") return { account, debit: rawDebit, credit: rawCredit, side };
  if (mode === "template") return { account, debit: null, credit: null, side };
  if (mode === "accounts_missing") return { account: "???", debit: rawDebit, credit: rawCredit, side };
  return { account: "???", debit: side === "debit" ? "???" : null, credit: side === "credit" ? "???" : null, side };
}

function normalizeJEEntries(json: any, mode: JEMode): NormalizedEntry[] | null {
  if (!json) return null;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    const processRows = (rawRows: any[]) => rawRows.map((r: JERow) => applyMode(r, mode));

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
    if (Array.isArray(data)) {
      return data.map((entry: any, idx: number) => ({
        label: stripDateParens(entry.date || entry.requirement || `Entry ${idx + 1}`),
        rows: processRows(entry.accounts || entry.rows || []),
      }));
    }
    if (data.parts && Array.isArray(data.parts)) {
      const entries: NormalizedEntry[] = [];
      for (const part of data.parts) {
        for (const entry of (part.journal_entries || part.entries || [])) {
          entries.push({ label: stripDateParens(entry.date || entry.requirement || ""), rows: processRows(entry.accounts || entry.rows || []) });
        }
      }
      return entries.length > 0 ? entries : null;
    }
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

type JECopySettings = { includeDate: boolean; spacerColumns: number };

function loadCopySettings(): JECopySettings {
  try {
    const raw = localStorage.getItem("je_copy_settings");
    if (raw) return { includeDate: true, spacerColumns: 2, ...JSON.parse(raw) };
  } catch {}
  return { includeDate: true, spacerColumns: 2 };
}

function saveCopySettings(s: JECopySettings) {
  localStorage.setItem("je_copy_settings", JSON.stringify(s));
}

function toShortDate(label: string): string {
  try {
    const d = new Date(label);
    if (!isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  } catch {}
  return label;
}

function entriesToTSV(entries: NormalizedEntry[], settings: JECopySettings): string {
  const lines: string[] = [];
  const spacer = "\t".repeat(settings.spacerColumns);
  entries.forEach((entry, idx) => {
    if (idx > 0) lines.push("\t\t\t");
    if (settings.includeDate) lines.push(`${toShortDate(entry.label)}\t\t\t`);
    for (const row of entry.rows) {
      const isCredit = row.side === "credit" || (row.credit != null && row.credit !== "" && (row.debit == null || row.debit === ""));
      const amount = isCredit ? formatAmount(row.credit) : formatAmount(row.debit);
      if (isCredit) lines.push(`\t${row.account}${spacer}\t${amount}`);
      else lines.push(`${row.account}${spacer}\t${amount}\t`);
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

// ── Phase 2 Status Pill ─────────────────────────────────────────────

function Phase2Pill({ label, status }: { label: string; status: string }) {
  const dot = status === "complete"
    ? "bg-emerald-400"
    : status === "in_progress"
    ? "bg-blue-400"
    : "bg-muted-foreground/40";

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
      {status === "complete" ? (
        <svg className="h-2 w-2 text-emerald-400" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ) : (
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      )}
      {label}
    </span>
  );
}

function RankPill({ rank }: { rank: number | null }) {
  const colors: Record<number, string> = {
    1: "text-amber-300 border-amber-500/40",
    2: "text-muted-foreground border-border",
    3: "text-muted-foreground/60 border-border/50",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium ${rank ? colors[rank] || "" : "text-muted-foreground border-border"}`}>
      {rank ? `R${rank}` : "—"}
    </span>
  );
}

// ── Pipeline Status Banner ──────────────────────────────────────────

function PipelineStatusBanner({ asset }: { asset: TeachingAssetFull }) {
  const status = (asset as any).google_sheet_status || "none";
  const isApproved = !!(asset as any).asset_approved_at;

  const config: Record<string, { label: string; bg: string; text: string }> = {
    none: { label: isApproved ? "Approved — Ready for Phase 2" : "Approved — Waiting for Sheet Creation", bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
    created: { label: "Master Sheet Created — Awaiting Sheet Prep", bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
    verified_by_va: { label: "Master Sheet Ready for Review", bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-300" },
    finalized: { label: "Master Sheet Finalized — Ready for Deployment", bg: "bg-green-500/15", text: "text-green-700 dark:text-green-300" },
  };

  const c = config[status] || config.none;

  return (
    <div className={`rounded-lg px-4 py-3 ${c.bg}`}>
      <p className={`text-sm font-semibold ${c.text}`}>{c.label}</p>
      {isApproved && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <RankPill rank={(asset as any).core_rank ?? null} />
          <Tip label="Whiteboard"><Phase2Pill label="WB" status={(asset as any).whiteboard_status || "not_started"} /></Tip>
          <Tip label="Video"><Phase2Pill label="Vid" status={(asset as any).video_production_status || "not_started"} /></Tip>
          <Tip label="Multiple Choice"><Phase2Pill label="MC" status={(asset as any).mc_status || "not_started"} /></Tip>
          <Tip label="Ebook"><Phase2Pill label="EB" status={(asset as any).ebook_status || "not_started"} /></Tip>
          <Tip label="Quality Assurance"><Phase2Pill label="QA" status={(asset as any).qa_status || "not_started"} /></Tip>
          <Tip label="Deployment"><Phase2Pill label="Dep" status={(asset as any).deployment_status || "not_started"} /></Tip>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1.5">
        Updated {format(new Date(asset.updated_at), "MMM d, yyyy")}
      </p>
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
              <ChevronRightIcon className="h-4 w-4" />
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
                <ChevronRightIcon className="h-6 w-6" />
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

// ── Section Header (improved hierarchy) ─────────────────────────────

function SectionHeader({ label, open, copyText }: { label: string; open: boolean; copyText?: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      <span className="text-sm font-bold tracking-tight text-foreground">{label}</span>
      {copyText && (
        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto shrink-0" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(copyText); toast.success(`${label} copied`); }}>
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ── Main Drawer ──────────────────────────────────────────────────────

export default function AssetDetailDrawer({
  asset, open, onClose, chapterLabel, courseLabel, sheetUrl, onRevert, onDelete, onAssetUpdated, isAdmin,
}: AssetDetailDrawerProps) {
  const [jeMode, setJeMode] = useState<JEMode>("completed");
  const [isSyncing, setIsSyncing] = useState(false);
  const [copySettings, setCopySettings] = useState<JECopySettings>(loadCopySettings);
  const [showCopySettings, setShowCopySettings] = useState(false);
  const [sourceProblem, setSourceProblem] = useState<any>(null);
  const queryClient = useQueryClient();

  // Issue reports for this asset
  const { data: issueReports = [] } = useQuery({
    queryKey: ["asset-issue-reports", asset?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_issue_reports")
        .select("*")
        .eq("teaching_asset_id", asset!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!asset?.id,
  });
  const issueCount = issueReports.length;

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

  // Instructions
  const [instructions, setInstructions] = useState<{ instruction_number: number; instruction_text: string }[]>([]);

  // Highlights (kept for HighlightedText rendering but controls removed)
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlights, setShowHighlights] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !asset?.base_raw_problem_id) {
      setSourceProblem(null);
      setHighlights([]);
      setVariantId(null);
      return;
    }
    supabase
      .from("chapter_problems")
      .select("title, problem_screenshot_urls, solution_screenshot_urls, problem_screenshot_url, solution_screenshot_url, source_label, problem_text, solution_text")
      .eq("id", asset.base_raw_problem_id)
      .single()
      .then(({ data }) => setSourceProblem(data || null));

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
            setShowHighlights(true);
          } else {
            setHighlights([]);
          }
        }
      });
  }, [open, asset?.base_raw_problem_id, asset?.survive_problem_text]);

  useEffect(() => {
    if (!open || !asset?.id) { setInstructions([]); return; }
    supabase
      .from("problem_instructions")
      .select("instruction_number, instruction_text")
      .eq("teaching_asset_id", asset.id)
      .order("instruction_number")
      .then(({ data }) => setInstructions(data || []));
  }, [open, asset?.id]);

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const parts = useMemo(() => asset ? normalizeToParts({
    survive_problem_text: asset.survive_problem_text,
    survive_solution_text: asset.survive_solution_text,
    journal_entry_completed_json: asset.journal_entry_completed_json,
    parts_json: (asset as any).parts_json,
  }) : [], [asset]);
  const textParts = useMemo(() => parts.filter(isTextPart), [parts]);
  const jeParts = useMemo(() => parts.filter(isJEPart), [parts]);

  if (!asset) return null;

  const effectiveSheetUrl = asset.google_sheet_url || sheetUrl;
  const activeSource = jeMode === "completed" || jeMode === "accounts_missing"
    ? asset.journal_entry_completed_json
    : (asset.journal_entry_template_json || asset.journal_entry_completed_json);
  const activeEntries = normalizeJEEntries(activeSource, jeMode);
  const hasJE = !!(normalizeJEEntries(asset.journal_entry_completed_json, "completed") || normalizeJEEntries(asset.journal_entry_template_json, "completed"));

  const parsed = parseAssetCode(asset.asset_name);
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
              <p className="text-xs text-muted-foreground mt-1">
                {courseLabel} · {chapterLabel}
              </p>
              {sourceProblem?.title && (
                <p className="text-xs text-muted-foreground">
                  {asset.source_ref || sourceNumber} — {sourceProblem.title}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Created {format(new Date(asset.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {(asset.sheet_master_url || effectiveSheetUrl) && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                    <a href={asset.sheet_master_url || effectiveSheetUrl!} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Open Master Sheet
                    </a>
                  </Button>
                  {asset.sheet_practice_url && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <a href={asset.sheet_practice_url} target="_blank" rel="noopener noreferrer">
                        Practice
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Pipeline Status Banner */}
          <PipelineStatusBanner asset={asset} />
        </DialogHeader>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 mb-0 w-fit">
            <TabsTrigger value="overview" className="text-xs gap-1"><BookOpen className="h-3 w-3" />Overview</TabsTrigger>
            <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="h-3 w-3" />Links</TabsTrigger>
            <TabsTrigger value="issues" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Issues{issueCount > 0 ? ` (${issueCount})` : ""}</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            {/* Overview */}
            <TabsContent value="overview" className="px-6 pb-6 space-y-4 mt-4">
              {/* Simplified metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetaItem label="Course" value={parsed.course || courseLabel} />
                <MetaItem label="Chapter" value={parsed.chapter ? `Ch ${parsed.chapter}` : chapterLabel} />
                <MetaItem label="Source #" value={sourceNumber} />
                <MetaItem label="Problem Type" value={asset.problem_type || "—"} />
              </div>

              {/* ── PROBLEM TEXT & INSTRUCTIONS ── */}
              <Collapsible open={showProblemSection} onOpenChange={setShowProblemSection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Problem Text & Instructions" open={showProblemSection} copyText={asset.survive_problem_text} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {highlights.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="highlight-toggle"
                        checked={showHighlights}
                        onCheckedChange={setShowHighlights}
                      />
                      <label htmlFor="highlight-toggle" className="text-xs text-muted-foreground cursor-pointer">
                        Show highlights
                      </label>
                    </div>
                  )}
                  <div className="rounded-lg border border-border bg-background p-4">
                    <SmartTextRenderer
                      text={asset.survive_problem_text || "—"}
                      highlightedTextProps={
                        highlights.length > 0
                          ? { highlights, showHighlights: showHighlights && highlights.length > 0 }
                          : undefined
                      }
                    />
                  </div>

                  {instructions.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instructions</p>
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

                  {textParts.length > 0 && (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Final Answer</p>
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

              {/* ── ANSWER TEXT ── */}
              {asset.survive_solution_text && (
              <Collapsible open={showAnswerSection} onOpenChange={setShowAnswerSection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Answer Text" open={showAnswerSection} copyText={asset.survive_solution_text} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <SmartTextRenderer text={asset.survive_solution_text} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              )}

              {/* ── JOURNAL ENTRIES ── */}
              {hasJE && (
              <Collapsible open={showJESection} onOpenChange={setShowJESection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Journal Entries" open={showJESection} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
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

                  {jeParts.length > 0 ? (
                    <div className="space-y-2">
                      {jeParts.map((jp, pi) => (
                        <div key={pi} className="rounded border border-border overflow-hidden">
                          {jp.je_structured.map((entry, ei) => {
                            const modeRows = entry.entries.map((row) => applyMode({
                              account: row.account,
                              debit: row.debit,
                              credit: row.credit,
                              side: row.credit && row.credit > 0 ? "credit" : "debit",
                            }, jeMode));
                            const totalDebit = entry.entries.reduce((s, e) => s + (e.debit ?? 0), 0);
                            const totalCredit = entry.entries.reduce((s, e) => s + (e.credit ?? 0), 0);
                            const balanced = Math.abs(totalDebit - totalCredit) < 0.02;
                            return (
                              <div key={ei}>
                                <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/50">
                                  <span className="text-[10px] font-medium text-foreground">{entry.date}</span>
                                  {jeMode === "completed" && (
                                    <Badge variant="outline" className={`text-[9px] h-3.5 ${balanced ? "text-green-600 dark:text-green-400 border-green-500/30" : "text-red-600 dark:text-red-400 border-red-500/30"}`}>
                                      {balanced ? "✓" : `Off $${Math.abs(totalDebit - totalCredit).toFixed(0)}`}
                                    </Badge>
                                  )}
                                </div>
                                <table className="w-full text-[11px]">
                                  <tbody>
                                    {modeRows.map((row, ri) => (
                                      <tr key={ri} className="border-b border-border/20 last:border-0">
                                        <td className={`px-2 py-0.5 text-foreground ${row.side === "credit" ? "pl-5" : ""}`}>
                                          {row.account}
                                        </td>
                                        <td className="text-right px-2 py-0.5 font-mono text-foreground w-16">
                                          {row.debit != null && row.debit !== "" ? (typeof row.debit === "number" ? `$${row.debit.toLocaleString()}` : row.debit) : ""}
                                        </td>
                                        <td className="text-right px-2 py-0.5 font-mono text-foreground w-16">
                                          {row.credit != null && row.credit !== "" ? (typeof row.credit === "number" ? `$${row.credit.toLocaleString()}` : row.credit) : ""}
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

                  {/* Copy TSV */}
                  <div className="pt-2 border-t border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy TSV for Sheets</p>
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
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Worked Steps" open={showWorkedSteps} copyText={asset.survive_solution_text} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <SmartTextRenderer text={asset.survive_solution_text} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
              )}

              {/* ── IMPORTANT FORMULAS ── */}
              <Collapsible open={showFormulasSection} onOpenChange={setShowFormulasSection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Important Formulas" open={showFormulasSection} copyText={asset.important_formulas || undefined} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {asset.important_formulas ? (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{asset.important_formulas}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No formulas available.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── CONCEPTS ── */}
              <Collapsible open={showConceptsSection} onOpenChange={setShowConceptsSection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Concepts" open={showConceptsSection} copyText={asset.concept_notes || undefined} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {asset.concept_notes ? (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{asset.concept_notes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No concept notes available.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── EXAM TRAPS ── */}
              <Collapsible open={showExamTrapsSection} onOpenChange={setShowExamTrapsSection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Exam Traps" open={showExamTrapsSection} copyText={asset.exam_traps || undefined} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {asset.exam_traps ? (
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{asset.exam_traps}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No exam traps available.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ── OPTIONAL LEARNING STRUCTURES (consolidated) ── */}
              {(() => {
                const tAccounts = (asset as any).t_accounts_json && Array.isArray((asset as any).t_accounts_json) ? (asset as any).t_accounts_json : [];
                const tables = (asset as any).tables_json && Array.isArray((asset as any).tables_json) ? (asset as any).tables_json : [];
                const fs = (asset as any).financial_statements_json && Array.isArray((asset as any).financial_statements_json) ? (asset as any).financial_statements_json : [];
                const hasAnyStructures = tAccounts.length > 0 || tables.length > 0 || fs.length > 0;
                if (!hasAnyStructures) return null;
                return (
                  <Collapsible open={showStructuresSection} onOpenChange={setShowStructuresSection}>
                    <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                      <SectionHeader label="Learning Structures" open={showStructuresSection} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-4">
                      {tAccounts.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">T Accounts</p>
                          {tAccounts.map((ta: any, i: number) => (
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
                        </div>
                      )}
                      {tables.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tables</p>
                          {tables.map((t: any, i: number) => (
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
                        </div>
                      )}
                      {fs.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial Statements</p>
                          {fs.map((s: any, i: number) => (
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
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })()}

              {/* ── SOURCE (from import) ── */}
              <Collapsible open={showSourceSection} onOpenChange={setShowSourceSection}>
                <CollapsibleTrigger className="w-full py-3 border-b border-border cursor-pointer">
                  <SectionHeader label="Source" open={showSourceSection} />
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
                    const assetSolUrl = (asset as any).solution_screenshot_url;
                    const effectiveSolUrls = sUrls.length > 0 ? sUrls : (assetSolUrl ? [assetSolUrl] : []);

                    if (pUrls.length === 0 && effectiveSolUrls.length === 0 && !sourceProblem?.problem_text && !sourceProblem?.solution_text && !sourceProblem?.title) {
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
                        {effectiveSolUrls.length > 0 && <SourceImageGallery urls={effectiveSolUrls} label="Source Solution Screenshot" />}
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

              {/* ── DANGER ZONE ── */}
              <div className="mt-6 pt-4 border-t-2 border-destructive/20 space-y-3">
                <p className="text-xs font-bold text-destructive uppercase tracking-wider">Danger Zone</p>
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                  {/* Flag Issue */}
                  {!showFlagForm ? (
                    <Button size="sm" variant="outline" className="text-xs w-full justify-start border-border" onClick={() => setShowFlagForm(true)}>
                      <Flag className="h-3 w-3 mr-2" /> Flag Issue
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flag Reason</p>
                      <Textarea
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        placeholder="Describe the issue..."
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs"
                          disabled={!flagReason.trim() || flagging}
                          onClick={async () => {
                            setFlagging(true);
                            try {
                              await supabase.from("asset_flags").insert({
                                teaching_asset_id: asset.id,
                                flag_reason: flagReason.trim(),
                                status: "open",
                              });
                              toast.success("Issue flagged");
                              setShowFlagForm(false);
                              setFlagReason("");
                              onAssetUpdated?.();
                            } catch (e: any) {
                              toast.error(e.message || "Failed to flag");
                            } finally {
                              setFlagging(false);
                            }
                          }}
                        >
                          {flagging ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Flag className="h-3 w-3 mr-1" />}
                          Submit Flag
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setShowFlagForm(false); setFlagReason(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button size="sm" variant="outline" className="text-xs w-full justify-start border-border" onClick={onRevert}>
                    <Undo2 className="h-3 w-3 mr-2" /> Revert to Generated
                  </Button>
                  <Button size="sm" variant="destructive" className="text-xs w-full justify-start" onClick={onDelete}>
                    <Trash2 className="h-3 w-3 mr-2" /> Delete Asset
                  </Button>
                </div>
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
                {asset.test_slide_url && (
                  <LinkCard
                    icon={Share2}
                    label="Test Slide"
                    subtitle="Open in Google Slides"
                    href={asset.test_slide_url}
                    onCopy={() => { navigator.clipboard.writeText(asset.test_slide_url!); toast.success("Copied"); }}
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
                  disabled={isSyncing || !isAdmin}
                  onClick={handleResyncSheet}
                  title={!isAdmin ? "Only admin can create/sync sheets" : undefined}
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
                    <AlertTriangle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Mark Sheet Pending for Review</p>
                      <p className="text-[10px] text-muted-foreground">Submit this sheet for Lee to review</p>
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

            {/* Issues */}
            <TabsContent value="issues" className="px-6 pb-6 space-y-3 mt-4">
              {issueReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No issues reported</p>
              ) : (
                <div className="space-y-3">
                  {issueReports.map((issue: any) => (
                    <div key={issue.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(issue.created_at), "MMM d")}</span>
                          <span>·</span>
                          <span>{issue.reporter_email || "Anonymous"}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={issue.status === "resolved"
                            ? "text-emerald-600 border-emerald-500/30 text-[10px]"
                            : "text-amber-600 border-amber-500/30 text-[10px]"
                          }
                        >
                          {issue.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{issue.message}</p>
                      {issue.status === "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={async () => {
                            await supabase
                              .from("asset_issue_reports")
                              .update({ status: "resolved" })
                              .eq("id", issue.id);
                            queryClient.invalidateQueries({ queryKey: ["asset-issue-reports", asset?.id] });
                            queryClient.invalidateQueries({ queryKey: ["open-issue-count"] });
                            toast.success("Issue marked resolved");
                          }}
                        >
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
