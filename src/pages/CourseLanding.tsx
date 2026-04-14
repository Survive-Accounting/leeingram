import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, LogIn } from "lucide-react";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { toast } from "sonner";

const NAVY = "#14213D";
const RED = "#CE1126";

const COURSES = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    code: "IA2",
    name: "Intermediate Accounting 2",
    detail: "Ch 13–22 · Finals prep · $125",
    status: "live" as const,
    badge: "LIVE",
    badgeBg: "#16A34A",
    cta: "Start Studying →",
    link: "/accy304",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    code: "INTRO2",
    name: "Introductory Accounting 2",
    detail: "Coming before finals",
    status: "upcoming" as const,
    badge: "Launching April 24",
    badgeBg: "#D97706",
    cta: "Notify Me →",
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    code: "INTRO1",
    name: "Introductory Accounting 1",
    detail: "Available next semester",
    status: "future" as const,
    badge: "Fall 2026",
    badgeBg: "#6B7280",
    cta: "Request Early Access →",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    code: "IA1",
    name: "Intermediate Accounting 1",
    detail: "Available next semester",
    status: "future" as const,
    badge: "Fall 2026",
    badgeBg: "#6B7280",
    cta: "Request Early Access →",
  },
];

export default function CourseLanding() {
  const navigate = useNavigate();
  const [modalCourse, setModalCourse] = useState<typeof COURSES[0] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCardClick = (course: typeof COURSES[0]) => {
    if (course.status === "live" && course.link) {
      navigate(course.link);
    } else {
      setModalCourse(course);
      setEmail("");
      setError("");
      setSuccess(false);
    }
  };

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!isAllowedEmail(trimmed)) {
      setError("Please use your .edu email address");
      return;
    }
    setLoading(true);
    try {
      const { error: dbErr } = await supabase.from("student_emails").upsert(
        {
          email: trimmed,
          course_id: modalCourse!.id,
          converted: false,
        },
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

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${aorakiBg})` }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/70" />
      </div>

      {/* Admin link */}
      <div className="absolute top-4 right-4 z-20">
        <a
          href="/admin"
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors"
          style={{ color: "rgba(255,255,255,0.2)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)")}
        >
          <LogIn className="w-3.5 h-3.5" />
          Admin
        </a>
      </div>

      {/* Student login link */}
      <div className="absolute top-4 left-4 z-20">
        <a
          href="/login"
          className="text-[11px] uppercase tracking-widest transition-colors"
          style={{ color: "rgba(255,255,255,0.2)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)")}
        >
          Student Login
        </a>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero text */}
        <div className="text-center mb-8 sm:mb-10">
          <div
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-4"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            SA
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight max-w-lg mx-auto"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)", fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            Your exam is right now.
            <br />
            Let's survive it.
          </h1>
          <p className="text-white/50 text-[15px] mt-3">
            Choose your course to get started.
          </p>
        </div>

        {/* Course cards */}
        <div className="w-full max-w-[700px] grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COURSES.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCardClick(c)}
              className="text-left rounded-xl p-5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[15px] font-semibold text-white">{c.name}</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap text-white shrink-0"
                  style={{ background: c.badgeBg }}
                >
                  {c.badge}
                </span>
              </div>
              <p className="text-[13px] text-white/50 mb-4">{c.detail}</p>
              <span
                className="inline-block rounded-lg px-4 py-2 text-[13px] font-semibold text-center w-full"
                style={
                  c.status === "live"
                    ? { background: NAVY, color: "#fff" }
                    : { background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }
                }
              >
                {c.cta}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-6 space-y-0.5">
        <p className="text-[12px] text-white/30">
          Made by Lee Ingram · Ole Miss Accounting Tutor since 2015
        </p>
        <p className="text-[12px] text-white/25">
          Questions?{" "}
          <a href="mailto:lee@surviveaccounting.com" className="underline hover:text-white/40">
            lee@surviveaccounting.com
          </a>
        </p>
      </div>

      {/* Notify modal */}
      <Dialog open={!!modalCourse} onOpenChange={(open) => !open && setModalCourse(null)}>
        <DialogContent className="max-w-sm p-6 [&>button]:hidden" style={{ borderRadius: 16 }}>
          {success ? (
            <div className="text-center space-y-3 py-2">
              <div className="text-3xl">🎉</div>
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
                You're on the list!
              </h2>
              <p className="text-[14px]" style={{ color: "#666" }}>
                We'll email you when it launches.
              </p>
              <button
                onClick={() => setModalCourse(null)}
                className="text-[13px] font-medium hover:underline"
                style={{ color: RED }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleNotify} className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
                Get notified when {modalCourse?.name} launches
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
                {error && (
                  <p className="text-[12px] font-medium" style={{ color: "#EF4444" }}>
                    {error}
                  </p>
                )}
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
    </div>
  );
}
