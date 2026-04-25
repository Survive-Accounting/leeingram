import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { registerLead } from "@/lib/registerLead";
import { toast } from "sonner";

const NAVY = "#14213D";

interface StagingWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export default function StagingWaitlistModal({ open, onClose, initialEmail }: StagingWaitlistModalProps) {
  const [email, setEmail] = useState(initialEmail || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail || "");
      setSuccess(false);
      setLoading(false);
    }
  }, [open, initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("student_emails")
        .upsert(
          { email: trimmed, converted: false, campus_slug: null } as any,
          { onConflict: "email" },
        );
      if (error) throw error;
      await registerLead(trimmed);
      setSuccess(true);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-sm p-6 [&>button]:hidden"
        style={{ borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition"
        >
          <X className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>

        {success ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-3xl">🎉</div>
            <h2
              className="text-[18px] font-semibold"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              You're on the list!
            </h2>
            <p className="text-[14px]" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
              We'll reach out when we launch at your school.
            </p>
            <button
              onClick={onClose}
              className="text-[13px] font-medium hover:underline mt-2"
              style={{ color: NAVY }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2
              className="text-[18px] leading-snug"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              <strong>Survive Accounting</strong> is currently available at Ole Miss only.
            </h2>
            <p className="text-[13px] leading-relaxed" style={{ color: "#6B7280" }}>
              We're launching at new campuses August 1, 2026 — drop your email and we'll let you know
              when we're live at your school.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@university.edu"
              required
              disabled={loading}
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
              disabled={loading}
              className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ minHeight: 48, background: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Join the Waitlist →"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
