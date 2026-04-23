import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { CtaCourse } from "@/components/landing/StagingCtaModal";
import { DevShortcut } from "@/components/DevShortcut";
import { isAllowedEmail } from "@/lib/emailWhitelist";

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

  useEffect(() => {
    if (open) {
      const preset = preselectedCourseSlug
        ? courses.find((c) => c.slug === preselectedCourseSlug) ?? null
        : null;
      setStep(1);
      setEmail("");
      setEmailError(null);
      setStep1Loading(false);
      setSelectedCourse(preset);
      setStep2Loading(false);
    }
  }, [open, preselectedCourseSlug, courses]);


  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    const eduRegex = /^[^\s@]+@[^\s@]+\.edu$/i;
    if (!eduRegex.test(trimmed) && !isAllowedEmail(trimmed)) {
      setEmailError("Please enter a valid .edu email address.");
      return;
    }
    setEmailError(null);
    setStep1Loading(true);
    // Brief loading animation, then advance
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

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-7 pb-4">
          <Dot active={step === 1} />
          <Dot active={step === 2} />
        </div>

        <div className="px-6 sm:px-8 pb-7">
          {step === 1 && (
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

          {step === 2 && (
            <div>
              <h2
                className="text-[22px] sm:text-[26px] leading-tight text-center"
                style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
              >
                Which course are you studying?
              </h2>
              <p
                className="mt-2 text-center text-[13px] sm:text-[14px]"
                style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
              >
                We'll take you straight there.
              </p>

              <div className="mt-5 space-y-2.5">
                {courses.map((c) => {
                  const accent = COURSE_ACCENTS[c.slug] || { border: "#E5E7EB", tint: "#F9FAFB" };
                  const isSelected = selectedCourse?.slug === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setSelectedCourse(c)}
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

              {selectedCourse && (
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
