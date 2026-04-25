import { X, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import leeStadium from "@/assets/lee-stadium.png";
import { useEmailGate } from "@/contexts/EmailGateContext";

interface AboutLeeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AboutLeeModal({ open, onOpenChange }: AboutLeeModalProps) {
  const { requestAccess } = useEmailGate();

  const handleReachOut = () => {
    onOpenChange(false);
    setTimeout(() => {
      const el = document.getElementById("contact-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleGetAccess = () => {
    onOpenChange(false);
    // Open the lightweight email gate (same flow as all landing CTAs)
    setTimeout(() => requestAccess({}), 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] sm:max-w-[960px] max-h-[92vh] overflow-y-auto p-0 border-0 [&>button]:hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-300"
        style={{ borderRadius: 20, background: "#14213D", overflow: "hidden" }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>About Lee Ingram</DialogTitle>
          <DialogDescription>Bio and background</DialogDescription>
        </DialogHeader>

        {/* Custom close button — large, circular, high contrast */}
        <DialogClose
          aria-label="Close"
          className="absolute z-20 flex items-center justify-center rounded-full transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            background: "rgba(20,33,61,0.85)",
            color: "#fff",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          <X className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </DialogClose>

        <div
          className="grid grid-cols-1 md:grid-cols-[55%_45%]"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {/* MOBILE-TOP / DESKTOP-RIGHT: Image (inset, padded) */}
          <div
            className="order-1 md:order-2 relative"
            style={{ padding: 18 }}
          >
            <div
              className="relative overflow-hidden w-full"
              style={{
                borderRadius: 16,
                aspectRatio: "4 / 5",
                minHeight: 240,
                background: "rgba(255,255,255,0.04)",
                boxShadow:
                  "0 10px 30px -10px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              <img
                src={leeStadium}
                alt="Lee Ingram at an Ole Miss football game"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: "50% 35%" }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(20,33,61,0) 55%, rgba(20,33,61,0.22) 100%)",
                }}
              />
            </div>
          </div>

          {/* MOBILE-BOTTOM / DESKTOP-LEFT: Text */}
          <div className="order-2 md:order-1 p-6 sm:p-8 md:pr-2 md:py-8">
            {/* Header */}
            <div>
              <h2
                className="text-white leading-tight"
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                  fontSize: 30,
                }}
              >
                Lee Ingram
              </h2>
              <p
                className="mt-1.5 text-[12px] leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                M.Acc. · University of Mississippi
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
              className="space-y-4 text-[14px] sm:text-[15px]"
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
          </div>
        </div>

        {/* Bottom CTA bar — full width, red gradient */}
        <div
          className="relative px-6 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4"
          style={{
            background:
              "linear-gradient(135deg, #CE1126 0%, #A50E1F 100%)",
            color: "#fff",
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {/* Subtle inner highlight for premium feel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 35%)",
            }}
          />

          <div className="relative text-center sm:text-left">
            <div
              className="text-white"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
                fontSize: 20,
                lineHeight: 1.2,
              }}
            >
              Ready to Survive Accounting?
            </div>
            <div
              className="mt-1 text-[12px]"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              7-day risk-free refund · Full semester access
            </div>
          </div>

          <button
            type="button"
            onClick={handleGetAccess}
            className="relative inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:scale-[1.03] active:scale-[0.99]"
            style={{
              background: "#FFFFFF",
              color: "#A50E1F",
              padding: "12px 22px",
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
              boxShadow:
                "0 6px 18px -6px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(165,14,31,0.15)",
              whiteSpace: "nowrap",
            }}
          >
            Get Full Access
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
