import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LEE_PHOTO = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AboutLeeModal({ open, onOpenChange }: AboutLeeModalProps) {
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

        <div className="p-5 sm:p-7 space-y-5">
          {/* Header row */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="flex-1 min-w-0 pt-2">
              <h2
                className="text-[24px] sm:text-[28px] text-white leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
              >
                About Lee Ingram
              </h2>
            </div>
            <img
              src={LEE_PHOTO}
              alt="Lee Ingram"
              className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] shrink-0 object-cover rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          {/* Body */}
          <div className="space-y-4" style={{ fontFamily: "Inter, sans-serif" }}>
            <p
              className="text-[14px] sm:text-[15px]"
              style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.65 }}
            >
              I loved accounting so much in college, I turned it into a full-time tutoring career.
            </p>
            <p
              className="text-[14px] sm:text-[15px]"
              style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.65 }}
            >
              Now, I've helped 1,000+ students — and I've loved every minute. During the pandemic, I built SurviveAccounting.com so I could help students struggling nationwide. Today, I'm upgrading the platform with AI-enabled study tools I'm building myself, so every student can walk into their exam confident.
            </p>
            <p
              className="text-[14px] sm:text-[15px]"
              style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.65 }}
            >
              Good luck on your exam. You've got this!
              <br />
              <span className="font-medium text-white">— Lee</span>
            </p>
          </div>

          {/* PS */}
          <p
            className="text-[11px] sm:text-[12px] italic"
            style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.55, fontFamily: "Inter, sans-serif" }}
          >
            PS: A huge thanks to all the students who've supported Survive Accounting for 12 semesters now. As a lifelong teacher, it means a lot.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
