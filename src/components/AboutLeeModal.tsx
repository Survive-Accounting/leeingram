import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LEE_PHOTO = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";
const BOOKING_URL = "https://app.squareup.com/appointments/book/30fvidwxlwh9vt/LY1BCZ6Q74JRF/start";

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AboutLeeModal({ open, onOpenChange }: AboutLeeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 border-0"
        style={{ borderRadius: 16, background: "#14213D" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio and contact info</DialogDescription>
        </DialogHeader>

        <div className="p-6 sm:p-8 space-y-6">
          {/* 1. Header row */}
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="flex-1 min-w-0 pt-1">
              <h2
                className="text-[22px] sm:text-[26px] text-white leading-tight"
                style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
              >
                About Lee Ingram
              </h2>
              <p
                className="text-[11px] sm:text-[12px] mt-1 font-semibold uppercase tracking-wide"
                style={{ color: "#CE1126" }}
              >
                Founder, Survive Accounting
              </p>
              <p
                className="text-[10px] sm:text-[11px] mt-1"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}
              >
                B.A. &amp; M.Acc. in Accounting · University of Mississippi · 3.75 GPA
              </p>
            </div>
            <img
              src={LEE_PHOTO}
              alt="Lee Ingram"
              className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] shrink-0 object-cover rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          {/* 2. Bio */}
          <div className="space-y-3">
            <p
              className="text-[15px] sm:text-[16px] font-semibold text-white"
              style={{ lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}
            >
              I loved accounting so much in college, I turned it into a full-time tutoring career.
            </p>
            {[
              "During the pandemic, I built SurviveAccounting.com — and since then, it's helped 1,000+ students finally understand what's going on.",
              "Now I travel the world doing what I love: helping students not just survive accounting, but feel confident in it.",
            ].map((p, i) => (
              <p
                key={i}
                className="text-[12px] sm:text-[13px]"
                style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.65, fontFamily: "Inter, sans-serif" }}
              >
                {p}
              </p>
            ))}
            <p
              className="text-[12px] sm:text-[13px]"
              style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.65, fontFamily: "Inter, sans-serif" }}
            >
              Good luck on your exam — you've got this.
              <br />
              <span className="font-medium text-white">— Lee</span>
            </p>
          </div>

          {/* 3. PS */}
          <p
            className="text-[10px] sm:text-[11px] italic"
            style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}
          >
            PS: A huge thanks to all the students who've enjoyed my tutoring content over the years. As a lifelong teacher, it means a lot.
          </p>

          {/* 4. Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href="mailto:lee@surviveaccounting.com"
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white/90 hover:text-white transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)" }}
            >
              ✉️ lee@surviveaccounting.com
            </a>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#CE1126" }}
            >
              📅 Book 1-on-1 Tutoring →
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
