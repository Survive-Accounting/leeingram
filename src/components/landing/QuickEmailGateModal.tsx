import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { buildGetAccessUrl } from "@/lib/getAccessUrl";

const NAVY = "#14213D";
const RED = "#CE1126";

interface QuickEmailGateModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional course slug to pass through to /get-access. */
  courseSlug?: string | null;
}

/**
 * Lightweight email capture step shown before /get-access.
 * - Accepts any email (low friction).
 * - .edu → resolve campus via HIPOLABS-backed `resolve-campus` edge fn,
 *   then redirect to /get-access?campus=...&email=...
 * - Non-.edu or detection failure → redirect to /get-access?campus=ole-miss&email=...
 *   (Ole Miss = home campus, highest pricing, used as the "general" tier.)
 */
export default function QuickEmailGateModal({
  open,
  onClose,
  courseSlug,
}: QuickEmailGateModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setErr(null);
      setLoading(false);
    }
  }, [open]);

  const persistEmail = (value: string) => {
    try {
      localStorage.setItem("student_email", value);
      sessionStorage.setItem("student_email", value);
    } catch {
      /* storage unavailable — ignore */
    }
  };

  const goTo = (campusSlug: string, emailValue: string) => {
    persistEmail(emailValue);
    const base = buildGetAccessUrl({ campus: campusSlug, course: courseSlug ?? null });
    const sep = base.includes("?") ? "&" : "?";
    navigate(`${base}${sep}email=${encodeURIComponent(emailValue)}`);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setErr(null);

    const isEdu = trimmed.endsWith(".edu");
    if (!isEdu) {
      // Non-.edu → general (Ole Miss) pricing.
      goTo("ole-miss", trimmed);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: courseSlug ?? null },
      });
      if (error) throw error;
      const slug = (data?.campus_slug as string) || "ole-miss";
      // Treat the "general" fallback the same as Ole Miss pricing.
      goTo(slug === "general" ? "ole-miss" : slug, trimmed);
    } catch {
      // Detection failed → fall back to Ole Miss pricing.
      goTo("ole-miss", trimmed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[440px] p-0 gap-0 border-0 overflow-hidden [&>button]:hidden"
        style={{ background: "white", borderRadius: 16 }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>

        <form onSubmit={handleSubmit} className="px-6 sm:px-8 pt-7 pb-7">
          <h2
            className="text-[22px] sm:text-[24px] leading-tight text-center"
            style={{
              color: NAVY,
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
            }}
          >
            Get instant access to your accounting exam prep
          </h2>
          <p
            className="mt-2 text-center text-[13px]"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            Enter your school email — we'll look up your campus.
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (err) setErr(null);
            }}
            placeholder="your@university.edu"
            disabled={loading}
            autoFocus
            maxLength={255}
            required
            className="mt-5 w-full rounded-lg border px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#14213D]"
            style={{
              borderColor: err ? RED : "#E5E7EB",
              fontFamily: "Inter, sans-serif",
              color: NAVY,
            }}
          />
          {err && (
            <p
              className="mt-1.5 text-[12px]"
              style={{ color: RED, fontFamily: "Inter, sans-serif" }}
            >
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-80 disabled:cursor-wait flex items-center justify-center gap-2"
            style={{
              background: RED,
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 4px 14px rgba(206,17,38,0.3)",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finding your campus…
              </>
            ) : (
              "Continue →"
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
