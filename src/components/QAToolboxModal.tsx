import { useState, useCallback } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, X, Loader2, RotateCcw, ExternalLink,
  ChevronDown, ChevronUp, Flag, CheckCircle2, ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Constants ────────────────────────────────────────────────────────

type ToolboxView = "actions" | "fix-input" | "fix-running" | "fix-result";

type OperationType = "standardize" | "remove_thinking" | "remove_duplicates" | "regenerate_missing" | null;

const OPERATIONS: { key: Exclude<OperationType, null>; label: string; icon: string }[] = [
  { key: "standardize", label: "Formatting", icon: "🎨" },
  { key: "remove_thinking", label: "AI Thinking", icon: "🤖" },
  { key: "remove_duplicates", label: "Duplicates", icon: "♻️" },
  { key: "regenerate_missing", label: "Missing Content", icon: "📝" },
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

// ── Props ────────────────────────────────────────────────────────────

interface QAToolboxModalProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetCode: string;       // e.g. "BE17.2"
  teachingAssetId: string;
  chapterLabel?: string;
  chapterName?: string;
  onAdvanceNext?: () => void;
}

export function QAToolboxModal({
  open,
  onClose,
  assetName,
  assetCode,
  teachingAssetId,
  chapterLabel,
  chapterName,
  onAdvanceNext,
}: QAToolboxModalProps) {
  const [view, setView] = useState<ToolboxView>("actions");
  const [operation, setOperation] = useState<OperationType>(null);
  const [fixPrompt, setFixPrompt] = useState("");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(["solution_je"]));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [saving, setSaving] = useState(false);

  // ── Helpers ──
  const appendFixNote = async (note: string) => {
    const { data: current } = await supabase
      .from("teaching_assets")
      .select("fix_notes")
      .eq("id", teachingAssetId)
      .single();
    const prev = (current as any)?.fix_notes || "";
    return prev ? `${prev}\n---\n${note}` : note;
  };

  const closeAndAdvance = () => {
    onClose();
    onAdvanceNext?.();
  };

  // ── Operation selection ──
  const selectOperation = (op: OperationType) => {
    setOperation(op);
    if (op) {
      setFixPrompt(OPERATION_PROMPTS[op] || "");
    }
  };

  const canRun = operation !== null;

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
    setView("fix-running");

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
      setView("fix-result");
    } catch (err: any) {
      toast.error("Fix failed: " + err.message);
      setView("fix-input");
    }
  };

  // ── Actions ──
  const handleMarkReady = async () => {
    setSaving(true);
    try {
      // If we ran a fix, approve it first
      if (snapshot) {
        await supabase.functions.invoke("fix-asset", {
          body: { teaching_asset_id: teachingAssetId, fix_prompt: fixPrompt.trim(), action: "approve" },
        });
      }
      const ts = new Date().toISOString();
      const notes = await appendFixNote(`Marked ready by VA — ${ts}`);
      await supabase.from("teaching_assets").update({
        fix_status: "ready_for_students",
        fix_notes: notes,
      } as any).eq("id", teachingAssetId);

      const colors = ['#14213D', '#CE1126', '#FFFFFF'];
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.15, y: 0.9 }, colors });
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.85, y: 0.9 }, colors });
      toast.success("🎉 Ready for students!");
      setTimeout(() => closeAndAdvance(), 1500);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    setSaving(true);
    try {
      if (snapshot) {
        await supabase.functions.invoke("fix-asset", {
          body: { teaching_asset_id: teachingAssetId, fix_prompt: fixPrompt.trim(), action: "approve" },
        });
      }
      const { data: current } = await supabase
        .from("teaching_assets")
        .select("fix_notes, source_ref, asset_name")
        .eq("id", teachingAssetId)
        .single();
      const ts = new Date().toISOString();
      const notes = await appendFixNote(`Fix submitted for review — ${ts}`);
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
          slack_message: `🔍 *${sourceRef}* fix ready for review\n${an}\nhttps://learn.surviveaccounting.com/solutions/${an}?admin=true`,
        },
      });
      toast.success("Sent to Lee ✓");
      setTimeout(() => closeAndAdvance(), 1500);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNeedsLee = async () => {
    setSaving(true);
    try {
      const { data: current } = await supabase
        .from("teaching_assets")
        .select("fix_notes, source_ref, asset_name")
        .eq("id", teachingAssetId)
        .single();
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
          slack_message: `🚩 *${sourceRef}* needs Lee's attention\nhttps://learn.surviveaccounting.com/solutions/${an}?admin=true`,
        },
      });
      toast.success("🚩 Lee notified");
      setTimeout(() => closeAndAdvance(), 1500);
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
    setView("fix-input");
    setSnapshot(null);
  };

  const resetAll = useCallback(() => {
    setView("actions");
    setOperation(null);
    setFixPrompt("");
    setSnapshot(null);
    setAttemptNumber(1);
    setAdvancedOpen(false);
    setSelectedSections(new Set(["solution_je"]));
  }, []);

  // Reset when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      resetAll();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px] p-0 gap-0 overflow-hidden" style={{ borderRadius: 12 }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ backgroundColor: "#14213D" }}
        >
          <div>
            <p className="text-[15px] font-bold text-white">QA Toolbox</p>
            <p className="text-[11px] text-white/60">
              {assetCode}{chapterLabel ? ` · ${chapterLabel}` : ""}{chapterName ? ` · ${chapterName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-4">

            {/* ── STATE: Default actions ── */}
            {view === "actions" && (
              <>
                {/* Save Issues & Next */}
                <button
                  onClick={closeAndAdvance}
                  className="w-full rounded-lg px-4 py-3 text-[13px] font-medium transition-all border flex items-center gap-2"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  <ArrowRight className="h-4 w-4" />
                  <div className="text-left">
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>Save Issues & Next</p>
                    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Log issues and move to next asset</p>
                  </div>
                </button>

                {/* Fix This Page Now */}
                <button
                  onClick={() => { setView("fix-input"); }}
                  className="w-full rounded-lg px-4 py-3.5 text-[14px] font-bold transition-all flex items-center gap-2 text-white"
                  style={{
                    backgroundColor: "#14213D",
                    boxShadow: "0 2px 12px rgba(20,33,61,0.3)",
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  <div className="text-left">
                    <p>✨ Fix This Page Now</p>
                    <p className="text-[10px] font-normal text-white/60">AI will attempt a fix</p>
                  </div>
                </button>

                {/* Mark Ready for Students */}
                <button
                  onClick={handleMarkReady}
                  disabled={saving}
                  className="w-full rounded-lg px-4 py-3.5 text-[14px] font-bold transition-all flex items-center gap-2 text-white"
                  style={{
                    backgroundColor: "#10B981",
                    boxShadow: "0 0 16px rgba(16,185,129,0.4)",
                    animation: "pulse 2s infinite",
                  }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <div className="text-left">
                    <p>🎉 Mark Ready for Students</p>
                    <p className="text-[10px] font-normal text-white/70">Looks good — ship it</p>
                  </div>
                </button>

                {/* Needs Lee */}
                <div className="text-center pt-1">
                  <button
                    onClick={handleNeedsLee}
                    disabled={saving}
                    className="text-[12px] font-medium transition-colors"
                    style={{ color: "#D97706", background: "none", border: "none" }}
                  >
                    <span className="flex items-center gap-1 justify-center">
                      <Flag className="h-3 w-3" /> 🚩 Needs Lee
                    </span>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Only if truly stuck</p>
                  </button>
                </div>
              </>
            )}

            {/* ── STATE: Fix input ── */}
            {view === "fix-input" && (
              <>
                <div>
                  <label className="text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>What's the issue?</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
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
                  <p className="text-[10px] mt-2" style={{ color: "var(--muted-foreground)" }}>
                    None of these fit?{" "}
                    <button
                      onClick={handleNeedsLee}
                      disabled={saving}
                      className="inline font-medium hover:underline"
                      style={{ color: "#D97706", background: "none", border: "none", padding: 0 }}
                    >
                      🚩 Needs Lee
                    </button>
                  </p>
                </div>

                <button
                  onClick={runFix}
                  disabled={!canRun}
                  className="w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2 text-white transition-all disabled:opacity-40"
                  style={{ backgroundColor: "#14213D" }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Run Fix →
                </button>

                <button
                  onClick={() => { setView("actions"); setOperation(null); setFixPrompt(""); }}
                  className="w-full text-center text-[11px] font-medium transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  ← Back
                </button>
              </>
            )}

            {/* ── STATE: Running ── */}
            {view === "fix-running" && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>Running fix…</p>
                <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {attemptNumber > 1 ? "Using stronger model (Opus)" : "This may take a minute"}
                </p>
              </div>
            )}

            {/* ── STATE: Fix result ── */}
            {view === "fix-result" && (
              <>
                <div className="rounded-lg p-4 text-center space-y-2" style={{ backgroundColor: "rgba(16,185,129,0.08)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Fix applied. How does it look?</p>
                  <a
                    href={`https://learn.surviveaccounting.com/solutions/${assetName}?admin=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    style={{ color: "#3B82F6" }}
                  >
                    Open in student view → <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Mark Ready */}
                <button
                  onClick={handleMarkReady}
                  disabled={saving}
                  className="w-full rounded-lg px-4 py-3 text-[14px] font-bold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: "#10B981",
                    boxShadow: "0 0 16px rgba(16,185,129,0.4)",
                    animation: "pulse 2s infinite",
                  }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  🎉 Mark Ready for Students
                </button>

                {/* Submit for Review */}
                <button
                  onClick={handleSubmitForReview}
                  disabled={saving}
                  className="w-full rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all border"
                  style={{ borderColor: "#14213D", color: "#14213D" }}
                >
                  🔍 Submit for Lee's Review
                </button>

                {/* Try Again */}
                <button
                  onClick={handleTryAgain}
                  disabled={saving}
                  className="w-full text-center text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <RotateCcw className="h-3 w-3" /> ↩ Try Again
                </button>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
