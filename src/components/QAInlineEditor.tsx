import { useState, useRef, useEffect, useCallback } from "react";
import { Edit3, Save, X, Loader2, Bold, Paintbrush, RemoveFormatting } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

// ── Inline Editor Panel ─────────────────────────────────────────────

interface QAInlineEditorProps {
  initialValue: string;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
  label: string;
  rows?: number;
}

export function QAInlineEditorPanel({ initialValue, onSave, onCancel, label, rows = 12 }: QAInlineEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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

  const checkSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setHasSelection(ta.selectionStart !== ta.selectionEnd);
  }, []);

  const wrapSelection = useCallback((before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    if (!selected) return;
    const newVal = `${value.substring(0, start)}${before}${selected}${after}${value.substring(end)}`;
    setValue(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start;
      ta.selectionEnd = end + before.length + after.length;
    });
  }, [value]);

  const toggleBold = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    if (!selected) return;
    // If already bold, unwrap
    if (selected.startsWith("**") && selected.endsWith("**")) {
      const inner = selected.slice(2, -2);
      const newVal = `${value.substring(0, start)}${inner}${value.substring(end)}`;
      setValue(newVal);
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = start; ta.selectionEnd = start + inner.length; });
    } else if (start >= 2 && value.substring(start - 2, start) === "**" && value.substring(end, end + 2) === "**") {
      const newVal = `${value.substring(0, start - 2)}${selected}${value.substring(end + 2)}`;
      setValue(newVal);
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = start - 2; ta.selectionEnd = start - 2 + selected.length; });
    } else {
      wrapSelection("**", "**");
    }
  }, [value, wrapSelection]);

  const clearFormatting = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    if (!selected) return;
    const cleaned = selected.replace(/\*\*/g, "");
    const newVal = `${value.substring(0, start)}${cleaned}${value.substring(end)}`;
    setValue(newVal);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = start; ta.selectionEnd = start + cleaned.length; });
  }, [value]);

  const BG_PRESETS = [
    { label: "Red", color: "#FEF2F2", swatch: "#FECACA" },
    { label: "Yellow", color: "#FEFCE8", swatch: "#FEF08A" },
    { label: "None", color: null, swatch: "transparent" },
  ];

  return (
    <div
      className="rounded-lg overflow-hidden my-3 animate-in slide-in-from-top-2 duration-200"
      style={{
        border: "2px solid #3B82F6",
        background: "#FAFBFF",
      }}
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
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-6 text-[11px] px-1.5"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Formatting toolbar */}
        {!preview && (
          <div className="flex items-center gap-1 mb-2 relative">
            <button
              onClick={toggleBold}
              disabled={!hasSelection}
              className="flex items-center justify-center rounded transition-colors disabled:opacity-30"
              style={{
                width: 28, height: 28,
                background: hasSelection ? "rgba(20,33,61,0.08)" : "transparent",
                color: hasSelection ? "#14213D" : "#9CA3AF",
                border: "1px solid",
                borderColor: hasSelection ? "rgba(20,33,61,0.2)" : "#E5E7EB",
              }}
              title="Bold (⌘B)"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => { if (hasSelection) setBgPickerOpen(!bgPickerOpen); }}
                disabled={!hasSelection}
                className="flex items-center justify-center rounded transition-colors disabled:opacity-30"
                style={{
                  width: 28, height: 28,
                  background: hasSelection ? "rgba(20,33,61,0.08)" : "transparent",
                  color: hasSelection ? "#14213D" : "#9CA3AF",
                  border: "1px solid",
                  borderColor: hasSelection ? "rgba(20,33,61,0.2)" : "#E5E7EB",
                }}
                title="Background color"
              >
                <Paintbrush className="h-3.5 w-3.5" />
              </button>
              {bgPickerOpen && (
                <div
                  className="absolute top-full left-0 mt-1 flex items-center gap-1 p-1.5 rounded-md shadow-lg z-50"
                  style={{ background: "#fff", border: "1px solid #E5E7EB" }}
                >
                  {BG_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setBgPickerOpen(false);
                        // Background color is informational only in raw text — not supported in current renderer
                        toast.info(`Background colors are not yet supported in the renderer`);
                      }}
                      className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                      title={p.label}
                    >
                      <div
                        className="w-4 h-4 rounded border"
                        style={{
                          background: p.swatch,
                          borderColor: p.color ? "#D1D5DB" : "#9CA3AF",
                        }}
                      />
                      <span className="text-[9px]" style={{ color: "#6B7280" }}>{p.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={clearFormatting}
              disabled={!hasSelection}
              className="flex items-center justify-center rounded transition-colors disabled:opacity-30"
              style={{
                width: 28, height: 28,
                background: hasSelection ? "rgba(20,33,61,0.08)" : "transparent",
                color: hasSelection ? "#14213D" : "#9CA3AF",
                border: "1px solid",
                borderColor: hasSelection ? "rgba(20,33,61,0.2)" : "#E5E7EB",
              }}
              title="Clear formatting"
            >
              <RemoveFormatting className="h-3.5 w-3.5" />
            </button>
            <span className="text-[9px] ml-1" style={{ color: "#9CA3AF" }}>Select text first</span>
          </div>
        )}

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
            rows={rows}
            className="text-[13px] leading-[1.7] font-mono resize-y min-h-[120px]"
            style={{
              background: "#fff",
              border: "1px solid #D1D5DB",
              color: "#1A1A1A",
            }}
            onKeyDown={(e) => {
              if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                const ta = textareaRef.current;
                if (!ta) return;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const selected = value.substring(start, end);
                if (selected) {
                  const before = value.substring(0, start);
                  const after = value.substring(end);
                  const newVal = `${before}**${selected}**${after}`;
                  setValue(newVal);
                  requestAnimationFrame(() => {
                    ta.selectionStart = start;
                    ta.selectionEnd = end + 4;
                  });
                }
              }
              if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (hasChanges) handleSave();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px]" style={{ color: "#9CA3AF" }}>
            {hasChanges ? "⚡ Unsaved changes" : "No changes"} · ⌘S to save · Esc to cancel
          </span>
          <span className="text-[10px]" style={{ color: "#9CA3AF" }}>
            {value.length} chars
          </span>
        </div>
      </div>
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
