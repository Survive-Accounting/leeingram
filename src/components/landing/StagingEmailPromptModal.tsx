import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import { DevShortcut } from "@/components/DevShortcut";
import { supabase } from "@/integrations/supabase/client";
import { isWhitelistedEmail } from "@/lib/emailWhitelist";
import { toast } from "sonner";
import NonEduFallbackFlow from "@/components/landing/NonEduFallbackFlow";

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
  /** When 'pricing', shows pricing-specific headline copy. */
  intent?: "default" | "pricing";
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
  intent = "default",
}: StagingEmailPromptModalProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [view, setView] = useState<"edu" | "non_edu" | "non_edu_success">("edu");
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setCelebration(null);
      setSubmitting(false);
      setView("edu");
      setFallbackEmail("");
      setMagicLinkSent(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    const isEdu = trimmed.endsWith(".edu") || isWhitelistedEmail(trimmed);

    // Non-.edu → switch to role/email/share fallback flow.
    if (!isEdu) {
      setFallbackEmail(trimmed);
      setView("non_edu");
      return;
    }

    setSubmitting(true);
    try {
      // Returning user check: any active paid access → magic link, skip pricing flow.
      try {
        const { data: purchases } = await supabase
          .from("student_purchases")
          .select("expires_at")
          .eq("email", trimmed)
          .limit(20);
        const now = Date.now();
        const hasActive = (purchases ?? []).some(
          (p: any) => !p.expires_at || new Date(p.expires_at).getTime() > now,
        );
        if (hasActive) {
          const { error: linkErr } = await supabase.functions.invoke("resend-login-link", {
            body: { email: trimmed },
          });
          if (linkErr) throw linkErr;
          setMagicLinkSent(true);
          return;
        }
      } catch (err) {
        // Non-fatal — fall through to pricing flow.
        console.warn("pricing modal access check failed", err);
      }

      const result = await onSubmit(trimmed);
      // If parent returns null, it has already navigated (e.g. Ole Miss skip).
      if (result) setCelebration(result);
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

        {magicLinkSent ? (
          <div className="text-center space-y-4 py-4">
            <h2
              className="text-[22px] leading-tight"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Check your email
            </h2>
            <p className="text-[14px]" style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}>
              Check your email for your secure access link.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
              style={{ minHeight: 48, background: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              Done
            </button>
          </div>
        ) : celebration ? (
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
        ) : view === "non_edu" || view === "non_edu_success" ? (
          <NonEduFallbackFlow
            initialEmail={fallbackEmail || email}
            courseSlug={null}
            sourceContext="email_prompt_modal"
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2
                className="text-[18px] font-semibold"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {intent === "pricing" ? "What's your school email?" : "Enter your school email"}
              </h2>
              {intent === "pricing" ? (
                <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
                  We'll use this to find your campus pricing.
                </p>
              ) : chapterNumber != null ? (
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
