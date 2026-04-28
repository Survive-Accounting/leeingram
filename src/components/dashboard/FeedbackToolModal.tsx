import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

type Topic = "Practice Problem Helper" | "Journal Entry Memorizer" | "General suggestion";

const TOPICS: Topic[] = [
  "Practice Problem Helper",
  "Journal Entry Memorizer",
  "General suggestion",
];

export default function FeedbackToolModal({
  open,
  email,
  onClose,
  defaultTopic = "General suggestion",
}: {
  open: boolean;
  email: string | null;
  onClose: () => void;
  defaultTopic?: Topic;
}) {
  const [topic, setTopic] = useState<Topic>(defaultTopic);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (text.trim().length < 5) {
      toast.error("Tell us a little more so we can build it right.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-notification", {
        body: {
          email: email || "anonymous@beta",
          message: `[Beta · ${topic}] ${text.trim().slice(0, 4000)}`,
          subject: `Beta feedback · ${topic}`,
        },
      });
      if (error) throw error;
      setDone(true);
      setTimeout(() => {
        onClose();
        setText("");
        setDone(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        style={{ border: "1px solid #E0E7F0", fontFamily: "Inter, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <p
            className="text-[11px] uppercase tracking-widest"
            style={{ color: RED, fontWeight: 700 }}
          >
            Help us decide
          </p>
          <h3
            className="mt-1 text-[22px] leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            What should we build next?
          </h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "#64748B" }}>
            Share thoughts about the Practice Problem Helper, Journal Entry Memorizer, or any idea.
          </p>
        </div>

        <div className="px-6 pb-3">
          <p
            className="text-[10.5px] uppercase tracking-widest font-semibold mb-1.5"
            style={{ color: "#94A3B8" }}
          >
            Topic
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => {
              const active = topic === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="text-[12px] font-medium rounded-full px-3 py-1.5 transition-all"
                  style={{
                    background: active ? NAVY : "#F1F5F9",
                    color: active ? "#fff" : "#475569",
                    border: `1px solid ${active ? NAVY : "#E2E8F0"}`,
                  }}
                  disabled={submitting || done}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your feedback is invaluable to us."
            className="w-full min-h-[140px] rounded-lg px-3 py-2.5 text-[14px] outline-none resize-y"
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              color: NAVY,
            }}
            disabled={submitting || done}
            maxLength={4000}
          />
        </div>

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
            disabled={submitting || done}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
            style={{
              background: done
                ? "#15803D"
                : `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              boxShadow: "0 4px 12px rgba(206,17,38,0.20)",
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {done && <Check className="h-3.5 w-3.5" />}
            {done ? "Sent — thanks!" : "Send to Lee"}
          </button>
        </div>
      </div>
    </div>
  );
}
