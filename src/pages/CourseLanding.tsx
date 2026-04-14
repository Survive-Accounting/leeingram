import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isAllowedEmail } from "@/lib/emailWhitelist";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, LogIn } from "lucide-react";

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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      {/* Hero — Mt Cook, same pattern as cram pages */}
      <div className="relative overflow-hidden course-hero" style={{ height: 300 }}>
        <style>{`
          @media (max-width: 640px) { .course-hero { height: 220px !important; } }
          .course-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url('https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg');
            background-size: cover;
            background-position: 60% 40%;
            background-repeat: no-repeat;
            transform: scaleX(-1);
            z-index: 0;
          }
          .course-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to right, rgba(20,33,61,0.45) 0%, rgba(20,33,61,0.55) 25%, rgba(20,33,61,0.12) 55%, rgba(20,33,61,0.35) 100%);
            z-index: 1;
          }
        `}</style>

        {/* Admin link */}
        <div className="absolute top-4 right-4" style={{ zIndex: 10 }}>
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
        <div className="absolute top-4 left-4" style={{ zIndex: 10 }}>
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

        <div className="relative h-full mx-auto max-w-[780px] px-4 sm:px-6 flex flex-col justify-center" style={{ zIndex: 2 }}>
          <h1
            className="text-[26px] sm:text-[34px] text-white leading-tight"
            style={{ fontWeight: 800, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
          >
            Your exam is coming up.
            <br />
            Let's survive it.
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            Choose your course to get started.
          </p>
        </div>
      </div>

      {/* Wave divider */}
      <div style={{ background: "#F8F8FA", marginTop: "-2px", overflow: "hidden", lineHeight: 0 }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "60px" }}>
          <path d="M0,30 C240,60 480,55 720,35 C960,15 1200,50 1440,30 L1440,0 L0,0 Z" fill="#14213D" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">

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
