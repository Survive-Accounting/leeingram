import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle } from "lucide-react";

const NAVY = "#14213D";

interface StudentLoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StudentLoginModal({ open, onClose }: StudentLoginModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const reset = () => {
    setEmail("");
    setError("");
    setSent(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      // Check if student exists
      const { data: student } = await (supabase as any)
        .from("students")
        .select("id")
        .eq("email", trimmed)
        .maybeSingle();

      if (!student) {
        setError("No account found for this email. Try the email you used when purchasing.");
        setLoading(false);
        return;
      }

      // Send magic link
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch {
      setError("Something went wrong. Try again or contact Lee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-sm p-0 [&>button]:hidden overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
        style={{ borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        {sent ? (
          <div className="p-6 text-center space-y-4 py-6">
            <CheckCircle className="w-12 h-12 mx-auto" style={{ color: "#22C55E" }} />
            <h2 className="text-[18px] font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              Check your email
            </h2>
            <p className="text-[14px]" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
              I sent a login link to{" "}
              <span className="font-medium" style={{ color: NAVY }}>{email}</span>
            </p>
            <p className="text-[13px]" style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>
              It may take a minute. Check your spam folder if you don't see it.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-[13px] font-medium hover:underline"
              style={{ color: "#CE1126" }}
            >
              Wrong email? Try again →
            </button>
          </div>
        ) : (
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Lee avatar + title */}
              <div className="flex items-center gap-3">
                <img
                  src="https://i.ibb.co/9HhgJrS/Lee-Ingram-Headshot.jpg"
                  alt="Lee Ingram"
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  style={{ border: "2px solid #E5E7EB" }}
                />
                <div>
                  <h2 className="text-[18px] font-semibold leading-tight" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
                    Welcome back
                  </h2>
                  <p className="text-[13px] mt-0.5" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
                    Enter your school email and I'll send you a login link.
                  </p>
                </div>
              </div>

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
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                {error && (
                  <p className="text-[12px] font-medium" style={{ color: "#EF4444" }}>{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ minHeight: 48, background: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Login Link →"}
              </button>

              {/* Microcopy */}
              <p className="text-[11px] text-center" style={{ color: "#9CA3AF" }}>
                No password needed.
              </p>

              <p className="text-center text-[13px]" style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="font-medium hover:underline"
                  style={{ color: "#CE1126" }}
                  onClick={() => {
                    onClose();
                    if (window.location.pathname === "/" || window.location.pathname === "") {
                      document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                      window.location.href = "/#courses";
                    }
                  }}
                >
                  What course are you studying? →
                </button>
              </p>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
