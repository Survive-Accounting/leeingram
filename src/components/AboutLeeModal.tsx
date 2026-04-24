import { Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import leeHeadshot from "@/assets/lee-headshot-original.png";

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Counts completed semesters since Survive Accounting launched (Spring 2020).
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
        className="w-[calc(100%-2rem)] sm:max-w-[480px] max-h-[90vh] overflow-y-auto p-0 border-0"
        style={{ borderRadius: 14, background: "#14213D" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio</DialogDescription>
        </DialogHeader>

        <div className="p-6" style={{ fontFamily: "Inter, sans-serif" }}>
          {/* Header row: 60px avatar + title */}
          <div className="flex items-center gap-3">
            <img
              src={leeHeadshot}
              alt="Lee Ingram"
              className="rounded-full object-cover shrink-0"
              style={{
                width: 60,
                height: 60,
                background: "linear-gradient(135deg, #1f3160 0%, #14213D 100%)",
              }}
            />
            <div className="min-w-0">
              <h2
                className="text-[20px] text-white leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
              >
                About Lee Ingram
              </h2>
              <p className="mt-0.5 text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                Accounting tutor since 2015
              </p>
            </div>
          </div>

          {/* Bio */}
          <div
            className="mt-5 space-y-3 text-[14px]"
            style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.6 }}
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

          {/* Email contact */}
          <a
            href="mailto:lee@surviveaccounting.com"
            className="mt-4 inline-flex items-center gap-2 text-[13px] hover:text-white transition-colors"
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
      </DialogContent>
    </Dialog>
  );
}
