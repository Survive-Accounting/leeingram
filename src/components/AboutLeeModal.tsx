import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import leeStadium from "@/assets/lee-stadium.jpg";

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Counts completed semesters since Survive Accounting launched (Spring 2020).
 * Spring = Jan–Jun, Fall = Jul–Dec. The current semester counts as in-progress.
 */
function getSemesterCount(): number {
  const START_YEAR = 2020;
  const START_IS_SPRING = true;
  const now = new Date();
  const year = now.getFullYear();
  const isSpring = now.getMonth() < 6;

  const startIndex = START_IS_SPRING ? 0 : 1;
  const currentIndex = (year - START_YEAR) * 2 + (isSpring ? 0 : 1);
  return Math.max(1, currentIndex - startIndex + 1);
}

export function AboutLeeModal({ open, onOpenChange }: AboutLeeModalProps) {
  const semesters = getSemesterCount();
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!open) setImgLoaded(false);
  }, [open]);

  const handleReachOut = () => {
    onOpenChange(false);
    // Allow modal close animation a moment before scrolling.
    setTimeout(() => {
      const el = document.getElementById("contact-form");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0 border-0"
        style={{ borderRadius: 16, background: "#14213D" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio</DialogDescription>
        </DialogHeader>

        <div className="p-6 sm:p-8 flex flex-col items-center text-center" style={{ fontFamily: "Inter, sans-serif" }}>
          {/* Hero image */}
          <div
            className="w-full max-w-[420px] aspect-square rounded-xl overflow-hidden relative"
            style={{
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              background: "linear-gradient(135deg, #1f3160 0%, #14213D 100%)",
            }}
          >
            <img
              src={leeStadium}
              alt="Lee Ingram at an Ole Miss football game"
              loading="eager"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              className="w-full h-full object-cover"
              style={{
                objectPosition: "30% center",
                opacity: imgLoaded ? 1 : 0,
                filter: imgLoaded ? "blur(0)" : "blur(8px)",
                transform: imgLoaded ? "scale(1)" : "scale(1.02)",
                transition: "opacity 0.7s ease, filter 0.7s ease, transform 0.9s ease",
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />

            {/* ESPN-style scoreboard overlay */}
            <div
              className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-stretch overflow-hidden select-none"
              style={{
                background: "rgba(11,31,58,0.9)",
                borderRadius: 5,
                boxShadow: "0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
                fontFamily: "'Inter', sans-serif",
                color: "#fff",
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
              aria-label="Final score: Ole Miss 27, Arkansas 20"
            >
              <style>{`
                @keyframes scorePulse {
                  0%, 100% { opacity: 0.85; }
                  50%      { opacity: 1; }
                }
              `}</style>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ color: "#F4B6BD" }}>
                  Ole Miss
                </span>
                <span className="text-[13px] sm:text-[15px] font-extrabold tabular-nums">27</span>
              </div>
              <div className="w-px my-1 sm:my-1.5" style={{ background: "rgba(255,255,255,0.18)" }} />
              <div
                className="flex items-center px-2 sm:px-2.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: "#94A3B8", animation: "scorePulse 2.4s ease-in-out infinite" }}
              >
                Final
              </div>
              <div className="w-px my-1 sm:my-1.5" style={{ background: "rgba(255,255,255,0.18)" }} />
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2">
                <span className="text-[13px] sm:text-[15px] font-extrabold tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>
                  20
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Arkansas
                </span>
              </div>
            </div>
          </div>
          {/* Name + identity */}
          <h2
            className="mt-6 text-[26px] sm:text-[30px] text-white leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Lee Ingram
          </h2>
          <p className="mt-1 text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            Accounting tutor since 2015
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            B.S. &amp; M.S. in Accounting — University of Mississippi (3.75 GPA)
          </p>

          {/* Bio */}
          <div
            className="mt-6 space-y-4 text-[14px] sm:text-[15px] max-w-[440px]"
            style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.65 }}
          >
            <p>
              I loved learning accounting so much in college, I decided to make tutoring it my career. Since then, I've helped 1,200+ students truly understand the material — not just memorize it.
            </p>
            <p>
              During the pandemic, I built SurviveAccounting.com to reach students beyond Ole Miss. Now, I'm rebuilding it with AI-powered tools that help you study more efficiently than ever before.
            </p>
            <p>
              I'm always here to help, so please{" "}
              <button
                type="button"
                onClick={handleReachOut}
                className="underline decoration-[1px] underline-offset-[3px] decoration-white/40 hover:decoration-white transition-colors"
                style={{ color: "#fff", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
              >
                reach out
              </button>{" "}
              if you need anything.
            </p>
            <p>You've got this!</p>
            <p className="font-medium text-white">— Lee</p>
          </div>

          {/* PS */}
          <p
            className="mt-6 text-[11px] sm:text-[12px] italic max-w-[440px]"
            style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}
          >
            PS: Thank you to the students who've supported Survive Accounting for {semesters} semesters now — it means a lot.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
