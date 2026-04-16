import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEventTracking, setStoredEmail } from "@/hooks/useEventTracking";

const NAVY = "#14213D";
const RED = "#CE1126";

const TRANSITION_MESSAGES = [
  "Matching you to your course...",
  "Getting your study setup ready...",
  "You're in the right place...",
  "Help for your exam is on the way...",
  "Pulling the right material...",
  "Almost there...",
];

export interface CtaCourse {
  id: string;
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  status: "live" | "upcoming" | "future";
  slug: string;
}

export type CtaModalIntent =
  | { type: "none" }
  | { type: "select-course" }
  | { type: "enroll"; course: CtaCourse }
  | { type: "notify"; course: CtaCourse };

interface StagingCtaModalProps {
  intent: CtaModalIntent;
  onClose: () => void;
  courses: CtaCourse[];
  onIntentChange: (intent: CtaModalIntent) => void;
}

export default function StagingCtaModal({ intent, onClose, courses, onIntentChange }: StagingCtaModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState(0);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const { trackEvent } = useEventTracking();

  const open = intent.type !== "none";

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEmail("");
        setLoading(false);
        setNotifySuccess(false);
        setTransitioning(false);
        setTransitionMsg(0);
        setPendingRoute(null);
      }, 200);
    }
  }, [open]);

  // Rotate transition messages
  useEffect(() => {
    if (!transitioning) return;
    const interval = setInterval(() => {
      setTransitionMsg((prev) => (prev + 1) % TRANSITION_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [transitioning]);

  // Navigate after transition delay
  useEffect(() => {
    if (!pendingRoute || !transitioning) return;
    const timer = setTimeout(() => {
      navigate(pendingRoute);
    }, 2800);
    return () => clearTimeout(timer);
  }, [pendingRoute, transitioning, navigate]);

  const handleCourseSelect = (course: CtaCourse) => {
    trackEvent("course_selected", { course_name: course.name, course_slug: course.slug });
    if (course.status === "live") {
      onIntentChange({ type: "enroll", course });
    } else {
      onIntentChange({ type: "notify", course });
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (intent.type !== "enroll") return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-campus", {
        body: { email: trimmed, course_slug: intent.course.slug },
      });
      if (error) throw error;
      const slug = data?.campus_slug || "general";
      sessionStorage.setItem("student_email", trimmed);
      setStoredEmail(trimmed);
      trackEvent("email_captured", {
        course_slug: intent.course.slug,
        email_domain: trimmed.split("@")[1],
      });
      if (data?.is_test_mode) {
        sessionStorage.setItem("sa_test_mode", "true");
        sessionStorage.setItem("sa_email_override", data.email_override || "");
      }
      // Transition instead of immediate navigate
      setLoading(false);
      setTransitioning(true);
      setPendingRoute(`/campus/${slug}/${intent.course.slug}`);
    } catch {
      toast.error("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (intent.type !== "notify") return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const campusSlug = sessionStorage.getItem("campus_slug");
      const { error: dbErr } = await supabase.from("student_emails").upsert(
        {
          email: trimmed,
          course_id: intent.course.id,
          converted: false,
          ...(campusSlug ? { campus_slug: campusSlug } : {}),
        },
        { onConflict: "email,course_id" },
      );
      if (dbErr) throw dbErr;
      trackEvent("waitlist_signup", { course_name: intent.course.name, email_domain: trimmed.split("@")[1] });
      setNotifySuccess(true);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const liveCourses = courses.filter((c) => c.status === "live");
  const upcomingCourses = courses.filter((c) => c.status !== "live");

  const stepLabel =
    intent.type === "select-course"
      ? "Step 1: Course Selection"
      : intent.type === "enroll"
        ? transitioning ? "Transitioning..." : "Step 2: Email (Enroll)"
        : intent.type === "notify"
          ? "Step 2: Email (Notify)"
          : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !transitioning && onClose()}>
      <DialogContent
        className="max-w-sm p-0 [&>button]:hidden overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
        style={{ borderRadius: 20, boxShadow: "0 25px 60px -12px rgba(20,33,61,0.25), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        {/* ── Step 1: Course Selection ── */}
        {intent.type === "select-course" && (
          <div className="p-6 space-y-4">
            <h2
              className="text-[18px] font-semibold"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              What course are you taking?
            </h2>

            <div className="space-y-2">
              {liveCourses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCourseSelect(c)}
                  className="w-full text-left rounded-xl p-4 flex items-center justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] group"
                  style={{
                    background: "#fff",
                    border: "2px solid #E5E7EB",
                  }}
                >
                  <div>
                    <span className="text-[14px] font-bold" style={{ color: NAVY }}>
                      {c.name}
                    </span>
                    {c.subtext && (
                      <span className="block text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                        {c.subtext}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mt-1.5 px-2 py-0.5 rounded-full text-white"
                      style={{ background: "#22C55E" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Available now
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" />
                </button>
              ))}
            </div>

            {upcomingCourses.length > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
                  <span className="text-[11px] font-medium" style={{ color: "#9CA3AF" }}>
                    Coming soon
                  </span>
                  <div className="flex-1 h-px" style={{ background: "#E5E7EB" }} />
                </div>

                <div className="space-y-2">
                  {upcomingCourses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCourseSelect(c)}
                      className="w-full text-left rounded-xl p-4 flex items-center justify-between gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] group"
                      style={{
                        background: "#FAFAFA",
                        border: "1px solid #F0F0F0",
                      }}
                    >
                      <div>
                        <span className="text-[14px] font-semibold" style={{ color: NAVY }}>
                          {c.name}
                        </span>
                        {c.subtext && (
                          <span className="block text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                            {c.subtext}
                          </span>
                        )}
                        <span className="block text-[11px] mt-1" style={{ color: "#9CA3AF" }}>
                          {c.availability}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Enroll (live course) — form ── */}
        {intent.type === "enroll" && !transitioning && (
          <div className="p-6 animate-in fade-in-0 duration-200">
            <form onSubmit={handleEnrollSubmit} className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => onIntentChange({ type: "select-course" })}
                  className="text-[12px] font-medium mb-3 hover:underline"
                  style={{ color: "#9CA3AF" }}
                >
                  ← Change course
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4" style={{ color: "#22C55E" }} />
                  <span className="text-[13px] font-semibold" style={{ color: NAVY }}>
                    {intent.course.name}
                  </span>
                </div>

                {/* Lee avatar + title */}
                <div className="flex items-center gap-3 mt-4">
                  <img
                    src="https://i.ibb.co/9HhgJrS/Lee-Ingram-Headshot.jpg"
                    alt="Lee Ingram"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid #E5E7EB" }}
                  />
                  <div>
                    <h2
                      className="text-[18px] font-semibold leading-tight"
                      style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                    >
                      Enter your school email
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                      I'll match you to your course and get you to the right material.
                    </p>
                  </div>
                </div>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ minHeight: 48, background: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding your course...
                  </>
                ) : (
                  "Continue →"
                )}
              </button>

              {/* Microcopy */}
              <p className="text-[11px] text-center" style={{ color: "#9CA3AF" }}>
                No spam. Just access to your course.
              </p>

              {/* Secondary link */}
              <p className="text-[12px] text-center">
                <button
                  type="button"
                  className="font-medium hover:underline"
                  style={{ color: "#6B7280" }}
                  onClick={() => {
                    toast.info("Contact lee@surviveaccounting.com for gift purchases.");
                  }}
                >
                  Buying for someone else?
                </button>
              </p>
            </form>
          </div>
        )}

        {/* ── Transition State ── */}
        {transitioning && (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in-0 duration-300" style={{ minHeight: 240 }}>
            <div className="relative">
              <div
                className="w-12 h-12 rounded-full animate-spin"
                style={{
                  border: "3px solid #E5E7EB",
                  borderTopColor: NAVY,
                }}
              />
            </div>
            <div className="space-y-2">
              <p
                key={transitionMsg}
                className="text-[16px] font-semibold animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {TRANSITION_MESSAGES[transitionMsg]}
              </p>
              <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
                Hang tight — this just takes a second.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: Notify (upcoming course) ── */}
        {intent.type === "notify" && (
          <div className="p-6">
            {notifySuccess ? (
              <div className="text-center space-y-3 py-2">
                <div className="text-3xl">🎉</div>
                <h2 className="text-[18px] font-semibold" style={{ color: NAVY }}>
                  You're on the list!
                </h2>
                <p className="text-[14px]" style={{ color: "#6B7280" }}>
                  We'll email you when {intent.course.name} is ready.
                </p>
                <button
                  onClick={onClose}
                  className="text-[13px] font-medium hover:underline"
                  style={{ color: RED }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleNotifySubmit} className="space-y-4">
                <div>
                  <button
                    type="button"
                    onClick={() => onIntentChange({ type: "select-course" })}
                    className="text-[12px] font-medium mb-3 hover:underline"
                    style={{ color: "#9CA3AF" }}
                  >
                    ← Change course
                  </button>
                  <h2
                    className="text-[18px] font-semibold"
                    style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                  >
                    Get notified when {intent.course.name} launches
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>
                    {intent.course.availability} · Early access + discounts
                  </p>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  style={{ minHeight: 48, background: NAVY, fontFamily: "Inter, sans-serif" }}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Notify Me →"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Debug strip */}
        <div
          className="px-4 py-2 text-[10px] font-mono flex items-center gap-3"
          style={{ background: "#F5F5F5", borderTop: "1px solid #E5E7EB", color: "#9CA3AF" }}
        >
          <span>🛠 {stepLabel}</span>
          {intent.type !== "none" && intent.type !== "select-course" && (
            <span>· {intent.course.name}</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
