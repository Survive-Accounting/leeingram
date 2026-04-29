import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, GripVertical, X, Plus, Sparkles, Trophy } from "lucide-react";
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
  const [touchOverId, setTouchOverId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Track ideas the user explicitly removed (after selecting them) for analytics
  const removedRef = useRef<Set<string>>(new Set());
  // Touch drag refs
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSelected([]);
        setOrder([]);
        setOtherIdea("");
        setExtraNote("");
        setDone(false);
        removedRef.current = new Set();
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

  // Note: early return moved below useMemo to keep hook order stable

  const labelFor = (id: string) => {
    if (id === OTHER_ID) return otherIdea.trim() || "Other Idea";
    return IDEAS.find((i) => i.id === id)?.label ?? id;
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        // user removed an idea they had selected
        removedRef.current.add(id);
        return prev.filter((x) => x !== id);
      }
      // re-selecting clears the removed flag
      removedRef.current.delete(id);
      return [...prev, id];
    });
  };

  // Touch drag — find the item under the touch point and reorder
  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (!dragId) return;
    e.preventDefault();
    const t = e.touches[0];
    let overId: string | null = null;
    for (const [otherId, el] of itemRefs.current.entries()) {
      const r = el.getBoundingClientRect();
      if (t.clientY >= r.top && t.clientY <= r.bottom) {
        overId = otherId;
        break;
      }
    }
    if (overId && overId !== id) {
      setTouchOverId(overId);
      reorderTo(overId);
    }
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

  if (!open) return null;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Pick at least one idea or share a thought.");
      return;
    }
    setSubmitting(true);
    try {
      const ranked = order.map((id, i) => `${i + 1}. ${labelFor(id)}`);
      const removed = Array.from(removedRef.current)
        .filter((id) => !selected.includes(id))
        .map(labelFor);
      const customIdea =
        selected.includes(OTHER_ID) && otherIdea.trim()
          ? otherIdea.trim()
          : null;

      const lines: string[] = [];
      lines.push("[Beta · Build-Next Prioritization]");
      lines.push("");
      lines.push(`Selected (${selected.length}): ${selected.map(labelFor).join(", ") || "(none)"}`);
      lines.push("");
      lines.push("Ranked picks:");
      lines.push(ranked.length ? ranked.join("\n") : "(none ranked)");
      if (customIdea) {
        lines.push("");
        lines.push(`Custom idea: ${customIdea}`);
      }
      if (removed.length) {
        lines.push("");
        lines.push(`Removed after selecting: ${removed.join(", ")}`);
      }
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
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        style={{
          border: "1px solid #E0E7F0",
          fontFamily: "Inter, sans-serif",
          maxHeight: "calc(100vh - 3rem)",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 24px 60px -12px rgba(20,33,61,0.35), 0 0 0 1px rgba(20,33,61,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — navy gradient banner */}
        <div
          className="relative px-6 pt-6 pb-5 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, #1E2F52 100%)`,
            color: "#fff",
          }}
        >
          {/* decorative sparkle */}
          <Sparkles
            className="absolute right-5 top-5 opacity-20"
            style={{ width: 56, height: 56 }}
          />
          <div className="relative">
            <p
              className="text-[10.5px] uppercase tracking-[0.18em] font-bold"
              style={{ color: "#FCA5AF" }}
            >
              Vote on Future Tools
            </p>
            <h3
              className="mt-1.5 text-[22px] sm:text-[24px] leading-tight"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              What should we build next?
            </h3>
            <p
              className="mt-1.5 text-[13px]"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              Pick the tools you'd actually use — then rank your favorites.
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="px-6 pt-5 pb-2 overflow-y-auto" style={{ flex: 1 }}>
          {/* Section 1: Choose */}
          <SectionHeader
            step={1}
            title="Choose anything you'd want"
            hint={
              selected.length
                ? `${selected.length} picked`
                : "Tap to add"
            }
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {IDEAS.map((idea) => {
              const active = selected.includes(idea.id);
              return (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => toggle(idea.id)}
                  disabled={submitting || done}
                  title={idea.description}
                  className="text-[12.5px] font-medium rounded-full px-3 py-1.5 transition-all duration-150 inline-flex items-center gap-1.5 hover:-translate-y-px"
                  style={{
                    background: active ? NAVY : "#fff",
                    color: active ? "#fff" : "#334155",
                    border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                    boxShadow: active
                      ? "0 4px 12px rgba(20,33,61,0.22)"
                      : "0 1px 2px rgba(20,33,61,0.04)",
                  }}
                >
                  {active ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus
                      className="h-3 w-3"
                      style={{ color: "#94A3B8" }}
                    />
                  )}
                  {idea.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => toggle(OTHER_ID)}
              disabled={submitting || done}
              className="text-[12.5px] font-medium rounded-full px-3 py-1.5 transition-all duration-150 inline-flex items-center gap-1.5 hover:-translate-y-px"
              style={{
                background: selected.includes(OTHER_ID)
                  ? NAVY
                  : "rgba(20,33,61,0.03)",
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
              className="mt-2.5 text-[11.5px] inline-flex items-center gap-1.5 rounded-md px-2 py-1"
              style={{
                color: "#475569",
                background: "rgba(20,33,61,0.04)",
              }}
            >
              <Sparkles className="h-3 w-3" style={{ color: RED }} />
              Send Lee a question and get a quick video answer.
            </p>
          )}

          {/* Other idea inline input — visually secondary */}
          {selected.includes(OTHER_ID) && (
            <div className="mt-3">
              <label
                className="text-[10.5px] uppercase tracking-widest font-semibold block mb-1"
                style={{ color: "#94A3B8" }}
              >
                Your idea
              </label>
              <input
                type="text"
                value={otherIdea}
                onChange={(e) => setOtherIdea(e.target.value)}
                placeholder="e.g., Audio recap of each chapter"
                maxLength={80}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 transition-all"
                style={{
                  background: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  color: NAVY,
                }}
                disabled={submitting || done}
              />
            </div>
          )}

          {/* Section 2: Rank — framed shaded panel */}
          <div className="mt-6">
            <SectionHeader
              step={2}
              title="Rank your top picks"
              hint="Top 3 is plenty"
            />
            <div
              className="mt-3 rounded-2xl p-3 sm:p-4 relative"
              style={{
                background:
                  "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
                border: "1px solid #E2E8F0",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <p
                  className="text-[11.5px] inline-flex items-center gap-1.5"
                  style={{ color: "#64748B" }}
                >
                  <Trophy className="h-3 w-3" style={{ color: RED }} />
                  Drag, or use ▲ ▼ to reorder.
                </p>
                {order.length > 0 && (
                  <span
                    className="text-[10.5px] uppercase tracking-widest font-semibold"
                    style={{ color: "#94A3B8" }}
                  >
                    {order.length} ranked
                  </span>
                )}
              </div>

              {order.length === 0 ? (
                <div
                  className="rounded-xl px-4 py-7 text-center text-[12.5px]"
                  style={{
                    background: "#fff",
                    border: "1px dashed #CBD5E1",
                    color: "#94A3B8",
                  }}
                >
                  Pick a few ideas above and they'll line up here.
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {order.map((id, idx) => {
                    const isTop3 = idx < 3;
                    const isDragging = dragId === id;
                    return (
                      <li
                        key={id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(id, el);
                          else itemRefs.current.delete(id);
                        }}
                        draggable={!submitting && !done}
                        onDragStart={() => setDragId(id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          reorderTo(id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setTouchOverId(null);
                        }}
                        className="flex items-center gap-2 sm:gap-3 rounded-xl px-2.5 py-2 transition-all duration-150"
                        style={{
                          background: "#fff",
                          border: `1px solid ${
                            touchOverId === id && !isDragging
                              ? NAVY
                              : isTop3
                              ? "#D9E0EC"
                              : "#E5EAF0"
                          }`,
                          boxShadow: isDragging
                            ? "0 8px 20px rgba(20,33,61,0.18)"
                            : isTop3
                            ? "0 2px 6px rgba(20,33,61,0.06)"
                            : "0 1px 2px rgba(20,33,61,0.03)",
                          opacity: isDragging ? 0.7 : 1,
                          transform: isDragging ? "scale(1.01)" : "none",
                          touchAction: isDragging ? "none" : "auto",
                        }}
                      >
                        {/* Drag handle — also captures touch drag on mobile */}
                        <span
                          onTouchStart={() => setDragId(id)}
                          onTouchMove={(e) => handleTouchMove(e, id)}
                          onTouchEnd={() => {
                            setDragId(null);
                            setTouchOverId(null);
                          }}
                          className="flex-shrink-0 p-1 -ml-1 rounded cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors"
                          style={{ touchAction: "none" }}
                          aria-label="Drag to reorder"
                        >
                          <GripVertical
                            className="h-4 w-4"
                            style={{ color: "#CBD5E1" }}
                          />
                        </span>
                        <span
                          className="inline-flex items-center justify-center rounded-lg text-[11px] font-bold flex-shrink-0"
                          style={{
                            width: 24,
                            height: 24,
                            background: isTop3
                              ? `linear-gradient(135deg, ${NAVY} 0%, #1E2F52 100%)`
                              : "#EEF2F7",
                            color: isTop3 ? "#fff" : "#64748B",
                            boxShadow: isTop3
                              ? "0 2px 4px rgba(20,33,61,0.18)"
                              : "none",
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
                        {idx === 0 && (
                          <span
                            className="hidden sm:inline-flex text-[9.5px] uppercase tracking-widest font-bold rounded px-1.5 py-0.5"
                            style={{
                              color: RED,
                              background: "rgba(206,17,38,0.08)",
                            }}
                          >
                            Top
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
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
                            className="p-1 rounded hover:bg-slate-100 transition-colors"
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
