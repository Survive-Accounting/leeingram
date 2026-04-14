import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

interface NotifyModalProps {
  open: boolean;
  onClose: () => void;
  courseName: string;
  courseId: string;
}

export default function NotifyModal({ open, onClose, courseName, courseId }: NotifyModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { error: dbErr } = await supabase.from("student_emails").upsert(
        { email: trimmed, course_id: courseId, converted: false },
        { onConflict: "email,course_id" }
      );
      if (dbErr) throw dbErr;
      setSuccess(true);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => { setSuccess(false); setEmail(""); setError(""); }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm p-6 [&>button]:hidden" style={{ borderRadius: 16 }}>
        {success ? (
          <div className="text-center space-y-3 py-2">
            <div className="text-3xl">🎉</div>
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>You're on the list!</h2>
            <p className="text-[14px]" style={{ color: "#666" }}>We'll email you when it's ready.</p>
            <button onClick={handleClose} className="text-[13px] font-medium hover:underline" style={{ color: RED }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
              Get notified when {courseName} launches
            </h2>
            <div className="space-y-1.5">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="your@university.edu"
                required
                disabled={loading}
                className="w-full rounded-lg px-4 text-[15px] outline-none transition-all focus:ring-2"
                style={{
                  minHeight: 48,
                  background: "#F8F9FA",
                  border: `1px solid ${error ? "#EF4444" : "#E5E7EB"}`,
                  color: NAVY,
                }}
              />
              {error && <p className="text-[12px] font-medium" style={{ color: "#EF4444" }}>{error}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ minHeight: 48, background: NAVY }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Notify Me →"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
