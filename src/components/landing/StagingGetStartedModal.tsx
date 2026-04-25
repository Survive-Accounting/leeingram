import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { CtaCourse } from "@/components/landing/StagingCtaModal";
import { DevShortcut } from "@/components/DevShortcut";
import { isAllowedEmail, isWhitelistedEmail } from "@/lib/emailWhitelist";
import { supabase } from "@/integrations/supabase/client";
import { registerLead } from "@/lib/registerLead";
import { toast } from "sonner";
import NonEduFallbackFlow from "@/components/landing/NonEduFallbackFlow";

const RED = "#CE1126";
const NAVY = "#14213D";

interface CourseAccent {
  border: string;
  tint: string;
}

const COURSE_ACCENTS: Record<string, CourseAccent> = {
  "intro-accounting-1":        { border: "#BFDBFE", tint: "#EFF6FF" },
  "intro-accounting-2":        { border: "#FCA5A5", tint: "#FEF2F2" },
  "intermediate-accounting-1": { border: "#86EFAC", tint: "#F0FDF4" },
  "intermediate-accounting-2": { border: "#FCD34D", tint: "#FFFBEB" },
};

interface StagingGetStartedModalProps {
  open: boolean;
  onClose: () => void;
  courses: CtaCourse[];
  /** If provided, modal opens at Step 2 with this course preselected. */
  preselectedCourseSlug?: string | null;
  /** Should validate + resolve campus and (when ready) navigate. */
  onSubmit: (email: string, course: CtaCourse) => Promise<void>;
}

export default function StagingGetStartedModal({
  open,
  onClose,
  courses,
  preselectedCourseSlug,
  onSubmit,
}: StagingGetStartedModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CtaCourse | null>(null);
  const [step2Loading, setStep2Loading] = useState(false);
  const [view, setView] = useState<"main" | "non_edu" | "non_edu_success">("main");
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [fallbackLoading, setFallbackLoading] = useState(false);
  // When true, expand into the full picker. Otherwise show the static "Your course" line.
  const [showCoursePicker, setShowCoursePicker] = useState(false);

  useEffect(() => {
    if (open) {
      const preset = preselectedCourseSlug
        ? courses.find((c) => c.slug === preselectedCourseSlug) ?? null
        : null;
      // Default to a single locked course to remove decision fatigue.
      const fallback = courses[0] ?? null;
      setStep(1);
      setEmail("");
      setEmailError(null);
      setStep1Loading(false);
      setSelectedCourse(preset ?? fallback);
      setStep2Loading(false);
      setView("main");
      setFallbackEmail("");
      setFallbackLoading(false);
      setShowCoursePicker(false);
    }
  }, [open, preselectedCourseSlug, courses]);


  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    const eduRegex = /^[^\s@]+@[^\s@]+\.edu$/i;
    const isEdu = eduRegex.test(trimmed) || isWhitelistedEmail(trimmed);

    // Non-.edu → switch to role/email/share fallback flow.
    if (!isEdu) {
      setFallbackEmail(trimmed);
      setView("non_edu");
      return;
    }

    setEmailError(null);
    setStep1Loading(true);
    // Fire-and-forget lead registration (.edu path) — captures campus from email domain.
    void registerLead(trimmed, preselectedCourseSlug);
    setTimeout(() => {
      setStep1Loading(false);
      setStep(2);
    }, 1200);
  };

  const handleStep2 = async () => {
    if (!selectedCourse) return;
    setStep2Loading(true);
    try {
      await onSubmit(email.trim().toLowerCase(), selectedCourse);
    } finally {
      // Modal will be closed by parent on navigate; if not, release state
      setStep2Loading(false);
    }
  };

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fallbackEmail.trim().toLowerCase();
    if (!trimmed) return;
    setFallbackLoading(true);
    try {
      const { error } = await supabase.from("landing_page_leads").insert({
        email: trimmed,
        email_type: "non_edu",
        university_domain: trimmed.split("@")[1] || null,
        course_slug: preselectedCourseSlug ?? null,
        intent_tag: "intent_get_started_modal",
        source: "non_edu_fallback",
      });
      if (error) throw error;
      // Also register as a campus lead (will resolve to "general" if no .edu match).
      await registerLead(trimmed, preselectedCourseSlug);
      setView("non_edu_success");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setFallbackLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-[460px] p-0 gap-0 border-0 overflow-hidden [&>button]:hidden"
        style={{ background: "white", borderRadius: 16 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>

        <div className="pt-7" />

        <div className="px-6 sm:px-8 pb-7">
          {(view === "non_edu" || view === "non_edu_success") && (
            <NonEduFallbackFlow
              initialEmail={fallbackEmail || email}
              courseSlug={preselectedCourseSlug ?? null}
              sourceContext="get_started_modal"
            />
          )}

          {view === "main" && step === 1 && (
            <form onSubmit={handleStep1}>
              <h2
                className="text-[22px] sm:text-[26px] leading-tight text-center"
                style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
              >
                What's your school email?
              </h2>
              <p
                className="mt-2 text-center text-[13px] sm:text-[14px]"
                style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
              >
                We'll use this to find your campus and personalize your experience.
              </p>

              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="your@university.edu"
                disabled={step1Loading}
                maxLength={255}
                autoFocus
                className="mt-5 w-full rounded-lg border px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#14213D]"
                style={{
                  borderColor: emailError ? RED : "#E5E7EB",
                  fontFamily: "Inter, sans-serif",
                  color: NAVY,
                }}
              />
              {emailError && (
                <p className="mt-1.5 text-[12px]" style={{ color: RED, fontFamily: "Inter, sans-serif" }}>
                  {emailError}
                </p>
              )}

              <button
                type="submit"
                disabled={step1Loading}
                className="mt-5 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-80 disabled:cursor-wait flex items-center justify-center gap-2"
                style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.3)" }}
              >
                {step1Loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding your campus...
                  </>
                ) : (
                  "Continue →"
                )}
              </button>
              <div className="mt-3 text-center">
                <DevShortcut label="[DEV] Skip to preview →" to="/campus/general/intermediate-accounting-2" />
              </div>
            </form>
          )}

          {view === "main" && step === 2 && (
            <div>
              <h2
                className="text-[22px] sm:text-[26px] leading-tight text-center"
                style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
              >
                Confirm your course
              </h2>
              <p
                className="mt-2 text-center text-[13px] sm:text-[14px]"
                style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
              >
                We'll take you straight there.
              </p>

              {/* Static course display (default) — minimizes decision fatigue */}
              {!showCoursePicker && selectedCourse && (
                <div
                  className="mt-5 rounded-lg px-4 py-4"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E5E7EB",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <p
                    className="text-[11px] uppercase tracking-wider"
                    style={{ color: "#6B7280", letterSpacing: "0.08em" }}
                  >
                    Your course
                  </p>
                  <p
                    className="mt-1 text-[15px] font-semibold"
                    style={{ color: NAVY }}
                  >
                    {selectedCourse.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCoursePicker(true)}
                    disabled={step2Loading}
                    className="mt-2 text-[12px] underline underline-offset-2 transition-opacity hover:opacity-70"
                    style={{ color: "#6B7280", background: "none", border: "none", padding: 0 }}
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Expanded picker — only shown when user explicitly clicks "Change" */}
              {showCoursePicker && (
                <div className="mt-5 space-y-2.5">
                  {courses.map((c) => {
                    const accent = COURSE_ACCENTS[c.slug] || { border: "#E5E7EB", tint: "#F9FAFB" };
                    const isSelected = selectedCourse?.slug === c.slug;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => {
                          setSelectedCourse(c);
                          setShowCoursePicker(false);
                        }}
                        disabled={step2Loading}
                        className="w-full text-left rounded-lg px-4 py-3 text-[14px] font-medium transition-all hover:shadow-sm"
                        style={{
                          borderLeft: `4px solid ${accent.border}`,
                          background: isSelected ? accent.tint : "white",
                          boxShadow: isSelected
                            ? `0 0 0 2px ${accent.border}`
                            : "0 0 0 1px #E5E7EB",
                          color: NAVY,
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedCourse && !showCoursePicker && (
                <button
                  onClick={handleStep2}
                  disabled={step2Loading}
                  className="mt-5 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-80 disabled:cursor-wait flex items-center justify-center gap-2"
                  style={{ background: RED, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 14px rgba(206,17,38,0.3)" }}
                >
                  {step2Loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up your preview...
                    </>
                  ) : (
                    "Take Me There →"
                  )}
                </button>
              )}
              <div className="mt-3 text-center">
                <DevShortcut label="[DEV] Bypass →" to="/campus/general/intermediate-accounting-2" />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className="block rounded-full transition-all"
      style={{
        width: active ? 22 : 8,
        height: 8,
        background: active ? NAVY : "#E5E7EB",
      }}
    />
  );
}
