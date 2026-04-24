import { Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import leeStadium from "@/assets/lee-stadium.png";

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Counts completed semesters since Survive Accounting launched (Spring 2020). */
function getSemesterCount(): number {
  const START_YEAR = 2020;
  const now = new Date();
  const year = now.getFullYear();
  const isSpring = now.getMonth() < 6;
  const currentIndex = (year - START_YEAR) * 2 + (isSpring ? 0 : 1);
  return Math.max(1, currentIndex + 1);
}

export function AboutLeeModal({ open, onOpenChange }: AboutLeeModalProps) {
  const semesters = getSemesterCount();

  const handleReachOut = () => {
    onOpenChange(false);
    setTimeout(() => {
      const el = document.getElementById("contact-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] sm:max-w-[760px] max-h-[92vh] overflow-y-auto p-0 border-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-300"
        style={{ borderRadius: 16, background: "#14213D" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio and background</DialogDescription>
        </DialogHeader>

        <div
          className="grid grid-cols-1 md:grid-cols-[1fr_40%]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {/* MOBILE-TOP / DESKTOP-RIGHT: Image */}
          <div
            className="order-1 md:order-2 relative overflow-hidden"
            style={{
              minHeight: 220,
            }}
          >
            <img
              src={leeStadium}
              alt="Lee Ingram at an Ole Miss football game"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "50% 30%" }}
            />
            {/* Subtle dark overlay for balance */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(20,33,61,0.05) 0%, rgba(20,33,61,0.18) 100%)",
              }}
            />
            {/* "That's me" label */}
            <div
              className="absolute"
              style={{
                top: 16,
                right: 16,
                background: "rgba(20,20,20,0.85)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                backdropFilter: "blur(4px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              ← That's me
            </div>
          </div>

          {/* MOBILE-BOTTOM / DESKTOP-LEFT: Text */}
          <div className="order-2 md:order-1 p-6 sm:p-7">
            {/* Header */}
            <div>
              <h2
                className="text-white leading-tight"
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                  fontSize: 26,
                }}
              >
                Lee Ingram
              </h2>
              <p
                className="mt-1.5 text-[12px] leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Bachelor's &amp; Master's — Ole Miss (3.75 GPA)
                <br />
                Accounting tutor since 2015
              </p>
            </div>

            {/* Divider */}
            <div
              className="mt-5 mb-5"
              style={{ height: 1, background: "rgba(255,255,255,0.1)" }}
            />

            {/* Body */}
            <div
              className="space-y-4 text-[14px]"
              style={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.65 }}
            >
              <p>
                I loved learning accounting so much in college that I turned it into a career. Since then, I've helped 1,200+ students truly understand the material — not just memorize it.
              </p>
              <p>
                During the pandemic, I built SurviveAccounting.com to reach students beyond my alma mater. Now, I'm building it with AI-powered tools to help you study more efficiently than ever before.
              </p>
              <p>
                I'm always here to help — feel free to{" "}
                <button
                  type="button"
                  onClick={handleReachOut}
                  className="underline decoration-[1px] underline-offset-[3px] decoration-white/40 hover:decoration-white transition-colors"
                  style={{
                    color: "#fff",
                    background: "none",
                    border: "none",
                    padding: 0,
                    font: "inherit",
                    cursor: "pointer",
                  }}
                >
                  reach out
                </button>{" "}
                anytime. You've got this.
              </p>
              <p className="font-medium text-white">— Lee</p>
            </div>

            {/* Email */}
            <a
              href="mailto:lee@surviveaccounting.com"
              className="mt-5 inline-flex items-center gap-2 text-[13px] hover:text-white transition-colors"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              <Mail className="w-4 h-4" />
              lee@surviveaccounting.com
            </a>

            {/* PS */}
            <p
              className="mt-4 text-[11px] italic"
              style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}
            >
              PS: Thank you to the students who've supported Survive Accounting for {semesters} semesters now — it means a lot.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
