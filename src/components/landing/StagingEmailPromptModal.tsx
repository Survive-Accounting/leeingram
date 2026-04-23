import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import { DevShortcut } from "@/components/DevShortcut";
import { supabase } from "@/integrations/supabase/client";
import { isWhitelistedEmail } from "@/lib/emailWhitelist";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

export interface CelebrationData {
  campus_slug: string;
  campus_name: string;
  student_number: number;
  paid_student_count: number;
  is_new: boolean;
  mascot_cheer?: string | null;
  founding_student?: boolean;
  founding_coupon_code?: string | null;
  is_test_mode?: boolean;
  email_override?: string;
}

interface StagingEmailPromptModalProps {
  open: boolean;
  onClose: () => void;
  /** Resolves with celebration data so the modal can show the #N moment, or null to skip. */
  onSubmit: (email: string) => Promise<CelebrationData | null> | CelebrationData | null;
  onContinue: (data: CelebrationData) => void;
  courseName?: string;
  chapterNumber?: number | null;
  chapterName?: string | null;
  loading?: boolean;
}

/** Tier copy keyed by founding student number N. */
function getTierSubheadline(n: number): string {
  if (n <= 1) return "As a thank you — you get free access.";
  if (n <= 5) return "As a thank you — you get access for $25.";
  if (n <= 10) return "As a thank you — you get access for $50.";
  if (n <= 25) return "You're in early — access is $100.";
  if (n <= 50) return "You're in early — access is $125.";
  if (n <= 100) return "Access is $150 for your campus.";
  if (n <= 200) return "Access is $175 for your campus.";
  return "Access is $250 for your campus.";
}

export default function StagingEmailPromptModal({
  open,
  onClose,
  onSubmit,
  onContinue,
  courseName,
  chapterNumber,
  chapterName,
  loading = false,
}: StagingEmailPromptModalProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [view, setView] = useState<"edu" | "non_edu" | "non_edu_success">("edu");
  const [fallbackEmail, setFallbackEmail] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setCelebration(null);
      setSubmitting(false);
      setView("edu");
      setFallbackEmail("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // Non-.edu fallback (whitelisted staff/VA emails bypass)
    if (!trimmed.endsWith(".edu") && !isWhitelistedEmail(trimmed)) {
      setFallbackEmail(trimmed);
      setView("non_edu");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(trimmed);
      // If parent returns null, it has already navigated (e.g. Ole Miss skip).
      if (result) setCelebration(result);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fallbackEmail.trim().toLowerCase();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("survive_ai_subscribers").insert({
        email: trimmed,
        tag: "non_edu_fallback",
        source_context: {
          course_name: courseName ?? null,
          chapter_number: chapterNumber ?? null,
          chapter_name: chapterName ?? null,
        },
      });
      // Ignore unique-violation (already on the list) — treat as success.
      if (error && error.code !== "23505") throw error;
      setView("non_edu_success");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const n = celebration?.student_number ?? 0;
  const campusName = celebration?.campus_name?.trim() || "your campus";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md p-6 [&>button]:hidden"
        style={{ borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition"
        >
          <X className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>

        {celebration ? (
          <div className="text-center space-y-5 py-2">
            <div className="text-5xl leading-none" aria-hidden="true">🎉</div>
            <h2
              className="text-[24px] md:text-[26px] leading-tight"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              You're student #{n} from {campusName}!
            </h2>
            <p
              className="text-[14px]"
              style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
            >
              {getTierSubheadline(n)}
            </p>
            <button
              type="button"
              onClick={() => celebration && onContinue(celebration)}
              className="w-full rounded-lg text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
              style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
            >
              Start Studying →
            </button>
            <div>
              <DevShortcut label="[DEV] Skip modal →" to="/campus/general/intermediate-accounting-2" onClick={onClose} />
            </div>
          </div>
        ) : view === "non_edu_success" ? (
          <div className="text-center space-y-4 py-4">
            <div className="text-4xl leading-none" aria-hidden="true">✉️</div>
            <h2
              className="text-[20px] font-semibold"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              You're on the list — we'll be in touch.
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-medium hover:underline"
              style={{ color: "#6B7280" }}
            >
              Close
            </button>
          </div>
        ) : view === "non_edu" ? (
          <form onSubmit={handleFallbackSubmit} className="space-y-4">
            <div>
              <h2
                className="text-[18px] font-semibold"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                Looks like that's not a school email.
              </h2>
              <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "#6B7280" }}>
                Survive Accounting is built for college students — but we don't want to leave you out. Drop your email and we'll send you a free preview link.
              </p>
            </div>
            <input
              type="email"
              value={fallbackEmail}
              onChange={(e) => setFallbackEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={submitting}
              autoFocus
              className="w-full rounded-lg px-4 text-[15px] outline-none focus:ring-2"
              style={{
                minHeight: 48,
                background: "#F8F9FA",
                border: "1px solid #E5E7EB",
                color: NAVY,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Me Access →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2
                className="text-[18px] font-semibold"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                Enter your school email
              </h2>
              {chapterNumber != null ? (
                <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
                  Takes you straight to Ch. {chapterNumber}
                  {chapterName ? ` — ${chapterName}` : ""} study tools.
                </p>
              ) : courseName ? (
                <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
                  Takes you straight to {courseName} study tools.
                </p>
              ) : null}
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@university.edu"
              required
              disabled={loading || submitting}
              autoFocus
              className="w-full rounded-lg px-4 text-[15px] outline-none focus:ring-2"
              style={{
                minHeight: 48,
                background: "#F8F9FA",
                border: "1px solid #E5E7EB",
                color: NAVY,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={loading || submitting}
              className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
            >
              {loading || submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
            </button>
            <div className="mt-3 text-center">
              <DevShortcut label="[DEV] Skip to preview →" to="/campus/general/intermediate-accounting-2" />
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
