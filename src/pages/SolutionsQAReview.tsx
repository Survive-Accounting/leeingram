import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useVaAccount } from "@/hooks/useVaAccount";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft,
  GripHorizontal, X, ChevronDown, ChevronUp, Maximize2, Minimize2,
  SkipForward, Eye, Users, RefreshCw, Wrench, Loader2, RotateCcw, Check, List, Info, Copy,
} from "lucide-react";
import { toast } from "sonner";
import SmartTextRenderer from "@/components/SmartTextRenderer";

// ── Constants ────────────────────────────────────────────────────────

const COURSES = [
  { code: "INTRO1", name: "Intro Accounting 1", id: "11111111-1111-1111-1111-111111111111" },
  { code: "INTRO2", name: "Intro Accounting 2", id: "22222222-2222-2222-2222-222222222222" },
  { code: "IA1", name: "Intermediate Accounting 1", id: "33333333-3333-3333-3333-333333333333" },
  { code: "IA2", name: "Intermediate Accounting 2", id: "44444444-4444-4444-4444-444444444444" },
];

// ── Types ────────────────────────────────────────────────────────────

type QAAsset = {
  id: string;
  teaching_asset_id: string;
  asset_name: string;
  chapter_id: string;
  course_id: string;
  qa_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  assigned_to: string | null;
};

type QAIssue = {
  id: string;
  qa_asset_id: string;
  asset_name: string;
  section: string;
  issue_description: string;
  suggested_fix: string | null;
  screenshot_url: string | null;
  fix_status: string;
};

type TeachingAssetDetail = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  flowchart_image_url: string | null;
  journal_entry_completed_json: any;
  supplementary_je_json: any;
  important_formulas: string | null;
  concept_notes: string | null;
  exam_traps: string | null;
  base_raw_problem_id: string | null;
  chapter_id: string;
  chapters: { chapter_number: number; chapter_name: string } | null;
};

type SectionDef = { key: string; label: string; hasContent: boolean };

type VAAccount = { id: string; full_name: string; email: string; role: string };
type QAReviewerAssignment = { course_id: string; chapter_id: string };

// ── Helpers ──────────────────────────────────────────────────────────

function buildSections(asset: TeachingAssetDetail | null): SectionDef[] {
  if (!asset) return [];
  return [
    { key: "solution", label: "Solution", hasContent: true },
    { key: "je", label: "Journal Entries", hasContent: !!asset.journal_entry_completed_json },
    { key: "howto", label: "How to Solve", hasContent: !!asset.flowchart_image_url },
    { key: "related_je", label: "Related JE", hasContent: !!asset.supplementary_je_json },
  ].filter(s => s.hasContent);
}

/** Parse asset_name into a sortable key following textbook order: BE < QS < E < P */
function textbookSortKey(assetName: string): [number, number, number, string] {
  // Extract source type and number from names like "IA2_CH13_BE13_1_A"
  const match = assetName.match(/_CH\d+_(BE|QS|E|P)(\d+)[_.](\d+)/i);
  if (!match) return [99, 0, 0, assetName];
  const typeOrder: Record<string, number> = { BE: 0, QS: 1, E: 2, P: 3 };
  const type = match[1].toUpperCase();
  return [typeOrder[type] ?? 99, parseInt(match[2], 10), parseInt(match[3], 10), assetName];
}

function compareTextbookOrder(a: QAAsset, b: QAAsset): number {
  const ka = textbookSortKey(a.asset_name);
  const kb = textbookSortKey(b.asset_name);
  for (let i = 0; i < 3; i++) {
    if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number);
  }
  return ka[3].localeCompare(kb[3]);
}

// ── Draggable hook ───────────────────────────────────────────────────

function useDraggable(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const posRef = useRef(initialPos);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const pendingPosRef = useRef(initialPos);
  const frameRef = useRef<number | null>(null);

  const paint = useCallback((next: { x: number; y: number }) => {
    pendingPosRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const { x, y } = pendingPosRef.current;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }, []);

  useEffect(() => {
    paint(pos);
  }, [paint, pos]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const endDrag = useCallback((currentTarget?: HTMLDivElement, pointerId?: number) => {
    if (pointerId !== undefined && currentTarget?.hasPointerCapture(pointerId)) {
      currentTarget.releasePointerCapture(pointerId);
    }
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    setPos(posRef.current);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, label')) return;

    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - posRef.current.x,
      offsetY: e.clientY - posRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || e.pointerId != dragRef.current.pointerId) return;
    const next = {
      x: e.clientX - dragRef.current.offsetX,
      y: e.clientY - dragRef.current.offsetY,
    };
    posRef.current = next;
    paint(next);
  }, [paint]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || e.pointerId != dragRef.current.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
  }, [endDrag]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || e.pointerId != dragRef.current.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
  }, [endDrag]);

  const resetPos = useCallback((newPos: { x: number; y: number }) => {
    posRef.current = newPos;
    setPos(newPos);
    paint(newPos);
  }, [paint]);

  return { pos, containerRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, resetPos };
}

// ── Jump to Label Dropdown ────────────────────────────────────────────

function JumpToLabelDropdown({
  assets,
  currentIndex,
  onJump,
}: {
  assets: QAAsset[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll to current item when opened
  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) activeEl.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const currentAsset = assets[currentIndex];
  const currentLabel = currentAsset?.asset_name?.replace(/^[A-Z0-9]+_CH\d+_/, "").replace(/_[A-Z]$/, "") || "";

  const filtered = search.trim()
    ? assets.filter((a) => a.asset_name.toLowerCase().includes(search.toLowerCase()))
    : assets;

  return (
    <div className="relative ml-auto" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-mono border border-border rounded px-1.5 py-0.5 hover:bg-muted/30 transition-colors"
      >
        {currentLabel || currentAsset?.asset_name || "—"}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-xl z-[60] overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-muted/30">
              <svg className="h-3 w-3 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Jump to label..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
            </div>
          </div>
          <div ref={listRef} className="max-h-[280px] overflow-y-auto py-0.5">
            {filtered.map((asset) => {
              const idx = assets.indexOf(asset);
              const isCurrent = idx === currentIndex;
              const label = asset.asset_name.replace(/^[A-Z0-9]+_CH\d+_/, "").replace(/_[A-Z]$/, "");
              const statusIcon =
                asset.qa_status === "reviewed_clean" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : asset.qa_status === "reviewed_issues" ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                ) : null;

              return (
                <button
                  key={asset.id}
                  data-active={isCurrent}
                  onClick={() => { onJump(idx); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent transition-colors ${
                    isCurrent ? "bg-accent/50 font-semibold" : ""
                  }`}
                >
                  <span className="font-mono text-foreground flex-1 truncate">{label}</span>
                  {isCurrent && <span className="text-[9px] text-muted-foreground">✓ current</span>}
                  {statusIcon}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick Issue Form ─────────────────────────────────────────────────

function QuickIssueForm({
  section, qaAssetId, assetName, onSaved, onCancel,
}: {
  section: string; qaAssetId: string; assetName: string; onSaved: () => void; onCancel: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: qaAssetId, asset_name: assetName, section,
        issue_description: desc.trim(), fix_status: "pending",
      });
      if (error) throw error;
      toast.success("Issue logged");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="pl-5 pr-1 pb-1.5 space-y-1.5 animate-in slide-in-from-top-1 duration-100">
      <Textarea
        value={desc} onChange={e => setDesc(e.target.value)}
        placeholder={`What's wrong with ${section}?`}
        className="text-xs min-h-[32px] resize-y" rows={2} autoFocus
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && desc.trim()) { e.preventDefault(); save(); }
        }}
      />
      <div className="flex gap-1">
        <Button size="sm" className="text-[10px] h-5 px-2" disabled={!desc.trim() || saving} onClick={save}>Add ⌘↵</Button>
        <Button size="sm" variant="ghost" className="text-[10px] h-5 px-2" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Screenshot Lightbox ──────────────────────────────────────────────

function ScreenshotLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8" onClick={onClose}>
      <img src={url} alt="Textbook screenshot" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
    </div>
  );
}

// ── Fix Sections Config ──────────────────────────────────────────────

const FIX_SECTIONS = [
  { key: "problem_text", label: "Problem text" },
  { key: "instructions", label: "Instructions text" },
  { key: "solution", label: "Solution" },
];

// ── Rendered Section Preview ─────────────────────────────────────────

function RenderedSectionPreview({
  sectionKey,
  data,
  mode,
}: {
  sectionKey: string;
  data: Record<string, unknown>;
  mode: "before" | "after";
}) {
  const highlight = mode === "after" ? "ring-1 ring-emerald-500/30 bg-emerald-500/5" : "";

  if (sectionKey === "solution") {
    const text = String(data.survive_solution_text || "");
    if (!text.trim()) return <p className="text-xs text-muted-foreground italic">Empty</p>;
    return (
      <div className={`rounded-md p-3 ${highlight}`}>
        <SmartTextRenderer text={text} className="text-xs leading-relaxed text-foreground" />
      </div>
    );
  }

  if (sectionKey === "problem_text") {
    const text = String(data.survive_problem_text || data.problem_context || "");
    if (!text.trim()) return <p className="text-xs text-muted-foreground italic">Empty</p>;
    return (
      <div className={`rounded-md p-3 ${highlight}`}>
        <SmartTextRenderer text={text} className="text-xs leading-relaxed text-foreground" />
      </div>
    );
  }

  if (sectionKey === "instructions") {
    const raw = String(data.instruction_list || "");
    if (!raw.trim()) return <p className="text-xs text-muted-foreground italic">Empty</p>;
    const parts = raw.split(/[\n|]/).map(s => s.trim()).filter(Boolean);
    return (
      <div className={`rounded-md p-3 space-y-1.5 ${highlight}`}>
        {parts.map((part, i) => (
          <p key={i} className="text-xs text-foreground">
            <span className="font-semibold text-muted-foreground mr-1">({String.fromCharCode(97 + i)})</span>
            {part}
          </p>
        ))}
      </div>
    );
  }

  // Fallback for unknown sections
  return (
    <div className="space-y-1">
      {Object.entries(data).map(([col, val]) => (
        <div key={col}>
          <p className="text-[9px] font-mono text-muted-foreground">{col}</p>
          <pre className={`text-[11px] whitespace-pre-wrap break-words ${mode === "after" ? "text-emerald-700" : "text-foreground"}`}>
            {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val ?? "")}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ── Fix Asset Modal ──────────────────────────────────────────────────

type FixStep = "input" | "running" | "compare" | "done";

function QAFixAssetModal({
  teachingAssetId,
  assetName,
  reviewerName,
  onClose,
  onComplete,
}: {
  teachingAssetId: string;
  assetName: string;
  reviewerName: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<FixStep>("input");
  const [fixPrompt, setFixPrompt] = useState("");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [runProgress, setRunProgress] = useState<Record<string, "pending" | "running" | "done" | "error">>({});
  const [snapshot, setSnapshot] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [afterData, setAfterData] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [runResults, setRunResults] = useState<{ key: string; ok: boolean; error?: string }[]>([]);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [sectionApproved, setSectionApproved] = useState<Record<string, boolean>>({});
  const [sectionReverted, setSectionReverted] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<Record<string, "before" | "after">>({});

  // JE Suggestion helper
  const [jeSuggestOpen, setJeSuggestOpen] = useState(false);
  const [jeSuggestLoading, setJeSuggestLoading] = useState(false);
  const [jeSuggestions, setJeSuggestions] = useState<{ label: string; description: string }[]>([]);
  const [jeSelected, setJeSelected] = useState<Set<number>>(new Set());

  const analyzeMissingJE = async () => {
    setJeSuggestLoading(true);
    setJeSuggestions([]);
    setJeSelected(new Set());
    try {
      const res = await supabase.functions.invoke("suggest-missing-je", {
        body: { teaching_asset_id: teachingAssetId },
      });
      if (res.error) throw new Error(res.error.message);
      const entries = res.data?.suggested_entries || [];
      setJeSuggestions(entries);
    } catch (err: any) {
      toast.error("Analysis failed: " + err.message);
    } finally {
      setJeSuggestLoading(false);
    }
  };

  const appendSelectedToPrompt = () => {
    const labels = jeSuggestions.filter((_, i) => jeSelected.has(i)).map(s => s.label);
    if (labels.length === 0) { toast.error("Select at least one suggestion"); return; }
    const appendText = `\n\nAlso add these missing journal entries: ${labels.join(", ")}.`;
    setFixPrompt(prev => prev + appendText);
    // Auto-check supplementary JE section
    setSelectedSections(prev => {
      const next = new Set(prev);
      const suppKey = FIX_SECTIONS.find(s => s.label.toLowerCase().includes("supplementary"))?.key;
      if (suppKey) next.add(suppKey);
      return next;
    });
    setJeSuggestOpen(false);
    toast.success("Added to fix description");
  };

  const canRun = fixPrompt.trim().length >= 20 && selectedSections.size > 0;

  const toggleSection = (key: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedSections.size === FIX_SECTIONS.length) setSelectedSections(new Set());
    else setSelectedSections(new Set(FIX_SECTIONS.map(s => s.key)));
  };

  const runFix = async () => {
    const sections = [...selectedSections];
    setStep("running");
    const progress: Record<string, "pending" | "running" | "done" | "error"> = {};
    sections.forEach(s => { progress[s] = "pending"; });
    setRunProgress({ ...progress });

    try {
      // Snapshot
      sections.forEach(s => { progress[s] = "running"; });
      setRunProgress({ ...progress });
      const snapRes = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, sections, action: "snapshot" },
      });
      if (snapRes.error) throw new Error(snapRes.error.message);
      setSnapshot(snapRes.data.snapshot);

      // Run
      const runRes = await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          sections,
          fix_prompt: fixPrompt.trim(),
          action: "run",
          attempt_number: attemptNumber,
        },
      });
      if (runRes.error) throw new Error(runRes.error.message);

      const results = runRes.data.results as { key: string; ok: boolean; error?: string }[];
      setRunResults(results);
      setAfterData(runRes.data.after);
      results.forEach(r => { progress[r.key] = r.ok ? "done" : "error"; });
      setRunProgress({ ...progress });

      // Init view modes
      const modes: Record<string, "before" | "after"> = {};
      const approved: Record<string, boolean> = {};
      results.forEach(r => {
        if (r.ok) { modes[r.key] = "after"; approved[r.key] = false; }
      });
      setViewMode(modes);
      setSectionApproved(approved);
      setSectionReverted({});
      setStep("compare");
    } catch (err: any) {
      toast.error("Fix failed: " + err.message);
      setStep("input");
    }
  };

  const revertSection = async (sectionKey: string) => {
    if (!snapshot?.[sectionKey]) return;
    try {
      const res = await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          snapshot: { [sectionKey]: snapshot[sectionKey] },
          restore_sections: [sectionKey],
          action: "restore_partial",
        },
      });
      if (res.error) throw new Error(res.error.message);
      setSectionReverted(prev => ({ ...prev, [sectionKey]: true }));
      setSectionApproved(prev => ({ ...prev, [sectionKey]: false }));
      toast.info(`${FIX_SECTIONS.find(s => s.key === sectionKey)?.label || sectionKey} reverted`);
    } catch (err: any) {
      toast.error("Revert failed: " + err.message);
    }
  };

  const approveAll = async () => {
    try {
      // Save audit trail
      const res = await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          fix_prompt: fixPrompt.trim(),
          reviewer_name: reviewerName,
          action: "approve",
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success("Changes approved and saved");
      setStep("done");
      onComplete();
    } catch (err: any) {
      toast.error("Approve failed: " + err.message);
    }
  };

  const rejectAll = async () => {
    if (!snapshot) return;
    try {
      const res = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, snapshot, action: "restore", reviewer_name: reviewerName },
      });
      if (res.error) throw new Error(res.error.message);
      toast.info("All changes reverted");
      onClose();
    } catch (err: any) {
      toast.error("Restore failed: " + err.message);
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "(empty)";
    if (typeof val === "string") return val.length > 600 ? val.slice(0, 600) + "…" : val;
    return JSON.stringify(val, null, 2);
  };

  const successfulSections = runResults.filter(r => r.ok && !sectionReverted[r.key]);
  const allApproved = successfulSections.length > 0 && successfulSections.every(r => sectionApproved[r.key]);

  const fixDrag = useDraggable({ x: window.innerWidth - 460, y: 80 });

  return (
    <div
      ref={fixDrag.containerRef}
      onPointerMove={fixDrag.onPointerMove}
      onPointerUp={fixDrag.onPointerUp}
      onPointerCancel={fixDrag.onPointerCancel}
      className="fixed z-[60] w-[420px] max-h-[80vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      style={{ left: 0, top: 0, transform: `translate3d(${fixDrag.pos.x}px, ${fixDrag.pos.y}px, 0)` }}
    >
      <div
        onPointerDown={fixDrag.onPointerDown}
        className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 cursor-grab active:cursor-grabbing select-none bg-muted/30"
      >
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Fix This Asset
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{assetName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {attemptNumber > 1 && (
            <Badge variant="outline" className="text-[10px]">Attempt #{attemptNumber}</Badge>
          )}
          <button
            title="Copy Debug Info"
            onClick={() => {
              const debugInfo = {
                teachingAssetId,
                assetName,
                step,
                attemptNumber,
                fixPrompt,
                selectedSections: [...selectedSections],
                snapshot,
                afterData,
                runResults,
                sectionApproved,
                sectionReverted,
                timestamp: new Date().toISOString(),
              };
              navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
              toast.success("Debug info copied to clipboard");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { if (step !== "running") onClose(); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Step 1: Describe the fix */}
        {step === "input" && (
          <>
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5">
              <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                <strong>💡 Tip:</strong> Take a screenshot of the issue and paste it into ChatGPT with a description of what's wrong. Ask it to suggest a fix prompt you can paste here for the best results.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">What's wrong and how should it be fixed?</label>
              <Textarea
                value={fixPrompt}
                onChange={e => setFixPrompt(e.target.value)}
                placeholder="e.g. The supplementary JE for bond issuance is missing Interest Payable as a credit. Fix it to show: Cash debit, Bonds Payable credit, Interest Payable credit."
                className="text-xs min-h-[80px]"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                {fixPrompt.trim().length < 20 ? `${20 - fixPrompt.trim().length} more characters needed` : "✓ Ready"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Select what to regenerate</label>
                <button onClick={selectAll} className="text-[10px] text-primary hover:underline font-medium">
                  {selectedSections.size === FIX_SECTIONS.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="space-y-1.5">
                {FIX_SECTIONS.map(sec => (
                  <label key={sec.key} className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox checked={selectedSections.has(sec.key)} onCheckedChange={() => toggleSection(sec.key)} />
                    <span className="text-xs text-foreground group-hover:text-primary transition-colors">{sec.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Suggest Missing JE Helper */}
            <div className="border border-border rounded-lg overflow-hidden">
              <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                <Checkbox checked={jeSuggestOpen} onCheckedChange={(c) => setJeSuggestOpen(!!c)} />
                <span className="text-xs font-medium text-foreground">Related journal entries are missing</span>
              </label>
              {jeSuggestOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    I'll read this problem and suggest which related journal entries should be added.
                  </p>
                  {jeSuggestions.length === 0 && !jeSuggestLoading && (
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={analyzeMissingJE}>
                      Analyze Problem →
                    </Button>
                  )}
                  {jeSuggestLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading problem...
                    </div>
                  )}
                  {jeSuggestions.length > 0 && (
                    <div className="space-y-1.5">
                      {jeSuggestions.map((s, i) => (
                        <label key={i} className="flex items-start gap-2 cursor-pointer group p-1.5 rounded hover:bg-muted/30">
                          <Checkbox
                            checked={jeSelected.has(i)}
                            onCheckedChange={() => {
                              setJeSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              });
                            }}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-xs font-medium text-foreground">{s.label}</span>
                            <p className="text-[10px] text-muted-foreground leading-snug">{s.description}</p>
                          </div>
                        </label>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs mt-1"
                        disabled={jeSelected.size === 0}
                        onClick={appendSelectedToPrompt}
                      >
                        Add Selected to Fix Description →
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button onClick={runFix} disabled={!canRun} className="w-full" size="sm">
              <Wrench className="h-3.5 w-3.5 mr-1.5" /> Run Fix →
            </Button>
          </>
        )}

        {/* Step 2: Running */}
        {step === "running" && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-foreground">Running fix on {assetName}...</p>
            {FIX_SECTIONS.filter(s => selectedSections.has(s.key)).map(sec => {
              const status = runProgress[sec.key] || "pending";
              return (
                <div key={sec.key} className="flex items-center gap-2 text-xs">
                  {status === "running" || status === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : status === "done" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={status === "done" ? "text-muted-foreground" : "text-foreground"}>
                    {status === "done" ? `✓ ${sec.label} updated` : sec.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 3: Before/After review */}
        {step === "compare" && snapshot && afterData && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-foreground">Review Changes</p>

            {runResults.filter(r => !r.ok).length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                <p className="text-[10px] font-bold text-destructive">Some sections failed:</p>
                {runResults.filter(r => !r.ok).map(r => (
                  <p key={r.key} className="text-[10px] text-destructive">{r.key}: {r.error}</p>
                ))}
              </div>
            )}

            {runResults.filter(r => r.ok).map(result => {
              const sec = FIX_SECTIONS.find(s => s.key === result.key);
              const before = snapshot[result.key] || {};
              const after = afterData[result.key] || {};
              const mode = viewMode[result.key] || "after";
              const approved = sectionApproved[result.key] || false;
              const reverted = sectionReverted[result.key] || false;
              const data = mode === "before" ? before : after;

              return (
                <div key={result.key} className={`border rounded-lg overflow-hidden ${reverted ? "border-muted opacity-50" : approved ? "border-emerald-500/40" : "border-border"}`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <span className="text-xs font-bold text-foreground">{sec?.label || result.key}</span>
                    <div className="flex items-center gap-2">
                      {!reverted && (
                        <>
                          <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
                            <button
                              onClick={() => setViewMode(prev => ({ ...prev, [result.key]: "before" }))}
                              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${mode === "before" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                            >
                              Before
                            </button>
                            <button
                              onClick={() => setViewMode(prev => ({ ...prev, [result.key]: "after" }))}
                              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${mode === "after" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                            >
                              After
                            </button>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                            <Checkbox
                              checked={approved}
                              onCheckedChange={(checked) => setSectionApproved(prev => ({ ...prev, [result.key]: !!checked }))}
                            />
                            <span className={approved ? "text-emerald-500 font-medium" : "text-muted-foreground"}>Approve</span>
                          </label>
                        </>
                      )}
                      {!reverted ? (
                        <button
                          onClick={() => revertSection(result.key)}
                          className="text-[10px] text-destructive/70 hover:text-destructive font-medium"
                        >
                          Revert
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Reverted</span>
                      )}
                    </div>
                  </div>
                  {!reverted && (
                    <ScrollArea className="max-h-[300px]">
                      <div className="p-3">
                        <RenderedSectionPreview sectionKey={result.key} data={data} mode={mode} />
                      </div>
                    </ScrollArea>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={approveAll}
                disabled={successfulSections.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve All & Save
              </Button>
              <Button onClick={rejectAll} variant="outline" className="flex-1" size="sm">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reject All
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function SolutionsQAReview() {
  const { impersonating } = useImpersonation();
  const { vaAccount, assignments } = useVaAccount();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlAssetParam = searchParams.get("asset");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewerName, setReviewerName] = useState(() => localStorage.getItem("qa-reviewer-name") || "");
  const [nameInput, setNameInput] = useState("");
  const [checkedSections, setCheckedSections] = useState<Set<string>>(new Set());
  const [openIssueSection, setOpenIssueSection] = useState<string | null>(null);
  const [screenshotStep, setScreenshotStep] = useState<"pending" | "done">("pending");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const assetParam = params.get("asset");
    if (assetParam) {
      const prefix = assetParam.split("_")[0]?.toUpperCase();
      const match = COURSES.find(c => c.code === prefix);
      if (match) {
        localStorage.setItem("qa-course-filter", match.id);
        return match.id;
      }
    }
    return localStorage.getItem("qa-course-filter") || "all";
  });
  const [selectedChapterId, setSelectedChapterId] = useState(() => {
    // When deep-linking via ?asset=, reset chapter filter to "all" so the target asset isn't filtered out
    const params = new URLSearchParams(window.location.search);
    if (params.get("asset")) {
      localStorage.setItem("qa-chapter-filter", "all");
      return "all";
    }
    return localStorage.getItem("qa-chapter-filter") || "all";
  });
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [fixAssetOpen, setFixAssetOpen] = useState(false);


  const { pos, containerRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useDraggable({ x: 16, y: 60 });

  const [sopOpen, setSopOpen] = useState(false);

  // ── Fetch VAs ───────────────────────────────────────────────────
  const { data: vaAccounts } = useQuery({
    queryKey: ["va-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_accounts")
        .select("id, full_name, email, role")
        .eq("account_status", "active")
        .order("full_name");
      if (error) throw error;
      return data as VAAccount[];
    },
  });

  const activeQaRole = impersonating?.role || vaAccount?.role || null;
  const isScopedVaSession = false; // All VAs see all courses/chapters
  const canUseFixer = !activeQaRole || activeQaRole === "admin" || activeQaRole === "lead_va";
  const activeQaVaId = isScopedVaSession ? (impersonating?.id || vaAccount?.id || null) : null;

  const { data: impersonatedAssignments, isLoading: isImpersonatedAssignmentsLoading } = useQuery<QAReviewerAssignment[]>({
    queryKey: ["qa-impersonated-va-assignments", impersonating?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_assignments")
        .select("course_id, chapter_id")
        .eq("va_account_id", impersonating!.id);
      if (error) throw error;
      return (data ?? []) as QAReviewerAssignment[];
    },
    enabled: !!impersonating?.id && isScopedVaSession,
  });

  const activeAssignments = impersonating
    ? impersonatedAssignments
    : (assignments as QAReviewerAssignment[] | undefined);

  const isAssignmentsLoading = !!activeQaVaId && (impersonating
    ? isImpersonatedAssignmentsLoading
    : activeAssignments === undefined);

  const assignedCourseIds = useMemo(
    () => [...new Set((activeAssignments ?? []).map((assignment) => assignment.course_id).filter(Boolean))],
    [activeAssignments]
  );

  const availableCourses = useMemo(
    () => (isScopedVaSession ? COURSES.filter((course) => assignedCourseIds.includes(course.id)) : COURSES),
    [assignedCourseIds, isScopedVaSession]
  );

  const showAllCoursesOption = !isScopedVaSession || availableCourses.length > 1;
  const allCoursesLabel = isScopedVaSession ? "All Assigned Courses" : "All Courses";
  const scopedFilterInitializedRef = useRef(false);

  useEffect(() => {
    if (!isScopedVaSession || !assignedCourseIds.length || scopedFilterInitializedRef.current) return;
    scopedFilterInitializedRef.current = true;
    const nextCourseId = availableCourses.length > 1 ? "all" : assignedCourseIds[0];
    setSelectedCourseId(nextCourseId);
    localStorage.setItem("qa-course-filter", nextCourseId);
    setCurrentIndex(0);
  }, [assignedCourseIds, availableCourses.length, isScopedVaSession]);

  // ── Seed all courses (lightweight: single COUNT check) ──────────
  const seedCheckedRef = useRef(false);
  const seedMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { count } = await supabase
        .from("solutions_qa_assets" as any)
        .select("id", { count: "exact", head: true })
        .eq("course_id", courseId);
      if (count && count > 0) return { seeded: 0 };

      let allTeachingAssets: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page } = await supabase
          .from("teaching_assets")
          .select("id, asset_name, chapter_id, course_id")
          .eq("course_id", courseId)
          .range(from, from + pageSize - 1);
        if (!page?.length) break;
        allTeachingAssets = allTeachingAssets.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
      if (!allTeachingAssets.length) return { seeded: 0 };

      const records = allTeachingAssets.map(a => ({
        teaching_asset_id: a.id,
        asset_name: a.asset_name,
        chapter_id: a.chapter_id,
        course_id: a.course_id,
        qa_status: "pending",
      }));

      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from("solutions_qa_assets" as any).insert(batch);
        if (error) throw error;
      }
      return { seeded: records.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["qa-assets"] });
      if (result && result.seeded > 0) toast.success(`Seeded ${result.seeded} assets`);
    },
  });

  useEffect(() => {
    if (seedCheckedRef.current) return;
    seedCheckedRef.current = true;
    // Quick check: if ANY qa assets exist, skip seeding entirely
    (async () => {
      const { count } = await supabase
        .from("solutions_qa_assets" as any)
        .select("id", { count: "exact", head: true });
      if (count && count > 0) return; // Already seeded
      let totalSeeded = 0;
      for (const course of COURSES) {
        const result = await seedMutation.mutateAsync(course.id);
        totalSeeded += result?.seeded || 0;
      }
      if (totalSeeded > 0) toast.success(`Seeded ${totalSeeded} new assets`);
    })();
  }, []);

  const effectiveCourseId = useMemo(() => {
    if (!isScopedVaSession) return selectedCourseId;
    if (!assignedCourseIds.length) return "all";
    if (selectedCourseId === "all") return showAllCoursesOption ? "all" : assignedCourseIds[0];
    return assignedCourseIds.includes(selectedCourseId)
      ? selectedCourseId
      : (showAllCoursesOption ? "all" : assignedCourseIds[0]);
  }, [assignedCourseIds, isScopedVaSession, selectedCourseId, showAllCoursesOption]);

  // ── Fetch chapters for selected course ────────────────────────────
  const { data: courseChapters } = useQuery({
    queryKey: ["qa-course-chapters", effectiveCourseId],
    queryFn: async () => {
      if (effectiveCourseId === "all") return [];
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", effectiveCourseId)
        .order("chapter_number");
      if (error) throw error;
      return data || [];
    },
    enabled: effectiveCourseId !== "all",
  });

  // ── Fetch QA assets — require course+chapter selection ───────────
  const needsSelection = effectiveCourseId === "all";
  const { data: allAssetsRaw, isLoading } = useQuery({
    queryKey: ["qa-assets", effectiveCourseId, selectedChapterId],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .from("solutions_qa_assets" as any)
          .select("*")
          .order("asset_name")
          .range(from, from + pageSize - 1);
        if (effectiveCourseId !== "all") q = q.eq("course_id", effectiveCourseId);
        if (selectedChapterId !== "all") q = q.eq("chapter_id", selectedChapterId);
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all as QAAsset[];
    },
    enabled: !needsSelection,
  });

  // ── Chapter-level status counts (single query, computed client-side) ──
  const { data: chapterStatusCounts } = useQuery({
    queryKey: ["qa-chapter-status-counts", effectiveCourseId],
    queryFn: async () => {
      if (effectiveCourseId === "all") return {};
      // Fetch only chapter_id + qa_status (lightweight columns)
      let all: { chapter_id: string; qa_status: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("solutions_qa_assets" as any)
          .select("chapter_id, qa_status")
          .eq("course_id", effectiveCourseId)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data as any[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const counts: Record<string, { total: number; clean: number; issues: number; pending: number }> = {};
      for (const row of all) {
        if (!counts[row.chapter_id]) counts[row.chapter_id] = { total: 0, clean: 0, issues: 0, pending: 0 };
        counts[row.chapter_id].total++;
        if (row.qa_status === "reviewed_clean") counts[row.chapter_id].clean++;
        else if (row.qa_status === "reviewed_issues") counts[row.chapter_id].issues++;
        else counts[row.chapter_id].pending++;
      }
      return counts;
    },
    enabled: effectiveCourseId !== "all",
  });

  const isCourseSelectorLocked = isScopedVaSession && !showAllCoursesOption;

  // Filter by effective course (already filtered in query, just sort)
  const allAssets = useMemo(() => {
    if (!allAssetsRaw) return [];
    const scopedAssets = isScopedVaSession
      ? allAssetsRaw.filter((asset) => assignedCourseIds.includes(asset.course_id))
      : allAssetsRaw;
    return [...scopedAssets].sort(compareTextbookOrder);
  }, [allAssetsRaw, assignedCourseIds, isScopedVaSession]);

  const current = allAssets[currentIndex] ?? null;
  const totalReviewed = allAssets.filter(r => r.qa_status !== "pending").length;
  const totalAll = allAssets.length;
  const totalPending = totalAll - totalReviewed;
  const progress = totalAll > 0 ? (totalReviewed / totalAll) * 100 : 0;

  // Per-course stats
  const courseStats = useMemo(() => {
    if (!allAssetsRaw) return {};
    const stats: Record<string, { total: number; reviewed: number; pending: number }> = {};
    for (const c of COURSES) {
      const courseAssets = allAssetsRaw.filter(a => a.course_id === c.id);
      stats[c.id] = {
        total: courseAssets.length,
        reviewed: courseAssets.filter(a => a.qa_status !== "pending").length,
        pending: courseAssets.filter(a => a.qa_status === "pending").length,
      };
    }
    return stats;
  }, [allAssetsRaw]);

  // ── Fetch source refs for all assets in current list ──────────────
  const teachingAssetIds = useMemo(() => allAssets.map(a => a.teaching_asset_id), [allAssets]);
  const { data: sourceRefMap } = useQuery({
    queryKey: ["qa-source-refs", teachingAssetIds],
    queryFn: async () => {
      if (!teachingAssetIds.length) return {} as Record<string, string>;
      const map: Record<string, string> = {};
      // Batch in chunks of 200
      for (let i = 0; i < teachingAssetIds.length; i += 200) {
        const chunk = teachingAssetIds.slice(i, i + 200);
        const { data } = await supabase
          .from("teaching_assets")
          .select("id, source_ref")
          .in("id", chunk);
        if (data) for (const r of data) map[r.id] = (r as any).source_ref || "";
      }
      return map;
    },
    enabled: teachingAssetIds.length > 0,
  });

  // ── Source ref navigator data ───────────────────────────────────
  const sourceRefGroups = useMemo(() => {
    if (!sourceRefMap || !allAssets.length) return [];
    const isIntro = effectiveCourseId === "11111111-1111-1111-1111-111111111111" || effectiveCourseId === "22222222-2222-2222-2222-222222222222";
    
    type RefItem = { assetIndex: number; assetName: string; sourceRef: string; status: string };
    const items: RefItem[] = allAssets.map((a, idx) => ({
      assetIndex: idx,
      assetName: a.asset_name,
      sourceRef: sourceRefMap[a.teaching_asset_id] || a.asset_name,
      status: a.qa_status,
    }));

    // Natural sort helper: sorts by numeric parts within source refs
    const naturalSort = (a: RefItem, b: RefItem) => {
      const extract = (s: string) => {
        const m = s.match(/(\d+)\.(\d+)([A-Z]?)$/i);
        if (m) return [parseInt(m[1]), parseInt(m[2]), m[3].toUpperCase()] as const;
        const m2 = s.match(/(\d+)([A-Z]?)$/i);
        if (m2) return [parseInt(m2[1]), 0, m2[2].toUpperCase()] as const;
        return [0, 0, ""] as const;
      };
      const [a1, a2, a3] = extract(a.sourceRef);
      const [b1, b2, b3] = extract(b.sourceRef);
      if (a1 !== b1) return a1 - b1;
      if (a2 !== b2) return a2 - b2;
      return a3.localeCompare(b3);
    };

    // Categorize by source ref prefix
    const categories: { label: string; items: RefItem[] }[] = [];
    const beItems = items.filter(i => /^BE/i.test(i.sourceRef)).sort(naturalSort);
    const qsItems = items.filter(i => /^QS/i.test(i.sourceRef)).sort(naturalSort);
    const eItems = items.filter(i => /^E\d/i.test(i.sourceRef)).sort(naturalSort);
    const pItems = items.filter(i => /^P\d/i.test(i.sourceRef)).sort(naturalSort);
    const other = items.filter(i => 
      !/^BE/i.test(i.sourceRef) && !/^QS/i.test(i.sourceRef) && 
      !/^E\d/i.test(i.sourceRef) && !/^P\d/i.test(i.sourceRef)
    ).sort(naturalSort);

    if (isIntro) {
      if (qsItems.length) categories.push({ label: "Quick Studies", items: qsItems });
      if (beItems.length) categories.push({ label: "Brief Exercises", items: beItems });
    } else {
      if (beItems.length) categories.push({ label: "Brief Exercises", items: beItems });
      if (qsItems.length) categories.push({ label: "Quick Studies", items: qsItems });
    }
    if (eItems.length) categories.push({ label: "Exercises", items: eItems });
    if (pItems.length) categories.push({ label: "Problems", items: pItems });
    if (other.length) categories.push({ label: "Other", items: other });

    return categories;
  }, [sourceRefMap, allAssets, effectiveCourseId]);

  const [sourceRefOpen, setSourceRefOpen] = useState(false);


  const { data: assetDetail } = useQuery({
    queryKey: ["qa-asset-detail", current?.teaching_asset_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select(`
          id, asset_name, source_ref, flowchart_image_url,
          journal_entry_completed_json, supplementary_je_json,
          important_formulas, concept_notes, exam_traps,
          base_raw_problem_id, chapter_id,
          chapters(chapter_number, chapter_name)
        `)
        .eq("id", current!.teaching_asset_id)
        .single();
      if (error) throw error;
      return data as unknown as TeachingAssetDetail;
    },
    enabled: !!current?.teaching_asset_id,
  });

  // ── Fetch screenshot ────────────────────────────────────────────
  const { data: screenshotUrl } = useQuery({
    queryKey: ["qa-screenshot", assetDetail?.base_raw_problem_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("problem_screenshot_url, problem_screenshot_urls")
        .eq("id", assetDetail!.base_raw_problem_id!)
        .single();
      if (error) return null;
      return data?.problem_screenshot_url || (data?.problem_screenshot_urls as string[])?.[0] || null;
    },
    enabled: !!assetDetail?.base_raw_problem_id,
  });

  // ── Fetch issues ────────────────────────────────────────────────
  const { data: currentIssues } = useQuery({
    queryKey: ["qa-issues", current?.id],
    queryFn: async () => {
      if (!current) return [];
      const { data, error } = await supabase
        .from("solutions_qa_issues" as any)
        .select("*")
        .eq("qa_asset_id", current.id)
        .order("created_at");
      if (error) throw error;
      return (data as any[]) as QAIssue[];
    },
    enabled: !!current?.id,
  });

  const sections = useMemo(() => buildSections(assetDetail ?? null), [assetDetail]);
  const hasScreenshot = !!screenshotUrl;
  const issueCount = currentIssues?.length ?? 0;
  const isPending = current?.qa_status === "pending";

  // ── Assign VA to course ─────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async ({ courseId, assignee }: { courseId: string; assignee: string }) => {
      const { error } = await supabase
        .from("solutions_qa_assets" as any)
        .update({ assigned_to: assignee })
        .eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-assets"] });
      toast.success("Assignment saved");
    },
  });

  // ── Save last viewed asset to localStorage ───────────────────────
  useEffect(() => {
    if (current?.asset_name) {
      localStorage.setItem("qa_last_asset_id", current.asset_name);
    }
  }, [current?.asset_name]);

  // ── Restore last viewed asset on mount ──────────────────────────
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !allAssets.length) return;
    restoredRef.current = true;
    // Priority: URL ?asset= param > localStorage last viewed
    const target = urlAssetParam || localStorage.getItem("qa_last_asset_id");
    if (target) {
      const idx = allAssets.findIndex(a => a.asset_name === target);
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [allAssets, urlAssetParam]);

  // ── Reset state on asset change ─────────────────────────────────
  useEffect(() => {
    setCheckedSections(new Set());
    setOpenIssueSection(null);
    setScreenshotStep(hasScreenshot ? "pending" : "done");
  }, [current?.id, hasScreenshot]);

  useEffect(() => {
    if (screenshotStep === "done" && iframeRef.current) {
      const timer = setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage({ type: "QA_OPEN_ALL_TOGGLES" }, "*");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [screenshotStep, current?.id]);

  // ── Delete issue ────────────────────────────────────────────────
  const deleteIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase.from("solutions_qa_issues" as any).delete().eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qa-issues", current?.id] }); },
  });

  // ── Mark and advance ────────────────────────────────────────────
  const markAndAdvance = useCallback(async (forceStatus?: "reviewed_issues") => {
    if (!current) return;
    const { count } = await supabase
      .from("solutions_qa_issues" as any)
      .select("id", { count: "exact", head: true })
      .eq("qa_asset_id", current.id);
    const finalStatus = forceStatus || ((count && count > 0) ? "reviewed_issues" : "reviewed_clean");
    const { error } = await supabase
      .from("solutions_qa_assets" as any)
      .update({ qa_status: finalStatus, reviewed_at: new Date().toISOString(), reviewed_by: reviewerName || "VA" })
      .eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["qa-assets"] });
    toast.success(finalStatus === "reviewed_clean" ? "✓ Clean" : "⚠ Issues saved");
    const nextPending = allAssets.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
    if (nextPending >= 0) setCurrentIndex(nextPending);
    else if (currentIndex < allAssets.length - 1) setCurrentIndex(i => i + 1);
  }, [current, currentIndex, allAssets, reviewerName, qc]);

  const jumpToNextPending = useCallback(() => {
    const next = allAssets.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
    if (next >= 0) setCurrentIndex(next);
    else {
      const fromStart = allAssets.findIndex(r => r.qa_status === "pending");
      if (fromStart >= 0) setCurrentIndex(fromStart);
      else toast.info("All assets reviewed!");
    }
  }, [allAssets, currentIndex]);

  const handleScreenshotMatch = useCallback(async (result: "yes" | "almost" | "no") => {
    if ((result === "almost" || result === "no") && current) {
      await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: current.id, asset_name: current.asset_name, section: "Problem Text",
        issue_description: result === "almost" ? "Problem text minor mismatch with textbook" : "Problem text does not match textbook",
        fix_status: "pending",
      });
      qc.invalidateQueries({ queryKey: ["qa-issues", current.id] });
    }
    setScreenshotStep("done");
  }, [current, qc]);

  const checkAll = useCallback(() => {
    setCheckedSections(new Set(sections.map(s => s.key)));
  }, [sections]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    if (!reviewerName) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;

      if (screenshotStep === "pending" && hasScreenshot) {
        if (e.key === "y" || e.key === "Y") { e.preventDefault(); handleScreenshotMatch("yes"); return; }
        if (e.key === "a" || e.key === "A") { e.preventDefault(); handleScreenshotMatch("almost"); return; }
        if (e.key === "n" || e.key === "N") { e.preventDefault(); handleScreenshotMatch("no"); return; }
      }

      if (e.key === "ArrowRight" || e.key === ".") { e.preventDefault(); setCurrentIndex(i => Math.min(allAssets.length - 1, i + 1)); }
      else if (e.key === "ArrowLeft" || e.key === ",") { e.preventDefault(); setCurrentIndex(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); markAndAdvance(); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); jumpToNextPending(); }

      if (screenshotStep === "done") {
        const num = parseInt(e.key);
        if (num >= 1 && num <= sections.length) {
          e.preventDefault();
          if (e.shiftKey) { setOpenIssueSection(sections[num - 1].label); }
          else {
            setCheckedSections(prev => {
              const next = new Set(prev);
              if (next.has(sections[num - 1].key)) next.delete(sections[num - 1].key);
              else next.add(sections[num - 1].key);
              return next;
            });
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reviewerName, screenshotStep, hasScreenshot, handleScreenshotMatch, allAssets.length, markAndAdvance, jumpToNextPending, sections]);

  // ── Course change handler ───────────────────────────────────────
  const handleCourseChange = (val: string) => {
    setSelectedCourseId(val);
    localStorage.setItem("qa-course-filter", val);
    setSelectedChapterId("all");
    localStorage.setItem("qa-chapter-filter", "all");
    setCurrentIndex(0);
  };

  const handleChapterChange = (val: string) => {
    setSelectedChapterId(val);
    localStorage.setItem("qa-chapter-filter", val);
    setCurrentIndex(0);
  };

  // ── Auto-set reviewer name for impersonated or real VAs ─────────
  useEffect(() => {
    const name = impersonating?.full_name || vaAccount?.full_name;
    if (name && !reviewerName) {
      setReviewerName(name);
      localStorage.setItem("qa-reviewer-name", name);
    }
  }, [impersonating, vaAccount]);

  // ── Loading ─────────────────────────────────────────────────────
  if (isAssignmentsLoading) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">Loading QA records...</div>;
  }

  if (needsSelection && !isLoading) {
    // Force course selection before loading data
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-md shadow-lg space-y-6">
          <div>
            <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
            <h1 className="text-xl font-bold text-foreground">Solutions QA Review</h1>
            <p className="text-sm text-muted-foreground mt-1">Select a course to begin</p>
          </div>
          <div className="space-y-3">
            {availableCourses.map(c => (
              <button
                key={c.id}
                onClick={() => handleCourseChange(c.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-bold text-foreground">{c.code}</span>
                  <span className="text-xs text-muted-foreground ml-2">{c.name}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">Loading QA records...</div>;
  }

  // ── No reviewer yet — show setup ───────────────────────────────
  if (!reviewerName) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-md shadow-lg space-y-6">
          <div>
            <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
            <h1 className="text-xl font-bold text-foreground">Solutions QA Review</h1>
            <p className="text-sm text-muted-foreground mt-1">Before expanding to new universities</p>
          </div>

          {/* Course stats */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Course Progress</p>
            {availableCourses.map(c => {
              const s = courseStats[c.id];
              const pct = s && s.total > 0 ? (s.reviewed / s.total) * 100 : 0;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold w-14 text-foreground">{c.code}</span>
                  <Progress value={pct} className="flex-1 h-1.5" />
                  <span className="text-[10px] text-muted-foreground w-20 text-right">
                    {s ? `${s.reviewed}/${s.total}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* VA Assignment panel */}
          <div className="space-y-2 border-t border-border pt-4">
            <button
              onClick={() => setShowAssignPanel(!showAssignPanel)}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground"
            >
              <Users className="h-3 w-3" />
              Assign VA's to Courses
              {showAssignPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showAssignPanel && (
              <div className="space-y-2 mt-2">
                {COURSES.map(c => {
                  // Find current assignment
                  const assignedAsset = allAssetsRaw?.find(a => a.course_id === c.id && a.assigned_to);
                  const currentAssignee = assignedAsset?.assigned_to || "";
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold w-14 text-foreground">{c.code}</span>
                      <Select
                        value={currentAssignee}
                        onValueChange={(val) => assignMutation.mutate({ courseId: c.id, assignee: val })}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lee">Lee (Admin)</SelectItem>
                          {vaAccounts?.map(va => (
                            <SelectItem key={va.id} value={va.full_name}>{va.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Name entry */}
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Your name to start</p>
            <Input
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Enter your name" className="text-sm h-9" autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && nameInput.trim()) {
                  localStorage.setItem("qa-reviewer-name", nameInput.trim());
                  setReviewerName(nameInput.trim());
                }
              }}
            />
          </div>

          {/* Course selector */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start reviewing</p>
            <Select value={effectiveCourseId} onValueChange={handleCourseChange} disabled={isCourseSelectorLocked}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {showAllCoursesOption && <SelectItem value="all">{allCoursesLabel}</SelectItem>}
                {availableCourses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full h-10"
            disabled={!nameInput.trim()}
            onClick={() => {
              localStorage.setItem("qa-reviewer-name", nameInput.trim());
              setReviewerName(nameInput.trim());
            }}
          >
            Start Reviewing →
          </Button>
        </div>
      </div>
    );
  }

  if (!allAssets.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
        <p className="text-muted-foreground text-sm">No QA records for this filter.</p>
        <div className="flex gap-2">
          <Select value={effectiveCourseId} onValueChange={handleCourseChange} disabled={isCourseSelectorLocked}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {showAllCoursesOption && <SelectItem value="all">{allCoursesLabel}</SelectItem>}
              {availableCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={async () => {
            let totalSeeded = 0;
            for (const course of COURSES) {
              const result = await seedMutation.mutateAsync(course.id);
              totalSeeded += result?.seeded || 0;
            }
            if (totalSeeded > 0) toast.success(`Seeded ${totalSeeded} new assets`);
            else toast.info("All courses already seeded");
          }}>
            <RefreshCw className="h-3 w-3 mr-1" /> Seed
          </Button>
        </div>
      </div>
    );
  }

  const courseCode = COURSES.find(c => c.id === current?.course_id)?.code || "";

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen overflow-hidden relative bg-background">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-[55] h-10 bg-card/95 backdrop-blur border-b border-border flex items-center px-3 gap-3">
        <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>

        {/* Course filter */}
        <Select value={effectiveCourseId} onValueChange={handleCourseChange} disabled={isCourseSelectorLocked}>
          <SelectTrigger className="h-6 text-[10px] w-28 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {showAllCoursesOption && <SelectItem value="all">{allCoursesLabel}</SelectItem>}
            {availableCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Chapter filter */}
        {effectiveCourseId !== "all" && courseChapters && courseChapters.length > 0 && (
          <Select value={selectedChapterId} onValueChange={handleChapterChange}>
            <SelectTrigger className="h-6 text-[10px] w-32 border-border"><SelectValue placeholder="All chapters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              {courseChapters.map(ch => {
                const cts = chapterStatusCounts?.[ch.id];
                const allClean = cts && cts.total > 0 && cts.pending === 0 && cts.issues === 0;
                const hasIssues = cts && cts.issues > 0;
                const hasPending = cts && cts.pending > 0;
                return (
                  <SelectItem key={ch.id} value={ch.id}>
                    <span className="flex items-center gap-1.5">
                      {allClean ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : hasIssues ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      ) : hasPending ? (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                      ) : null}
                      Ch {ch.chapter_number}
                      {cts && <span className="text-muted-foreground ml-1">({cts.clean}/{cts.total})</span>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {/* Source Ref navigator */}
        {sourceRefGroups.length > 0 && (
          <Popover open={sourceRefOpen} onOpenChange={setSourceRefOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 h-6 px-2 text-[10px] border border-border rounded hover:bg-accent transition-colors shrink-0">
                <List className="h-3 w-3" />
                <span>{assetDetail?.source_ref || current?.asset_name || "Jump"}</span>
                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="start">
              <div className="overflow-y-auto" style={{ maxHeight: "min(420px, 70vh)" }}>
                <div className="p-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between px-2 pb-1.5 border-b border-border mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source Ref</span>
                    <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                      <span className="w-6 text-center" title="Clean">✅</span>
                      <span className="w-6 text-center" title="Issues">⚠️</span>
                      <span className="w-6 text-center" title="Pending">○</span>
                    </div>
                  </div>
                  {sourceRefGroups.map(group => (
                    <div key={group.label} className="mb-2">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">{group.label}</p>
                      {group.items.map(item => {
                        const isActive = item.assetIndex === currentIndex;
                        const isClean = item.status === "reviewed_clean";
                        const isIssues = item.status === "reviewed_issues";
                        const isPend = item.status === "pending";
                        return (
                          <button
                            key={item.assetName}
                            onClick={() => { setCurrentIndex(item.assetIndex); setSourceRefOpen(false); }}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-left text-[11px] transition-colors ${
                              isActive ? "bg-accent font-semibold" : "hover:bg-accent/50"
                            }`}
                          >
                            <span className="truncate">{item.sourceRef || item.assetName}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="w-6 text-center">{isClean ? <CheckCircle2 className="h-3 w-3 text-emerald-500 inline" /> : <span className="text-muted-foreground/20">–</span>}</span>
                              <span className="w-6 text-center">{isIssues ? <AlertTriangle className="h-3 w-3 text-amber-500 inline" /> : <span className="text-muted-foreground/20">–</span>}</span>
                              <span className="w-6 text-center">{isPend ? <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" /> : <span className="text-muted-foreground/20">–</span>}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Progress value={progress} className="flex-1 h-1.5 max-w-[200px]" />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {totalReviewed}/{totalAll} done · {totalPending} left
          </span>
        </div>
        <button
          onClick={() => setSopOpen(v => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Info className="h-3 w-3" />
          <span>How This Works</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${sopOpen ? "rotate-180" : ""}`} />
        </button>
        <a
          href="/inbox"
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline shrink-0"
        >
          Go to Issues →
        </a>
        <span className="text-[10px] text-muted-foreground shrink-0">👤 {reviewerName}</span>
        <button
          onClick={() => { localStorage.removeItem("qa-reviewer-name"); setReviewerName(""); }}
          className="text-[9px] text-muted-foreground/50 hover:text-foreground"
        >
          Switch
        </button>
      </div>

      {/* VA SOP Panel — slides down from top bar */}
      {sopOpen && (
        <div className="fixed top-10 left-0 right-0 z-[54]">
          <div className="bg-card/98 backdrop-blur border-b border-border px-6 py-4 space-y-3">
            <div className="grid gap-3 max-w-3xl">
              <div className="flex gap-3">
                <span className="text-xs font-bold text-primary shrink-0 pt-0.5">1</span>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">QA Review</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Work through your assigned assets using the review tool below. For each asset, compare the solution page against the textbook screenshot and review all solution toggles. If anything looks wrong — numbers off, missing section, formatting issue, wrong method — log it using Report Issue. Describe the problem clearly, then move on.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xs font-bold text-primary shrink-0 pt-0.5">2</span>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">Issue Inbox</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Open the Issue Inbox to work through your open issues. For each issue: if it's a simple text correction, fix it directly and submit — it goes live immediately. If it needs AI regeneration, use the regeneration tool, review the before/after, and submit if it looks right. If you're not sure, mark it as 'Needs Lee' and skip. Do not guess.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xs font-bold text-primary shrink-0 pt-0.5">3</span>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">Send Fix Report</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">At the end of each sprint, hit Send Report. Lee receives an email listing every fix you've submitted — what was wrong, what changed, and how it was fixed. Lee reviews after the fact.</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 italic">Fixes go live to students immediately. If you're unsure about anything, always choose 'Needs Lee' over guessing.</p>
          </div>
        </div>
      )}

      {/* Full-screen iframe — PAID version (no preview param) with ref=lw for DRM bypass */}
      {current && (
        <iframe
          ref={iframeRef}
          key={current.asset_name}
          src={`/solutions/${current.asset_name}?ref=lw&qa=1`}
          className="w-full h-full border-0 pt-10"
          title={`Solutions: ${current.asset_name}`}
        />
      )}

      {/* Hidden preload iframe for next asset */}
      {allAssets[currentIndex + 1] && (
        <iframe
          key={`preload-${allAssets[currentIndex + 1].asset_name}`}
          src={`/solutions/${allAssets[currentIndex + 1].asset_name}?ref=lw&qa=1`}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          title="Preload next"
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Floating QA Modal */}
      <div
        ref={containerRef}
        className={`fixed left-0 top-0 z-50 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden will-change-transform ${
          isMinimized ? "w-[200px]" : "w-[300px] max-h-[85vh]"
        }`}
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      >
        {/* Drag handle + header */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/30 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <GripHorizontal className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="font-bold text-[12px] text-foreground truncate">
              {assetDetail?.chapters ? `Ch ${assetDetail.chapters.chapter_number}` : "—"}
              {" · "}
              {assetDetail?.source_ref || current?.asset_name || "—"}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {!isPending && <Badge className="text-[8px] h-4 px-1 bg-emerald-500/20 text-emerald-400 mr-1">done</Badge>}
            <button onClick={() => setIsMinimized(prev => !prev)} className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {isMinimized ? (
          <div className="p-2 text-center">
            <span className="text-[10px] text-muted-foreground">{currentIndex + 1}/{totalAll}</span>
          </div>
        ) : (
          <>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Nav row: ← Prev | counter | Next → */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={currentIndex <= 0} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[11px] text-muted-foreground font-mono font-medium">{currentIndex + 1} / {totalAll}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={currentIndex >= allAssets.length - 1} onClick={() => setCurrentIndex(i => Math.min(allAssets.length - 1, i + 1))}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={jumpToNextPending} title="Skip to unreviewed [S]">
                  <SkipForward className="h-3 w-3 mr-0.5" /> Skip to Unreviewed →
                </Button>
              </div>

              {/* Asset code - small muted */}
              <div className="px-2.5 py-1 border-b border-border flex items-center justify-end">
                <span className="text-[9px] text-muted-foreground/60 font-mono">{current?.asset_name || ""}</span>
              </div>

              {/* Step 1: Screenshot comparison */}
              {screenshotStep === "pending" && hasScreenshot && (
                <div className="px-2.5 py-2.5 border-b border-border space-y-2">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-destructive" /> Compare with Textbook
                  </p>
                  <div
                    className="w-full max-h-[120px] rounded-lg border border-border overflow-hidden cursor-pointer bg-muted/20 hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxUrl(screenshotUrl!)}
                  >
                    <img src={screenshotUrl!} alt="Textbook" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[11px] text-foreground font-medium">Match textbook?</p>
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1 text-[10px] h-6 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleScreenshotMatch("yes")}>Yes [Y]</Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6 border-amber-500/30 text-amber-600" onClick={() => handleScreenshotMatch("almost")}>~ish [A]</Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6 border-destructive/30 text-destructive" onClick={() => handleScreenshotMatch("no")}>No [N]</Button>
                  </div>
                </div>
              )}

              {/* Step 2: Section checklist */}
              {screenshotStep === "done" && (
                <div className="px-2.5 py-2 space-y-0.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                      Sections ({checkedSections.size}/{sections.length})
                    </p>
                    {sections.length > 0 && checkedSections.size < sections.length && (
                      <button onClick={checkAll} className="text-[9px] text-emerald-500 hover:text-emerald-400 font-medium">Check All ✓</button>
                    )}
                  </div>

                  {sections.map((sec, idx) => {
                    const checked = checkedSections.has(sec.key);
                    return (
                      <div key={sec.key}>
                        <div className="flex items-center gap-1.5 py-1 px-1 rounded group hover:bg-muted/30 transition-colors">
                          <button
                            onClick={() => {
                              setCheckedSections(prev => {
                                const next = new Set(prev);
                                if (next.has(sec.key)) next.delete(sec.key); else next.add(sec.key);
                                return next;
                              });
                            }}
                            className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked ? "bg-emerald-600 border-emerald-600" : "border-border hover:border-foreground/50"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                          </button>
                          <span className={`text-[11px] flex-1 ${checked ? "text-muted-foreground line-through" : "text-foreground"}`}>{sec.label}</span>
                          <span className="text-[8px] text-muted-foreground/40 font-mono">{idx + 1}</span>
                          <button
                            onClick={() => setOpenIssueSection(openIssueSection === sec.label ? null : sec.label)}
                            className="text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5"
                            title={`Report issue with ${sec.label} [Shift+${idx + 1}]`}
                          >
                            Add Issue
                          </button>
                        </div>
                        {openIssueSection === sec.label && current && (
                          <QuickIssueForm
                            section={sec.label} qaAssetId={current.id} assetName={current.asset_name}
                            onSaved={() => { setOpenIssueSection(null); qc.invalidateQueries({ queryKey: ["qa-issues", current.id] }); }}
                            onCancel={() => setOpenIssueSection(null)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Logged issues */}
                  {issueCount > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5">
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                        {issueCount} issue{issueCount !== 1 ? "s" : ""}
                      </p>
                      {currentIssues?.map(issue => (
                        <div key={issue.id} className="flex items-center gap-1.5 text-[10px] bg-amber-500/5 rounded px-1.5 py-1">
                          <span className="text-amber-500 font-medium shrink-0">{issue.section}:</span>
                          <span className="truncate text-foreground/80">{issue.issue_description}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteIssueMutation.mutate(issue.id); }}
                            className="ml-auto shrink-0 p-1 -mr-0.5 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors"
                            title="Remove issue"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Shortcuts */}
              <div className="px-2.5 py-1 border-t border-border">
                <button onClick={() => setShowShortcuts(!showShortcuts)} className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground w-full">
                  {showShortcuts ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />} Keys
                </button>
                {showShortcuts && (
                  <div className="mt-0.5 text-[9px] text-muted-foreground/60 space-y-0">
                    <p><kbd className="font-mono bg-muted px-0.5 rounded">1-7</kbd> check · <kbd className="font-mono bg-muted px-0.5 rounded">⇧+#</kbd> issue</p>
                    <p><kbd className="font-mono bg-muted px-0.5 rounded">→</kbd> next · <kbd className="font-mono bg-muted px-0.5 rounded">←</kbd> prev · <kbd className="font-mono bg-muted px-0.5 rounded">S</kbd> skip</p>
                    <p><kbd className="font-mono bg-muted px-0.5 rounded">Enter/Space</kbd> submit & next</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky bottom action */}
            <div className="shrink-0 border-t border-border bg-card px-2.5 py-2 space-y-1">
              {screenshotStep === "done" && (
                <>
                  {issueCount === 0 ? (
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={() => markAndAdvance()}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> All Good — Next →
                    </Button>
                  ) : (
                    <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs h-8" onClick={() => markAndAdvance("reviewed_issues")}>
                      <AlertTriangle className="h-3 w-3 mr-1" /> Save {issueCount} Issue{issueCount !== 1 ? "s" : ""} & Next →
                    </Button>
                  )}
                </>
              )}
              {current?.teaching_asset_id && canUseFixer && (
                <Button
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={() => setFixAssetOpen(true)}
                >
                  <Wrench className="h-3 w-3 mr-1" /> Fix This Asset
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fix Asset Modal */}
      {fixAssetOpen && current?.teaching_asset_id && (
        <QAFixAssetModal
          teachingAssetId={current.teaching_asset_id}
          assetName={current.asset_name}
          reviewerName={reviewerName}
          onClose={() => setFixAssetOpen(false)}
          onComplete={() => {
            setFixAssetOpen(false);
            qc.invalidateQueries({ queryKey: ["qa-asset-detail", current.teaching_asset_id] });
            qc.invalidateQueries({ queryKey: ["qa-assets"] });
            // Mark as clean if no remaining issues
            if (issueCount === 0) {
              supabase.from("solutions_qa_assets" as any)
                .update({ qa_status: "reviewed_clean", reviewed_at: new Date().toISOString(), reviewed_by: reviewerName })
                .eq("id", current.id);
            }
          }}
        />
      )}
    </div>
  );
}
