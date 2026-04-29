import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

const CATEGORIES = [
  { id: "helped", label: "This helped" },
  { id: "confused", label: "I'm confused" },
  { id: "broke", label: "Something broke" },
  { id: "feature_idea", label: "Feature idea" },
  { id: "other", label: "Other" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export interface QuickFeedbackContext {
  /** Optional — current course ID if known */
  courseId?: string | null;
  /** Optional — current chapter ID if known */
  chapterId?: string | null;
  /** Optional — current asset / problem ID if known */
  assetId?: string | null;
  /** Optional — current asset code (e.g. IA2_CH13_BE001_A) */
  assetCode?: string | null;
  /** Optional — which tool the user was using (e.g. "solutions-viewer") */
  tool?: string | null;
}

interface Props {
  open: boolean;
  email: string | null;
  onClose: () => void;
  /** Switch to the detailed "Vote on Future Tools" modal */
  onOpenVoteOnFutureTools?: () => void;
  context?: QuickFeedbackContext;
}

/**
 * Low-friction default feedback modal. Saves to study_tool_idea_feedback
 * with idea_key='quick_feedback' so the existing beta dashboard
 * Feedback Inbox picks it up automatically.
 */
export default function QuickFeedbackModal({
  open,
  email,
  onClose,
  onOpenVoteOnFutureTools,
  context,
}: Props) {
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setCategories([]);
        setText("");
        setDone(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const canSubmit = useMemo(() => {
    return text.trim().length > 0 || categories.length > 0;
  }, [text, categories]);

  if (!open) return null;

  const toggleCategory = (id: CategoryId) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const userEmail = email || userData?.user?.email || null;

      const pageUrl =
        typeof window !== "undefined" ? window.location.href : null;

      const metadata = {
        categories,
        email: userEmail,
        asset_code: context?.assetCode ?? null,
        asset_id: context?.assetId ?? null,
        tool: context?.tool ?? null,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      };

      const { error } = await supabase.from("study_tool_idea_feedback").insert({
        idea_key: "quick_feedback",
        idea_label: categories.length
          ? categories
              .map((c) => CATEGORIES.find((x) => x.id === c)?.label ?? c)
              .join(", ")
          : "Quick feedback",
        suggestion_text: text.trim().slice(0, 2000) || null,
        user_id: userId,
        course_id: context?.courseId ?? null,
        chapter_id: context?.chapterId ?? null,
        page_url: pageUrl,
        metadata,
      });
      if (error) throw error;

      setDone(true);
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      console.error("[QuickFeedbackModal] submit failed:", err);
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
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        style={{
          border: "1px solid #E0E7F0",
          fontFamily: "Inter, sans-serif",
          maxHeight: "calc(100dvh - 2rem)",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 24px 60px -12px rgba(20,33,61,0.35), 0 0 0 1px rgba(20,33,61,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — navy banner, matches Survive Accounting modal style */}
        <div
          className="relative px-6 pt-6 pb-5 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, #1E2F52 100%)`,
            color: "#fff",
          }}
        >
          <Sparkles
            className="absolute right-5 top-5 opacity-20"
            style={{ width: 56, height: 56 }}
          />
          <div className="relative">
            <p
              className="text-[10.5px] uppercase tracking-[0.18em] font-bold"
              style={{ color: "#FCA5AF" }}
            >
              Share Feedback
            </p>
            <h3
              className="mt-1.5 text-[22px] sm:text-[24px] leading-tight"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              What should I improve?
            </h3>
            <p
              className="mt-1.5 text-[13px]"
              style={{ color: "rgba(255,255,255,0.78)" }}
            >
              Tell me anything — what helped, what confused you, or what you
              wish this had.
            </p>
          </div>
        </div>

        {/* Body */}
        <div
          className="px-6 pt-5 pb-2 overflow-y-auto"
          style={{ flex: 1, minHeight: 0 }}
        >
          {/* Quick category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const active = categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  disabled={submitting || done}
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
                  {active && <Check className="h-3 w-3" />}
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Textarea — main focus */}
          <div className="mt-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              autoFocus
              maxLength={2000}
              className="w-full min-h-[140px] rounded-lg px-3 py-2.5 text-[14px] outline-none resize-y focus:ring-2"
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: NAVY,
              }}
              disabled={submitting || done}
            />
          </div>

          {/* Secondary link */}
          {onOpenVoteOnFutureTools && (
            <button
              type="button"
              onClick={() => {
                onClose();
                // small delay so this modal animates out cleanly
                setTimeout(() => onOpenVoteOnFutureTools(), 150);
              }}
              className="mt-3 text-[12.5px] font-medium underline-offset-2 hover:underline"
              style={{ color: NAVY }}
              disabled={submitting || done}
            >
              Want to vote on future tools?
            </button>
          )}
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
            {done
              ? "Thanks — this helps improve the beta."
              : "Send feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
