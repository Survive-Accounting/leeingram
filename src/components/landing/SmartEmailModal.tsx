import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NAVY = "#14213D";

const COURSES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Introductory Accounting 1", slug: "intro-accounting-1", status: "future" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Introductory Accounting 2", slug: "intro-accounting-2", status: "upcoming" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Intermediate Accounting 1", slug: "intermediate-accounting-1", status: "future" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Intermediate Accounting 2", slug: "intermediate-accounting-2", status: "live" },
];

interface SmartEmailModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "email" | "magic-link-sent" | "course-select" | "resolving";

export default function SmartEmailModal({ open, onClose }: SmartEmailModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");

  const reset = () => { setEmail(""); setWarning(""); setStep("email"); setLoading(false); };
  const handleClose = () => { reset(); onClose(); };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // No warning needed for pricing modal

    setLoading(true);
    try {
      // Check if student exists
      const { data: student } = await (supabase as any)
        .from("students")
        .select("id")
        .eq("email", trimmed)
        .maybeSingle();

      if (student) {
        // Returning student → send magic link
        const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
        if (error) throw error;
        setStep("magic-link-sent");
      } else {
        // New student → show course selector
        setStep("course-select");
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSelect = async (course: typeof COURSES[0]) => {
    const trimmed = email.trim().toLowerCase();
    setStep("resolving");
    try {
      const { data, error } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: course.slug },
      });
      if (error) throw error;
      const slug = data?.campus_slug || "general";
      handleClose();
      navigate(`/campus/${slug}/${course.slug}`);
    } catch {
      toast.error("Something went wrong. Try again.");
      setStep("course-select");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm p-6 [&>button]:hidden" style={{ borderRadius: 16 }}>
        {/* Step 1: Email entry */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              Enter your school email to see pricing
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
                style={{ minHeight: 48, background: "#F8F9FA", border: "1px solid #E5E7EB", color: NAVY, fontFamily: "Inter, sans-serif" }}
              />
              
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ minHeight: 48, background: "#CE1126", fontFamily: "Inter, sans-serif" }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue →"}
            </button>
          </form>
        )}

        {/* Step 2a: Magic link sent (returning student) */}
        {step === "magic-link-sent" && (
          <div className="text-center space-y-4 py-4">
            <CheckCircle className="w-12 h-12 mx-auto" style={{ color: "#22C55E" }} />
            <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              Welcome back!
            </h2>
            <p className="text-[14px]" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
              Check your email for a login link.
            </p>
            <button
              onClick={handleClose}
              className="text-[13px] font-medium hover:underline"
              style={{ color: NAVY }}
            >
              Close
            </button>
          </div>
        )}

        {/* Step 2b: Course selector (new student) */}
        {step === "course-select" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}>
              What course are you studying?
            </h2>
            <div className="space-y-2">
              {COURSES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCourseSelect(c)}
                  className="w-full text-left rounded-lg px-4 py-3 text-[14px] font-medium transition-colors hover:bg-gray-100"
                  style={{ border: "1px solid #E5E7EB", color: NAVY, fontFamily: "Inter, sans-serif" }}
                >
                  {c.name}
                  {c.status === "live" && (
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#22C55E", color: "white" }}>LIVE</span>
                  )}
                  {c.status === "upcoming" && (
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#F97316", color: "white" }}>COMING SOON</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resolving state */}
        {step === "resolving" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} />
            <p className="text-[14px]" style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
              Finding your school...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
