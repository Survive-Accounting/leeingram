import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NAVY = "#14213D";

interface EmailCaptureModalProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseSlug: string;
  /** If "pricing", redirect to campus page with show_pricing param */
  redirectTo?: string;
}

export default function EmailCaptureModal({ open, onClose, courseId, courseSlug, redirectTo }: EmailCaptureModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: courseSlug },
      });
      if (error) throw error;
      const slug = data?.campus_slug || "general";

      if (redirectTo === "pricing") {
        navigate(`/campus/${slug}/${courseSlug}?show_pricing=true`);
      } else {
        navigate(`/campus/${slug}/${courseSlug}`);
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-6 [&>button]:hidden" style={{ borderRadius: 16 }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
            Enter your school email
          </h2>
          <div className="space-y-1.5">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setWarning(""); }}
              placeholder="your@university.edu"
              required
              disabled={loading}
              className="w-full rounded-lg px-4 text-[15px] outline-none transition-all focus:ring-2"
              style={{
                minHeight: 48,
                background: "#F8F9FA",
                border: "1px solid #E5E7EB",
                color: NAVY,
                fontFamily: "Inter, sans-serif",
              }}
            />
            {warning && (
              <p className="text-[12px]" style={{ color: "#D97706" }}>{warning}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ minHeight: 48, background: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
