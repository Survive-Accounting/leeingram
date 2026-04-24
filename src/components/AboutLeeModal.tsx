import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LEE_PHOTO = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";

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
          <img
            src={LEE_PHOTO}
            alt="Lee Ingram at the stadium"
            className="w-full max-w-[380px] aspect-[4/3] object-cover rounded-xl"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />

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
            <p>I loved accounting so much in college, I turned it into a full-time tutoring career.</p>
            <p>
              Since then, I've helped 1,200+ students understand the material — not just memorize it.
            </p>
            <p>
              During the pandemic, I built SurviveAccounting.com to reach students beyond Ole Miss. Now, I'm rebuilding it with AI-powered tools so anyone can walk into their exam confident.
            </p>
            <p>You've got this.</p>
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
