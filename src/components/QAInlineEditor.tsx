import { useState, useRef, useEffect, useCallback } from "react";
import { Edit3, Save, X, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Edit Button ────────────────────────────────────────────────────

export function QAEditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
      style={{
        background: "rgba(59, 130, 246, 0.1)",
        color: "#3B82F6",
        border: "1px solid rgba(59, 130, 246, 0.25)",
      }}
      title="Edit this section"
    >
      <Edit3 className="h-3 w-3" /> Edit
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function wrapSelection(
  ta: HTMLTextAreaElement,
  value: string,
  marker: string
): string {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = value.substring(start, end);

  if (selected) {
    // Toggle: unwrap if already wrapped
    if (selected.startsWith(marker) && selected.endsWith(marker)) {
      const unwrapped = selected.slice(marker.length, -marker.length);
      const nv = value.substring(0, start) + unwrapped + value.substring(end);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = start;
        ta.selectionEnd = start + unwrapped.length;
      });
      return nv;
    }
    // Also check if surrounding text has the markers
    const bStart = start - marker.length;
    const aEnd = end + marker.length;
    if (
      bStart >= 0 &&
      aEnd <= value.length &&
      value.substring(bStart, start) === marker &&
      value.substring(end, aEnd) === marker
    ) {
      const nv = value.substring(0, bStart) + selected + value.substring(aEnd);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = bStart;
        ta.selectionEnd = bStart + selected.length;
      });
      return nv;
    }
    // Wrap
    const nv = value.substring(0, start) + marker + selected + marker + value.substring(end);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start;
      ta.selectionEnd = end + marker.length * 2;
    });
    return nv;
  } else {
    // No selection: insert markers, cursor between
    const nv = value.substring(0, start) + marker + marker + value.substring(end);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + marker.length;
      ta.selectionEnd = start + marker.length;
    });
    return nv;
  }
}

function toggleLinePrefix(
  ta: HTMLTextAreaElement,
  value: string,
  mode: "bullet" | "number"
): string {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const actualEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.substring(lineStart, actualEnd);
  const lines = block.split("\n");

  const allPrefixed = lines.every((l) =>
    mode === "bullet" ? /^- /.test(l) : /^\d+\. /.test(l)
  );

  const transformed = lines
    .map((line, i) => {
      if (allPrefixed) {
        // Remove prefix
        return mode === "bullet"
          ? line.replace(/^- /, "")
          : line.replace(/^\d+\. /, "");
      }
      // Add prefix
      const stripped =
        mode === "bullet"
          ? line.replace(/^- /, "")
          : line.replace(/^\d+\. /, "");
      return mode === "bullet" ? `- ${stripped}` : `${i + 1}. ${stripped}`;
    })
    .join("\n");

  const nv = value.substring(0, lineStart) + transformed + value.substring(actualEnd);
  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = lineStart;
    ta.selectionEnd = lineStart + transformed.length;
  });
  return nv;
}

function stripAllFormatting(text: string): string {
  let t = text;
  // Bold **text** → text
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  // Italic *text* → text (but not **)
  t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
  // Backtick code `text` → text
  t = t.replace(/`([^`]+)`/g, "$1");
  // Triple backtick code blocks → plain text
  t = t.replace(/```[\s\S]*?```/g, (m) => {
    return m.replace(/```\w*\n?/g, "").replace(/```/g, "");
  });
  // Header prefixes
  t = t.replace(/^#{1,3}\s+/gm, "");
  // Bullet prefixes
  t = t.replace(/^- /gm, "");
  // Numbered prefixes
  t = t.replace(/^\d+\. /gm, "");
  // bg: tags
  t = t.replace(/<bg:(red|yellow)>(.*?)<\/bg:\1>/g, "$2");
  // HTML tags
  t = t.replace(/<[^>]+>/g, "");
  // Collapse 3+ blank lines → 2
  t = t.replace(/\n{3,}/g, "\n\n");
  // Trim trailing whitespace per line
  t = t.replace(/[ \t]+$/gm, "");
  return t;
}

function fixSpacing(text: string): string {
  let t = text;
  // Trim trailing spaces per line
  t = t.replace(/[ \t]+$/gm, "");
  // Blank line before step labels
  t = t.replace(/([^\n])\n(Step \d+:)/g, "$1\n\n$2");
  // Blank line before/after monospace blocks (```)
  t = t.replace(/([^\n])\n(```)/g, "$1\n\n$2");
  t = t.replace(/(```)\n([^\n])/g, "$1\n\n$2");
  // Blank line between lettered parts (a), (b), (c)
  t = t.replace(/([^\n])\n(\([a-z]\))/g, "$1\n\n$2");
  // Normalize: collapse 3+ blank lines → 2
  t = t.replace(/\n{3,}/g, "\n\n");
  // Remove blank lines at start/end
  t = t.replace(/^\n+/, "").replace(/\n+$/, "");
  return t;
}

// ── Toolbar Button ──────────────────────────────────────────────────

function ToolbarBtn({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-2 rounded text-[11px] font-semibold transition-colors"
      style={{
        background: "transparent",
        border: "1px solid #D1D5DB",
        color: "#14213D",
      }}
      title={title}
    >
      {label}
    </button>
  );
}

// ── Inline Editor Panel ─────────────────────────────────────────────

interface QAInlineEditorProps {
  initialValue: string;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  label: string;
  rows?: number;
  teachingAssetId?: string;
  onRegenerated?: () => void;
}

export function QAInlineEditorPanel({ initialValue, onSave, onCancel, label, rows = 12, teachingAssetId, onRegenerated }: QAInlineEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [showStripConfirm, setShowStripConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenState, setRegenState] = useState<"idle" | "loading" | "review">("idle");
  const [regenResult, setRegenResult] = useState<string | null>(null);
  const [regenSnapshot, setRegenSnapshot] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [regenCooldown, setRegenCooldown] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cooldown timer for regenerate button
  useEffect(() => {
    if (regenCooldown <= 0) return;
    const timer = setInterval(() => {
      setRegenCooldown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [regenCooldown]);

  const handleRegenerate = async () => {
    if (!teachingAssetId) return;
    setShowRegenConfirm(false);
    setRegenState("loading");

    try {
      // 1. Snapshot
      const { data: snapData, error: snapErr } = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, action: "snapshot", sections: ["solution"] },
      });
      if (snapErr) throw new Error(snapErr.message || "Snapshot failed");
      setRegenSnapshot(snapData.snapshot);

      // 2. Run regeneration with Opus
      const fixPrompt = `Completely rewrite this accounting explanation from scratch.
Use ONLY the problem text and instructions as your source.
Do not reference any previous explanation.
Rules:
- Company name: Survive Company
- US GAAP only
- Show every step — never skip to the answer
- All calculations in monospace format
- Journal entries must balance (debits = credits)
- Second-person "you" voice throughout
- No AI thinking traces, no self-correction, no hedging
- If a figure cannot be derived from the problem text, write [NEEDS LEE — insufficient data]
- Output must read like a confident human tutor who knew the answer immediately`;

      const { data: runData, error: runErr } = await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          action: "run",
          sections: ["solution"],
          fix_prompt: fixPrompt,
          model: "opus",
        },
      });
      if (runErr) throw new Error(runErr.message || "Regeneration failed");

      const newSolution = runData?.after?.solution?.survive_solution_text;
      if (!newSolution) throw new Error("No solution returned");

      setRegenResult(newSolution);
      setValue(newSolution);
      setRegenState("review");
      setRegenCooldown(60);
    } catch (err: any) {
      console.error("Regenerate error:", err);
      toast.error(`Regeneration failed: ${err.message}`);
      setRegenState("idle");
    }
  };

  const handleRegenApprove = async () => {
    if (!teachingAssetId) return;
    setSaving(true);
    try {
      const vaName = localStorage.getItem("sa_reviewer_name") || "VA";
      const timestamp = new Date().toISOString().slice(0, 16);

      // Save + approve
      const { error } = await supabase
        .from("teaching_assets")
        .update({
          survive_solution_text: value,
          fix_status: "fix_verified",
          reviewed_issues: false,
          last_reviewed_by: vaName,
          last_reviewed_at: new Date().toISOString(),
        })
        .eq("id", teachingAssetId);
      if (error) throw error;

      // Append fix note
      await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          action: "approve",
          fix_prompt: `VA Opus regeneration — ${vaName} — ${timestamp}`,
          reviewer_name: vaName,
        },
      });

      toast.success("Regenerated solution approved & saved");
      setRegenState("idle");
      setRegenResult(null);
      setRegenSnapshot(null);
      onRegenerated?.();
    } catch (err: any) {
      toast.error(`Approve failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenRestore = async () => {
    if (!teachingAssetId || !regenSnapshot) return;
    try {
      const { error } = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, action: "restore", snapshot: regenSnapshot },
      });
      if (error) throw new Error(typeof error === "string" ? error : error.message || "Restore failed");

      const original = regenSnapshot?.solution?.survive_solution_text;
      if (typeof original === "string") setValue(original);

      toast.success("Original restored ✓");
      setRegenState("idle");
      setRegenResult(null);
      setRegenSnapshot(null);
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message}`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      toast.success(`${label} updated`);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = value !== initialValue;
  const wordCount = countWords(value);
  const charCount = value.length;

  const flash = (msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 2000);
  };

  const doWrap = useCallback(
    (marker: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      setValue((v) => wrapSelection(ta, v, marker));
    },
    []
  );

  const doLinePrefix = useCallback(
    (mode: "bullet" | "number") => {
      const ta = textareaRef.current;
      if (!ta) return;
      setValue((v) => toggleLinePrefix(ta, v, mode));
    },
    []
  );

  const insertBlankLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    setValue((v) => v.substring(0, pos) + "\n\n" + v.substring(pos));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = pos + 2;
      ta.selectionEnd = pos + 2;
    });
  }, []);

  const applyBgTag = useCallback((color: "red" | "yellow" | "clear") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const actualEnd = lineEnd === -1 ? value.length : lineEnd;
    const selectedLines = value.substring(lineStart, actualEnd);

    const transformed = selectedLines
      .split("\n")
      .map((line) => {
        const stripped = line.replace(/<bg:(red|yellow)>(.*?)<\/bg:\1>/g, "$2");
        if (color === "clear") return stripped;
        return `<bg:${color}>${stripped}</bg:${color}>`;
      })
      .join("\n");

    const newVal = value.substring(0, lineStart) + transformed + value.substring(actualEnd);
    setValue(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = lineStart;
      ta.selectionEnd = lineStart + transformed.length;
    });
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "b") {
      e.preventDefault();
      doWrap("**");
    } else if (mod && e.key === "i") {
      e.preventDefault();
      doWrap("*");
    } else if (mod && e.key === "m") {
      e.preventDefault();
      doWrap("`");
    } else if (mod && e.key === "s") {
      e.preventDefault();
      if (hasChanges) handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const wordCountColor =
    wordCount < 100
      ? "#D97706"
      : wordCount > 800
      ? "#D97706"
      : "#9CA3AF";
  const wordCountSuffix =
    wordCount < 100
      ? " · possibly incomplete"
      : wordCount > 800
      ? " · possibly too long"
      : "";

  return (
    <div
      className="rounded-lg overflow-hidden my-3 animate-in slide-in-from-top-2 duration-200"
      style={{ border: "2px solid #3B82F6", background: "#FAFBFF" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "rgba(59, 130, 246, 0.08)", borderBottom: "1px solid rgba(59, 130, 246, 0.15)" }}
      >
        <span className="text-[12px] font-bold" style={{ color: "#1E40AF" }}>
          ✏️ Editing: {label}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Strip Formatting */}
          <button
            onClick={() => setShowStripConfirm(true)}
            className="text-[10px] px-2 py-0.5 rounded transition-colors"
            style={{ border: "1px solid #D1D5DB", color: "#6B7280", background: "transparent" }}
          >
            Strip Formatting
          </button>
          {/* Fix Spacing */}
          <button
            onClick={() => {
              setValue((v) => fixSpacing(v));
              flash("Spacing fixed ✓");
            }}
            className="text-[10px] px-2 py-0.5 rounded transition-colors"
            style={{ border: "1px solid #D1D5DB", color: "#6B7280", background: "transparent" }}
          >
            Fix Spacing
          </button>
          <button
            onClick={() => setPreview(!preview)}
            className="text-[10px] px-2 py-0.5 rounded transition-colors"
            style={{
              background: preview ? "rgba(59, 130, 246, 0.15)" : "transparent",
              color: "#3B82F6",
            }}
          >
            {preview ? "Edit" : "Preview"}
          </button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="h-6 text-[11px] px-2.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 text-[11px] px-1.5">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Strip Confirm Dialog */}
      {showStripConfirm && (
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: "#FEF3C7", borderBottom: "1px solid #F59E0B" }}
        >
          <span className="text-[11px]" style={{ color: "#92400E" }}>
            Remove all formatting? Text content will be preserved.
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                setValue((v) => stripAllFormatting(v));
                setShowStripConfirm(false);
                flash("Formatting stripped ✓");
              }}
              className="text-[10px] px-2 py-0.5 rounded font-medium"
              style={{ background: "#DC2626", color: "#fff" }}
            >
              Confirm
            </button>
            <button
              onClick={() => setShowStripConfirm(false)}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ border: "1px solid #D1D5DB", color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Flash message */}
      {flashMsg && (
        <div className="px-3 py-1.5 text-[11px] font-medium" style={{ background: "#ECFDF5", color: "#059669" }}>
          {flashMsg}
        </div>
      )}

      {/* Formatting Toolbar */}
      {!preview && (
        <div
          className="flex items-center gap-1 px-3 py-1.5 flex-wrap"
          style={{ borderBottom: "1px solid rgba(59, 130, 246, 0.1)" }}
        >
          <ToolbarBtn label="B" title="Bold (⌘B)" onClick={() => doWrap("**")} />
          <ToolbarBtn label="I" title="Italic (⌘I)" onClick={() => doWrap("*")} />
          <ToolbarBtn label="M" title="Monospace (⌘M)" onClick={() => doWrap("`")} />
          <ToolbarBtn label="1." title="Numbered list" onClick={() => doLinePrefix("number")} />
          <ToolbarBtn label="•" title="Bullet list" onClick={() => doLinePrefix("bullet")} />
          <ToolbarBtn label="¶" title="Insert blank line" onClick={insertBlankLine} />
          <ToolbarBtn
            label="↕"
            title="Toggle expand"
            onClick={() => setExpanded((e) => !e)}
          />

          <span className="mx-1 h-4 w-px" style={{ background: "#E5E7EB" }} />
          <span className="text-[10px] mr-1" style={{ color: "#9CA3AF" }}>BG:</span>
          <button
            onClick={() => applyBgTag("red")}
            className="h-7 px-2 rounded text-[10px] font-medium transition-colors"
            style={{ background: "#FEF2F2", border: "1px solid #CE1126", color: "#991B1B" }}
            title="Red background"
          >
            🔴 Red
          </button>
          <button
            onClick={() => applyBgTag("yellow")}
            className="h-7 px-2 rounded text-[10px] font-medium transition-colors"
            style={{ background: "#FEFCE8", border: "1px solid #D97706", color: "#92400E" }}
            title="Yellow highlight"
          >
            🟡 Yellow
          </button>
          <button
            onClick={() => applyBgTag("clear")}
            className="h-7 px-2 rounded text-[10px] font-medium transition-colors"
            style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", color: "#6B7280" }}
            title="Clear background"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <div className="p-3">
        {preview ? (
          <div
            className="text-[14px] leading-[1.7] whitespace-pre-wrap min-h-[80px] p-3 rounded"
            style={{ background: "#fff", border: "1px solid #E5E7EB", color: "#1A1A1A" }}
          >
            {value.split(/(\*\*.*?\*\*)/g).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            ) || "(empty)"}
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={expanded ? 20 : 8}
            className="text-[13px] leading-[1.7] font-mono resize-y min-h-[120px]"
            style={{ background: "#fff", border: "1px solid #D1D5DB", color: "#1A1A1A" }}
            onKeyDown={handleKeyDown}
          />
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px]" style={{ color: "#9CA3AF" }}>
            {hasChanges ? "⚡ Unsaved changes" : "No changes"} · ⌘S save · ⌘B bold · ⌘I italic · ⌘M mono · Esc cancel
          </span>
          <span className="text-[10px]" style={{ color: wordCountColor }}>
            {charCount} characters · {wordCount} words{wordCountSuffix}
          </span>
        </div>
      </div>

      {/* Regenerate Solution Section */}
      {teachingAssetId && label.toLowerCase().includes("explanation") && (
        <>
          <Separator className="opacity-40" />

          {/* Regen Confirm Dialog */}
          {showRegenConfirm && (
            <div className="px-4 py-3" style={{ background: "#FFFBEB", borderBottom: "1px solid #F59E0B" }}>
              <p className="text-[12px] font-semibold mb-1.5" style={{ color: "#92400E" }}>
                Regenerate this solution using Claude Opus?
              </p>
              <p className="text-[11px] leading-[1.6] mb-2" style={{ color: "#78350F" }}>
                This will rewrite the entire explanation from scratch using the problem text and instructions as source material.
              </p>
              <ul className="text-[11px] leading-[1.6] mb-3 space-y-0.5" style={{ color: "#78350F" }}>
                <li>• Current explanation will be replaced</li>
                <li>• A snapshot will be saved so you can restore if needed</li>
                <li>• Result must be reviewed and approved before saving</li>
                <li>• This uses a more powerful AI model</li>
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  className="text-[11px] font-medium px-3 py-1.5 rounded"
                  style={{ background: "#F59E0B", color: "#fff", border: "none" }}
                >
                  Yes, Regenerate
                </button>
                <button
                  onClick={() => setShowRegenConfirm(false)}
                  className="text-[11px] px-3 py-1.5 rounded"
                  style={{ border: "1px solid #D1D5DB", color: "#6B7280", background: "transparent" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {regenState === "loading" && (
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#FFFBEB" }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#F59E0B" }} />
              <span className="text-[12px] font-medium" style={{ color: "#92400E" }}>
                Regenerating with Opus — this may take 30 seconds…
              </span>
            </div>
          )}

          {/* Review state: approve or restore */}
          {regenState === "review" && regenSnapshot && (
            <div className="px-4 py-3" style={{ background: "#F0FDF4", borderTop: "1px solid #22C55E" }}>
              <p className="text-[12px] font-semibold mb-2" style={{ color: "#166534" }}>
                ✨ Regeneration complete — review the result above, then:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenApprove}
                  disabled={saving}
                  className="text-[11px] font-medium px-3 py-1.5 rounded flex items-center gap-1"
                  style={{ background: "#22C55E", color: "#fff", border: "none", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Approve & Save
                </button>
                <button
                  onClick={handleRegenRestore}
                  className="text-[11px] font-medium px-3 py-1.5 rounded flex items-center gap-1"
                  style={{ background: "#EF4444", color: "#fff", border: "none" }}
                >
                  <RotateCcw className="h-3 w-3" /> Restore Original
                </button>
              </div>
            </div>
          )}

          {/* Trigger button */}
          {regenState === "idle" && !showRegenConfirm && (
            <div className="px-4 py-3">
              <button
                onClick={() => setShowRegenConfirm(true)}
                disabled={regenCooldown > 0}
                className="text-[11px] font-medium px-3 py-1.5 rounded transition-colors w-full"
                style={{
                  border: "1px solid #F59E0B",
                  color: regenCooldown > 0 ? "#D1D5DB" : "#F59E0B",
                  background: "transparent",
                  cursor: regenCooldown > 0 ? "not-allowed" : "pointer",
                  opacity: regenCooldown > 0 ? 0.5 : 1,
                }}
              >
                {regenCooldown > 0
                  ? `Available again in ${regenCooldown}s`
                  : "Looks Wrong? Regenerate Solution →"}
              </button>
              <p className="text-[10px] mt-1 text-center" style={{ color: "#9CA3AF" }}>
                Last resort — uses Opus AI. Review carefully before approving.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ── Instructions Editor ─────────────────────────────────────────────

interface InstructionsEditorProps {
  instructions: { instruction_number: number; instruction_text: string }[];
  teachingAssetId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function QAInstructionsEditor({ instructions, teachingAssetId, onSaved, onCancel }: InstructionsEditorProps) {
  const [items, setItems] = useState(
    instructions.length > 0
      ? instructions.map(i => ({ num: i.instruction_number, text: i.instruction_text }))
      : [{ num: 1, text: "" }]
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, text: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, text } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, { num: prev.length + 1, text: "" }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, num: i + 1 })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing
      await supabase
        .from("problem_instructions")
        .delete()
        .eq("teaching_asset_id", teachingAssetId);

      // Insert new
      const validItems = items.filter(i => i.text.trim());
      if (validItems.length > 0) {
        const { error } = await supabase
          .from("problem_instructions")
          .insert(
            validItems.map((item, idx) => ({
              teaching_asset_id: teachingAssetId,
              instruction_number: idx + 1,
              instruction_text: item.text.trim(),
            }))
          );
        if (error) throw error;
      }
      toast.success("Instructions updated");
      onSaved();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg overflow-hidden my-3 animate-in slide-in-from-top-2 duration-200"
      style={{
        border: "2px solid #3B82F6",
        background: "#FAFBFF",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "rgba(59, 130, 246, 0.08)", borderBottom: "1px solid rgba(59, 130, 246, 0.15)" }}
      >
        <span className="text-[12px] font-bold" style={{ color: "#1E40AF" }}>
          ✏️ Editing: Instructions
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-6 text-[11px] px-2.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 text-[11px] px-1.5">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {items.map((item, idx) => {
          const letter = String.fromCharCode(97 + idx);
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-[13px] font-bold pt-2 shrink-0" style={{ color: "#131E35", width: 24 }}>
                ({letter})
              </span>
              <Textarea
                value={item.text}
                onChange={(e) => updateItem(idx, e.target.value)}
                rows={2}
                className="text-[13px] leading-[1.6] font-mono resize-y flex-1 min-h-[44px]"
                style={{ background: "#fff", border: "1px solid #D1D5DB", color: "#1A1A1A" }}
                placeholder={`Instruction ${letter}...`}
                onKeyDown={(e) => {
                  if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSave();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                  }
                }}
              />
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  className="mt-2 text-red-400 hover:text-red-600 transition-colors"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={addItem}
          className="text-[11px] font-medium px-2 py-1 rounded transition-colors"
          style={{ color: "#3B82F6", background: "rgba(59, 130, 246, 0.08)" }}
        >
          + Add instruction
        </button>
        <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
          ⌘S to save · Esc to cancel
        </p>
      </div>
    </div>
  );
}
