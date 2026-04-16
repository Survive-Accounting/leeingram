import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEventTracking, setStoredEmail } from "@/hooks/useEventTracking";

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
  const [loading, setLoading] = useState(false);
  const { trackEvent } = useEventTracking();

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
      sessionStorage.setItem("student_email", trimmed);
      setStoredEmail(trimmed);
      trackEvent('email_captured', { course_slug: courseSlug, email_domain: trimmed.split('@')[1] });
      if (data?.is_test_mode) {
        sessionStorage.setItem("sa_test_mode", "true");
        sessionStorage.setItem("sa_email_override", data.email_override || "");
      }

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
      <DialogContent
        className="max-w-sm p-0 [&>button]:hidden overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
        style={{ borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <h2 className="text-[18px] font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              Enter your school email
            </h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@university.edu"
              required
              disabled={loading}
              className="w-full rounded-xl px-4 text-[15px] outline-none transition-all focus:ring-2 focus:ring-blue-200"
              style={{
                minHeight: 50,
                background: "#F8F9FA",
                border: "1px solid #E5E7EB",
                color: NAVY,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{ minHeight: 50, background: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
