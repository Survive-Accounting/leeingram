import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X, Award } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboardFallback";
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
}

interface StagingEmailPromptModalProps {
  open: boolean;
  onClose: () => void;
  /** Resolves with celebration data so the modal can show the #N moment, or null to skip. */
  onSubmit: (email: string) => Promise<CelebrationData | null> | CelebrationData | null;
  onContinue: (data: CelebrationData) => void;
  courseName?: string;
  loading?: boolean;
}

export default function StagingEmailPromptModal({
  open,
  onClose,
  onSubmit,
  onContinue,
  courseName,
  loading = false,
}: StagingEmailPromptModalProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setCelebration(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(trimmed);
      if (result) setCelebration(result);
    } finally {
      setSubmitting(false);
    }
  };

  const isOleMiss = celebration?.campus_slug === "ole-miss";
  const isFounding = !!celebration?.founding_student;
  const n = celebration?.student_number ?? 0;
  const isFirst10 = !isFounding && n >= 2 && n <= 10;
  const isEstablished = n > 10;

  const handleShare = async () => {
    const msg = `Just found this accounting study tool — surviveaccounting.com. Student #${n} here 👀`;
    const ok = await copyToClipboard(msg);
    toast[ok ? "success" : "error"](ok ? "Copied to clipboard!" : "Copy failed");
  };

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

        {!celebration ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2
                className="text-[18px] font-semibold"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                Enter your school email
              </h2>
              {courseName && (
                <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
                  Takes you straight to {courseName} study tools.
                </p>
              )}
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
          </form>
        ) : (
          <div className="text-center space-y-4 py-2">
            {isOleMiss && (
              <>
                <div className="text-4xl">🎉</div>
                <h2
                  className="text-[24px] md:text-[28px] leading-tight font-bold"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
                >
                  You're Ole Miss student #{n}!
                </h2>
                <p className="text-[14px]" style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}>
                  {(597 + (celebration?.paid_student_count ?? 0)).toLocaleString()} students have survived their exam with this. You're next.
                </p>
              </>
            )}

            {isFounding && (
              <>
                <div className="text-4xl">🎉</div>
                <h2
                  className="text-[22px] md:text-[26px] leading-tight"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
                >
                  {celebration?.mascot_cheer ? `${celebration.mascot_cheer} ` : ""}
                  You're the FIRST {celebration?.campus_name} student on Survive Accounting!
                </h2>
                <p className="text-[14px]" style={{ color: "#4A5568" }}>
                  As our founding student, you get our biggest discount. See below.
                </p>
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ background: "#FFF7E6", border: "1px solid #F5C26B" }}
                >
                  <Award className="w-4 h-4" style={{ color: "#B7791F" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "#B7791F" }}>
                    Founding Student — {celebration?.campus_name}
                  </span>
                </div>
              </>
            )}

            {!isOleMiss && !isFounding && isFirst10 && (
              <>
                <div className="text-3xl">🎉</div>
                <h2
                  className="text-[22px] leading-tight"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
                >
                  You're student #{n} at {celebration?.campus_name}!
                </h2>
                <p className="text-[14px]" style={{ color: "#4A5568" }}>
                  You're one of the first — tell your study group.
                </p>
                <button
                  type="button"
                  onClick={handleShare}
                  className="text-[13px] font-medium hover:underline"
                  style={{ color: NAVY }}
                >
                  Share with study group →
                </button>
              </>
            )}

            {!isOleMiss && !isFounding && isEstablished && (
              <>
                <h2
                  className="text-[20px] leading-tight"
                  style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
                >
                  Join {celebration?.paid_student_count} students at {celebration?.campus_name} already studying with this.
                </h2>
              </>
            )}

            <button
              type="button"
              onClick={() => celebration && onContinue(celebration)}
              className="w-full rounded-lg text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
              style={{ minHeight: 48, background: RED, fontFamily: "Inter, sans-serif" }}
            >
              Continue →
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
