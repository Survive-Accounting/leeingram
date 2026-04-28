import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, GripVertical, X, Plus } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

type Idea = {
  id: string;
  label: string;
  description?: string;
};

const IDEAS: Idea[] = [
  {
    id: "tutoring-shorts",
    label: "Tutoring Shorts from Lee",
    description: "Send Lee a question and get a quick video answer.",
  },
  { id: "memory-games", label: "Memory Games" },
  { id: "formula-memorizer", label: "Formula Memorizer" },
  { id: "flashcards", label: "Flashcards" },
  { id: "full-practice-exams", label: "Full Practice Exams" },
  { id: "mini-quizzes", label: "Mini Quizzes" },
  { id: "live-qa", label: "Live Q&A / Streams" },
  { id: "reddit", label: "Reddit Community" },
  { id: "discord", label: "Discord Channel" },
];

const OTHER_ID = "other";

export default function FeedbackToolModal({
  open,
  email,
  onClose,
}: {
  open: boolean;
  email: string | null;
  onClose: () => void;
  // kept for back-compat; no longer used
  defaultTopic?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [otherIdea, setOtherIdea] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSelected([]);
        setOrder([]);
        setOtherIdea("");
        setExtraNote("");
        setDone(false);
      }, 200);
    }
  }, [open]);

  // Keep order in sync with selection
  useEffect(() => {
    setOrder((prev) => {
      const stillSelected = prev.filter((id) => selected.includes(id));
      const newlyAdded = selected.filter((id) => !prev.includes(id));
      return [...stillSelected, ...newlyAdded];
    });
  }, [selected]);

  if (!open) return null;

  const labelFor = (id: string) => {
    if (id === OTHER_ID) return otherIdea.trim() || "Other Idea";
    return IDEAS.find((i) => i.id === id)?.label ?? id;
  };

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const reorderTo = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setOrder((prev) => {
      const next = prev.filter((x) => x !== dragId);
      const idx = next.indexOf(targetId);
      if (idx === -1) return prev;
      next.splice(idx, 0, dragId);
      return next;
    });
  };

  const moveBy = (id: string, delta: number) => {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const newIdx = idx + delta;
      if (idx === -1 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(idx, 1);
      next.splice(newIdx, 0, it);
      return next;
    });
  };

  const canSubmit = useMemo(() => {
    if (selected.length > 0) return true;
    if (extraNote.trim().length >= 5) return true;
    if (selected.includes(OTHER_ID) && otherIdea.trim().length >= 2) return true;
    return false;
  }, [selected, extraNote, otherIdea]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Pick at least one idea or share a thought.");
      return;
    }
    setSubmitting(true);
    try {
      const ranked = order.map((id, i) => `${i + 1}. ${labelFor(id)}`);
      const lines: string[] = [];
      lines.push("[Beta · Build-Next Prioritization]");
      lines.push("");
      lines.push("Ranked picks:");
      lines.push(ranked.length ? ranked.join("\n") : "(none ranked)");
      if (extraNote.trim()) {
        lines.push("");
        lines.push("Anything we missed:");
        lines.push(extraNote.trim().slice(0, 4000));
      }

      const { error } = await supabase.functions.invoke(
        "send-contact-notification",
        {
          body: {
            email: email || "anonymous@beta",
            message: lines.join("\n"),
            subject: "Beta feedback · What to build next",
          },
        }
      );
      if (error) throw error;
      setDone(true);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden my-auto"
        style={{
          border: "1px solid #E0E7F0",
          fontFamily: "Inter, sans-serif",
          maxHeight: "calc(100vh - 3rem)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <p
            className="text-[11px] uppercase tracking-widest"
            style={{ color: RED, fontWeight: 700 }}
          >
            Help us decide
          </p>
          <h3
            className="mt-1 text-[22px] leading-tight"
            style={{
              color: NAVY,
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
            }}
          >
            What should we build next?
          </h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "#64748B" }}>
            Pick the tools you'd actually use — then rank your favorites.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="px-6 pb-2 overflow-y-auto" style={{ flex: 1 }}>
          {/* Section 1: Choose */}
          <SectionHeader
            step={1}
            title="Choose anything you'd want"
            hint={
              selected.length
                ? `${selected.length} selected`
                : "Tap to select"
            }
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {IDEAS.map((idea) => {
              const active = selected.includes(idea.id);
              return (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => toggle(idea.id)}
                  disabled={submitting || done}
                  title={idea.description}
                  className="text-[12.5px] font-medium rounded-full px-3 py-1.5 transition-all inline-flex items-center gap-1.5"
                  style={{
                    background: active ? NAVY : "#F1F5F9",
                    color: active ? "#fff" : "#475569",
                    border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                    boxShadow: active
                      ? "0 4px 10px rgba(20,33,61,0.18)"
                      : "none",
                  }}
                >
                  {active && <Check className="h-3 w-3" />}
                  {idea.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggle(OTHER_ID)}
              disabled={submitting || done}
              className="text-[12.5px] font-medium rounded-full px-3 py-1.5 transition-all inline-flex items-center gap-1.5"
              style={{
                background: selected.includes(OTHER_ID) ? NAVY : "#fff",
                color: selected.includes(OTHER_ID) ? "#fff" : NAVY,
                border: `1.5px dashed ${
                  selected.includes(OTHER_ID) ? NAVY : "#CBD5E1"
                }`,
              }}
            >
              <Plus className="h-3 w-3" />
              Other Idea
            </button>
          </div>

          {/* Tutoring Shorts microcopy */}
          {selected.includes("tutoring-shorts") && (
            <p
              className="mt-2 text-[11.5px]"
              style={{ color: "#64748B" }}
            >
              Tutoring Shorts: send Lee a question and get a quick video answer.
            </p>
          )}

          {/* Other idea inline input */}
          {selected.includes(OTHER_ID) && (
            <input
              type="text"
              value={otherIdea}
              onChange={(e) => setOtherIdea(e.target.value)}
              placeholder="Name your idea (e.g., Audio recap)"
              maxLength={80}
              className="mt-3 w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: NAVY,
              }}
              disabled={submitting || done}
            />
          )}

          {/* Section 2: Rank */}
          <div className="mt-6">
            <SectionHeader
              step={2}
              title="Rank your top picks"
              hint="Top 3 is plenty"
            />
            <p
              className="mt-1.5 text-[12.5px]"
              style={{ color: "#64748B" }}
            >
              Drag to rank the ones you'd want most.
            </p>

            {order.length === 0 ? (
              <div
                className="mt-3 rounded-xl px-4 py-5 text-center text-[12.5px]"
                style={{
                  background: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  color: "#94A3B8",
                }}
              >
                Pick a few ideas above, then drag to rank them here.
              </div>
            ) : (
              <ol className="mt-3 space-y-2">
                {order.map((id, idx) => {
                  const isTop3 = idx < 3;
                  return (
                    <li
                      key={id}
                      draggable={!submitting && !done}
                      onDragStart={() => setDragId(id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        reorderTo(id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing"
                      style={{
                        background: isTop3 ? "#fff" : "#F8FAFC",
                        border: `1px solid ${isTop3 ? "#D9E0EC" : "#E2E8F0"}`,
                        boxShadow: isTop3
                          ? "0 4px 12px rgba(20,33,61,0.06)"
                          : "none",
                        opacity: dragId === id ? 0.5 : 1,
                      }}
                    >
                      <GripVertical
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: "#94A3B8" }}
                      />
                      <span
                        className="inline-flex items-center justify-center rounded-md text-[11px] font-bold flex-shrink-0"
                        style={{
                          width: 22,
                          height: 22,
                          background: isTop3 ? NAVY : "#E2E8F0",
                          color: isTop3 ? "#fff" : "#64748B",
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className="text-[13px] font-medium flex-1 truncate"
                        style={{ color: NAVY }}
                      >
                        {labelFor(id)}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowBtn
                          dir="up"
                          disabled={idx === 0}
                          onClick={() => moveBy(id, -1)}
                        />
                        <ArrowBtn
                          dir="down"
                          disabled={idx === order.length - 1}
                          onClick={() => moveBy(id, 1)}
                        />
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className="p-1 rounded hover:bg-slate-100"
                          aria-label="Remove"
                        >
                          <X
                            className="h-3.5 w-3.5"
                            style={{ color: "#94A3B8" }}
                          />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Section 3: Anything we missed */}
          <div className="mt-6 mb-2">
            <SectionHeader
              step={3}
              title="Anything we missed?"
              hint="Optional"
            />
            <textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="What would you love us to build?"
              className="mt-3 w-full min-h-[90px] rounded-lg px-3 py-2.5 text-[13.5px] outline-none resize-y"
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: NAVY,
              }}
              disabled={submitting || done}
              maxLength={4000}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-3"
          style={{ borderTop: "1px solid #F1F5F9", background: "#FAFBFC" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-medium"
            style={{ color: "#64748B" }}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || done || !canSubmit}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
            style={{
              background: done
                ? "#15803D"
                : `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              boxShadow: "0 4px 12px rgba(206,17,38,0.20)",
              opacity: !canSubmit && !done ? 0.55 : 1,
              cursor: !canSubmit && !done ? "not-allowed" : "pointer",
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {done && <Check className="h-3.5 w-3.5" />}
            {done ? "Sent — thanks!" : "Send feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center rounded-md text-[10.5px] font-bold"
          style={{
            width: 20,
            height: 20,
            background: NAVY,
            color: "#fff",
          }}
        >
          {step}
        </span>
        <h4
          className="text-[14px] font-semibold tracking-tight"
          style={{ color: NAVY }}
        >
          {title}
        </h4>
      </div>
      {hint && (
        <span
          className="text-[11px] uppercase tracking-widest font-semibold"
          style={{ color: "#94A3B8" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function ArrowBtn({
  dir,
  disabled,
  onClick,
}: {
  dir: "up" | "down";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
      aria-label={dir === "up" ? "Move up" : "Move down"}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{
          color: "#64748B",
          transform: dir === "down" ? "rotate(180deg)" : undefined,
        }}
      >
        <path
          d="M5 2 L8 6 L2 6 Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
