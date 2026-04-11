import { useState, useRef, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, X, Loader2, RotateCcw, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Constants ────────────────────────────────────────────────────────

type FixStep = "input" | "running" | "compare";

type SectionOption = { key: string; label: string };

const FIX_SECTIONS: SectionOption[] = [
  { key: "solution_je", label: "Solution text + JE reasons" },
  { key: "supplementary_je", label: "Supplementary journal entries" },
  { key: "dissector", label: "Problem dissector highlights" },
  { key: "formulas", label: "Important formulas" },
  { key: "concepts", label: "Key concepts" },
  { key: "traps", label: "Exam traps" },
  { key: "flowchart", label: "Flowchart" },
];

type OperationType = "standardize" | "remove_thinking" | "remove_duplicates" | "regenerate_missing" | "something_else" | null;

const OPERATIONS: { key: OperationType; label: string; icon: string }[] = [
  { key: "standardize", label: "Standardize Formatting", icon: "🎨" },
  { key: "remove_thinking", label: "Remove AI Thinking", icon: "🤖" },
  { key: "remove_duplicates", label: "Remove Duplicates", icon: "♻️" },
  { key: "regenerate_missing", label: "Regenerate Missing", icon: "✨" },
];

const OPERATION_PROMPTS: Record<string, string> = {
  standardize:
    "Reformat the solution text to follow standard textbook formatting. Use consistent headers, numbered steps, clear calculation layouts with proper alignment, and professional accounting terminology. Remove any informal language or inconsistent formatting.",
  remove_thinking:
    "Remove all AI meta-commentary, thinking traces, and reasoning artifacts from the solution text. This includes phrases like 'Let me think about this', 'I need to calculate', 'Based on the information given', or any self-referential language. Keep only the clean, student-facing explanation and calculations.",
  remove_duplicates:
    "Remove any duplicated or redundant content from the solution text and journal entries. If the same calculation, explanation, or journal entry appears more than once, keep only the clearest version. Merge overlapping explanations into a single coherent passage.",
  regenerate_missing:
    "Regenerate any missing content for lettered parts (a), (b), (c) etc. that are referenced in the instructions but not addressed in the solution. For each missing part, provide a complete worked solution with calculations and journal entries where applicable. If data is insufficient to solve a part, mark it with [NEEDS LEE] and explain what's missing.",
};

// ── Panel Props ──────────────────────────────────────────────────────

interface FixThisAssetPanelProps {
  assetName: string;
  assetCode: string;       // display code like "BE17.2"
  teachingAssetId: string;
  chapterLabel?: string;   // e.g. "Ch 17"
  onClose: () => void;
}

export function FixThisAssetPanel({
  assetName,
  assetCode,
  teachingAssetId,
  chapterLabel,
  onClose,
}: FixThisAssetPanelProps) {
  // Drag state
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Fix state
  const [step, setStep] = useState<FixStep>("input");
  const [operation, setOperation] = useState<OperationType>(null);
  const [fixPrompt, setFixPrompt] = useState("");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(["solution_je"]));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [afterData, setAfterData] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [runResults, setRunResults] = useState<{ key: string; ok: boolean; error?: string }[]>([]);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // ── Drag handlers ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    dragging.current = true;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 520, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, []);

  // ── Operation selection ──
  const selectOperation = (op: OperationType) => {
    setOperation(op);
    if (op === "something_else") {
      setFixPrompt("");
    } else if (op) {
      setFixPrompt(OPERATION_PROMPTS[op] || "");
    }
  };

  const canRun = fixPrompt.trim().length >= 20 && operation !== null;

  // ── Toggle sections ──
  const toggleSection = (key: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Run fix ──
  const runFix = async () => {
    const sections = [...selectedSections];
    if (!sections.length) sections.push("solution_je");
    setStep("running");

    try {
      const snapRes = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, sections, action: "snapshot" },
      });
      if (snapRes.error) throw new Error(snapRes.error.message);
      setSnapshot(snapRes.data.snapshot);

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
      setRunResults(runRes.data.results || []);
      setAfterData(runRes.data.after || null);
      setStep("compare");
    } catch (err: any) {
      toast.error("Fix failed: " + err.message);
      setStep("input");
    }
  };

  // ── Post-fix actions ──
  const appendFixNote = async (note: string) => {
    const { data: current } = await supabase.from("teaching_assets").select("fix_notes").eq("id", teachingAssetId).single();
    const prev = (current as any)?.fix_notes || "";
    return prev ? `${prev}\n---\n${note}` : note;
  };

  const handleMarkReady = async () => {
    setSaving(true);
    try {
      await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, fix_prompt: fixPrompt.trim(), action: "approve" },
      });
      const ts = new Date().toISOString();
      const notes = await appendFixNote(`Marked ready by VA — ${ts}`);
      await supabase.from("teaching_assets").update({
        fix_status: "ready_for_students",
        fix_notes: notes,
      } as any).eq("id", teachingAssetId);

      const colors = ['#14213D', '#CE1126', '#FFFFFF'];
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.15, y: 0.6 }, colors });
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.85, y: 0.6 }, colors });
      toast.success("🎉 Ready for students!");
      setIframeKey(k => k + 1);
      resetToInput();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    setSaving(true);
    try {
      await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, fix_prompt: fixPrompt.trim(), action: "approve" },
      });
      const { data: current } = await supabase.from("teaching_assets").select("fix_notes, source_ref, asset_name").eq("id", teachingAssetId).single();
      const ts = new Date().toISOString();
      const notes = await appendFixNote(`Fix submitted for Lee review — ${ts}`);
      await supabase.from("teaching_assets").update({
        fix_status: "pending_lee_review",
        fix_notes: notes,
      } as any).eq("id", teachingAssetId);

      const sourceRef = (current as any)?.source_ref || assetCode;
      const an = (current as any)?.asset_name || assetName;
      await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          action: "notify_slack",
          slack_message: `🔍 *${sourceRef}* — fix submitted for review\n${an}\nhttps://learn.surviveaccounting.com/solutions/${an}?admin=true`,
        },
      });
      toast.success("Sent to Lee");
      resetToInput();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNeedsLee = async () => {
    setSaving(true);
    try {
      const { data: current } = await supabase.from("teaching_assets").select("fix_notes, source_ref, asset_name").eq("id", teachingAssetId).single();
      const ts = new Date().toISOString();
      const notes = await appendFixNote(`Flagged Needs Lee — ${ts}`);
      await supabase.from("teaching_assets").update({
        fix_status: "needs_lee",
        fix_notes: notes,
      } as any).eq("id", teachingAssetId);

      const sourceRef = (current as any)?.source_ref || assetCode;
      const an = (current as any)?.asset_name || assetName;
      await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          action: "notify_slack",
          slack_message: `🚩 *${sourceRef}* needs Lee's attention.\n${an}\nhttps://learn.surviveaccounting.com/solutions/${an}?admin=true`,
        },
      });
      toast.success("🚩 Lee notified");
      onClose();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTryAgain = async () => {
    if (snapshot) {
      try {
        await supabase.functions.invoke("fix-asset", {
          body: { teaching_asset_id: teachingAssetId, snapshot, action: "restore" },
        });
        toast.info("Changes reverted");
      } catch { /* ignore */ }
    }
    setAttemptNumber(prev => prev + 1);
    setStep("input");
    setRunResults([]);
    setAfterData(null);
    setSnapshot(null);
  };

  const resetToInput = () => {
    setStep("input");
    setOperation(null);
    setFixPrompt("");
    setRunResults([]);
    setAfterData(null);
    setSnapshot(null);
    setAttemptNumber(1);
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "(empty)";
    if (typeof val === "string") return val.length > 600 ? val.slice(0, 600) + "…" : val;
    return JSON.stringify(val, null, 2);
  };

  // ── Position ──
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const style: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, zIndex: 9999 }
    : {
        position: "fixed",
        zIndex: 9999,
        width: 520,
        maxHeight: "90vh",
        top: pos ? pos.y : "5vh",
        left: pos ? pos.x : undefined,
        right: pos ? undefined : 24,
      };

  return (
    <div ref={panelRef} style={style} className="bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* ── Header / drag handle ── */}
      <div
        onMouseDown={!isMobile ? onMouseDown : undefined}
        className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 select-none"
        style={{ backgroundColor: "#14213D", cursor: isMobile ? "default" : "grab" }}
      >
        <div>
          <p className="text-[13px] font-bold text-white flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Fix This Page
          </p>
          <p className="text-[10px] text-white/60">{assetCode}{chapterLabel ? ` · ${chapterLabel}` : ""} · {assetName}</p>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      {/* ── Body: two columns ── */}
      <div className="flex flex-1 overflow-hidden" style={{ maxHeight: "calc(90vh - 48px)" }}>
        {/* LEFT: iframe preview */}
        <div className="hidden sm:flex flex-col" style={{ width: "55%", borderRight: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
            <span className="text-[10px] text-muted-foreground font-medium">Student View</span>
            <button onClick={() => setIframeKey(k => k + 1)} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={`https://learn.surviveaccounting.com/solutions/${assetName}?admin=true`}
            className="flex-1 w-full"
            style={{ border: "none", minHeight: 300 }}
          />
        </div>

        {/* RIGHT: controls */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {step === "input" && (
              <>
                {/* Header */}
                <div>
                  <p className="text-sm font-bold text-foreground">{assetCode}</p>
                  <p className="text-[10px] text-muted-foreground">{chapterLabel ? `${chapterLabel} · ` : ""}{assetName}</p>
                </div>

                {/* Operation selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-foreground">What type of fix is this?</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {OPERATIONS.map(op => (
                      <button
                        key={op.key}
                        onClick={() => selectOperation(op.key)}
                        className="rounded-full px-3 py-2 text-[11px] font-semibold transition-all border text-left"
                        style={{
                          backgroundColor: operation === op.key ? "#14213D" : "transparent",
                          color: operation === op.key ? "#FFFFFF" : "var(--muted-foreground)",
                          borderColor: operation === op.key ? "#14213D" : "var(--border)",
                        }}
                      >
                        {op.icon} {op.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => selectOperation("something_else")}
                    className="w-full rounded-full px-3 py-2 text-[11px] font-semibold transition-all border text-left"
                    style={{
                      backgroundColor: operation === "something_else" ? "#14213D" : "transparent",
                      color: operation === "something_else" ? "#FFFFFF" : "var(--muted-foreground)",
                      borderColor: operation === "something_else" ? "#14213D" : "var(--border)",
                    }}
                  >
                    📝 Something Else
                  </button>
                </div>

                {/* Fix prompt */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Describe the fix</label>
                  <Textarea
                    value={fixPrompt}
                    onChange={e => setFixPrompt(e.target.value)}
                    placeholder="Describe exactly what's wrong and how to fix it..."
                    className="text-xs"
                    style={{ minHeight: 120 }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {fixPrompt.trim().length < 20 ? `${20 - fixPrompt.trim().length} more characters needed` : "✓ Ready"}
                  </p>
                </div>

                {/* Advanced sections */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Advanced: sections to regenerate
                    {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {advancedOpen && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {FIX_SECTIONS.map(sec => (
                        <label key={sec.key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={selectedSections.has(sec.key)} onCheckedChange={() => toggleSection(sec.key)} />
                          <span className="text-[11px] text-foreground">{sec.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Run button */}
                <button
                  onClick={runFix}
                  disabled={!canRun}
                  className="w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2 text-white transition-all disabled:opacity-40"
                  style={{
                    backgroundColor: canRun ? "#14213D" : "#14213D",
                    boxShadow: canRun ? "0 2px 12px rgba(20,33,61,0.3)" : "none",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> ✨ Run Fix →
                </button>
              </>
            )}

            {step === "running" && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-medium">Running fix…</p>
                <p className="text-[10px] text-muted-foreground">
                  {attemptNumber > 1 ? "Using stronger model (Opus)" : "This may take a minute"}
                </p>
              </div>
            )}

            {step === "compare" && snapshot && afterData && (
              <>
                {/* Before / After */}
                {[...selectedSections].map(sectionKey => {
                  const before = snapshot[sectionKey] || {};
                  const after = afterData[sectionKey] || {};
                  const result = runResults.find(r => r.key === sectionKey);
                  if (!result?.ok) return null;
                  const sec = FIX_SECTIONS.find(s => s.key === sectionKey);
                  const cols = [...new Set([...Object.keys(before), ...Object.keys(after)])];

                  return (
                    <div key={sectionKey} className="space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground">{sec?.label || sectionKey}</p>
                      {/* Before */}
                      <div className="rounded-md p-2" style={{ backgroundColor: "var(--muted)", maxHeight: 200, overflowY: "auto" }}>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Before</p>
                        {cols.map(col => (
                          <pre key={col} className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words">{formatValue(before[col])}</pre>
                        ))}
                      </div>
                      {/* After */}
                      <div className="rounded-md p-2" style={{ backgroundColor: "rgba(16,185,129,0.08)", maxHeight: 200, overflowY: "auto" }}>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">After</p>
                        {cols.map(col => (
                          <pre key={col} className="text-[10px] text-foreground whitespace-pre-wrap break-words">{formatValue(after[col])}</pre>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {runResults.filter(r => !r.ok).length > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                    <p className="text-[10px] font-bold text-destructive">Some sections failed:</p>
                    {runResults.filter(r => !r.ok).map(r => (
                      <p key={r.key} className="text-[10px] text-destructive">{r.key}: {r.error}</p>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleMarkReady}
                    disabled={saving}
                    className="w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all"
                    style={{
                      animation: "pulse 2s infinite",
                      boxShadow: "0 0 16px rgba(16,185,129,0.4)",
                    }}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> : null}
                    🎉 Mark Ready for Students
                  </button>

                  <button
                    onClick={handleSubmitForReview}
                    disabled={saving}
                    className="w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all border"
                    style={{ borderColor: "#14213D", color: "#14213D" }}
                  >
                    🔍 Submit for Lee's Review
                  </button>

                  <button
                    onClick={handleTryAgain}
                    disabled={saving}
                    className="w-full rounded-lg px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> ↩ Try Again
                  </button>
                </div>

                {/* Needs Lee link */}
                <div className="text-center pt-1">
                  <button
                    onClick={handleNeedsLee}
                    disabled={saving}
                    className="text-[11px] text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    🚩 Flag as Needs Lee instead
                  </button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
