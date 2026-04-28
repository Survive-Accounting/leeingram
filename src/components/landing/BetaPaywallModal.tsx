import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NAVY = "#14213D";
const RED = "#CE1126";

interface BetaPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinBeta: () => void;
}

export default function BetaPaywallModal({ open, onOpenChange, onJoinBeta }: BetaPaywallModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0">
        <div
          style={{
            background: "#FFFFFF",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {/* Top accent bar */}
          <div style={{ height: 4, background: RED }} />

          <div className="px-6 pt-7 pb-6">
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: RED }}
            >
              Built by Survive Accounting
            </div>

            <DialogHeader className="space-y-2 text-left">
              <DialogTitle
                className="text-[22px] sm:text-[24px] leading-tight"
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontWeight: 400,
                  color: NAVY,
                }}
              >
                Join the free beta to unlock this.
              </DialogTitle>
            </DialogHeader>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  onOpenChange(false);
                  onJoinBeta();
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: "linear-gradient(180deg, #E63950 0%, #CE1126 50%, #A30E1F 100%)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 16px -6px rgba(206,17,38,0.45)",
                }}
              >
                Start Studying
                <span aria-hidden>→</span>
              </button>
            </div>

            <p
              className="text-center mt-4 text-[12px]"
              style={{ color: "#9CA3AF" }}
            >
              100% free · No credit card required
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
