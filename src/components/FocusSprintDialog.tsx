import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Brain } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FocusSprintDialogProps {
  open: boolean;
  onClose: () => void; // bypass confirmed
}

export function FocusSprintDialog({ open, onClose }: FocusSprintDialogProps) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [continueClicked, setContinueClicked] = useState(false);
  const [buttonGlow, setButtonGlow] = useState(false);

  const handleClose = () => {
    setShowWarning(true);
  };

  const handleGoToFocus = () => {
    navigate("/focus");
  };

  const handleContinueUnfocused = () => {
    if (!continueClicked) {
      setContinueClicked(true);
      setButtonGlow(true);
      setTimeout(() => setButtonGlow(false), 1500);
      return;
    }
    // Second click — actually bypass
    onClose();
  };

  const handleBackToSprint = () => {
    setShowWarning(false);
    setContinueClicked(false);
    setButtonGlow(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="border-0 p-0 max-w-md w-full overflow-hidden"
        style={{
          background: "rgba(10,10,18,0.96)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(218,165,32,0.25)",
          borderRadius: "16px",
          boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(218,165,32,0.06)",
        }}
        // hide default close button
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {!showWarning ? (
          /* ── SPRINT SETUP PROMPT ── */
          <div className="relative p-8 text-center space-y-6">
            {/* X button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{
                  background: "linear-gradient(135deg, rgba(218,165,32,0.2), rgba(184,134,11,0.08))",
                  border: "1px solid rgba(218,165,32,0.4)",
                  boxShadow: "0 0 20px rgba(218,165,32,0.15)",
                }}
              >
                <Brain className="w-7 h-7" style={{ color: "rgba(218,165,32,0.9)" }} />
              </div>
              <h2
                className="text-xl font-bold tracking-wide"
                style={{
                  color: "rgba(218,165,32,0.95)",
                  textShadow: "0 0 20px rgba(218,165,32,0.3)",
                }}
              >
                Start a Focus Sprint?
              </h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Set your intention before diving in. One task. Full focus.
              </p>
            </div>

            <button
              onClick={handleGoToFocus}
              className="w-full rounded-full px-6 py-3.5 text-sm font-bold text-black transition-all hover:scale-105 active:scale-95"
              style={{
                background: "rgba(218,165,32,0.92)",
                boxShadow: "0 4px 24px rgba(218,165,32,0.4), 0 0 40px rgba(218,165,32,0.15)",
              }}
            >
              🧠 Launch Focus Sprint
            </button>

            <button
              onClick={handleClose}
              className="text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.25)"; }}
            >
              Skip for now →
            </button>
          </div>
        ) : (
          /* ── WARNING SCREEN ── */
          <div className="relative p-8 text-center space-y-6">
            {/* Dramatic mountain silhouette / atmosphere */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: "radial-gradient(ellipse at top, rgba(218,165,32,0.04) 0%, transparent 60%), radial-gradient(ellipse at bottom, rgba(0,0,0,0.5) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            <div className="relative space-y-2">
              <p className="text-4xl">⛰️</p>
              <h2
                className="text-lg font-bold tracking-wide"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                The mountain doesn't wait.
              </h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                The best journeys start with intention.
              </p>
            </div>

            {/* Go back — gold button matching "Get the next letter" */}
            <div className="relative space-y-3">
              <button
                onClick={handleBackToSprint}
                className={`w-full rounded-full px-6 py-3.5 text-sm font-bold text-black transition-all hover:scale-105 active:scale-95 ${buttonGlow ? "ring-2 ring-[rgba(218,165,32,0.8)] shadow-[0_0_32px_rgba(218,165,32,0.6)]" : ""}`}
                style={{
                  background: "rgba(218,165,32,0.92)",
                  boxShadow: buttonGlow
                    ? "0 4px 32px rgba(218,165,32,0.7), 0 0 60px rgba(218,165,32,0.3)"
                    : "0 4px 24px rgba(218,165,32,0.4), 0 0 40px rgba(218,165,32,0.15)",
                  transition: "all 0.4s ease",
                }}
              >
                🧠 Go back to Focus Sprint
              </button>

              <div className="space-y-1">
                <button
                  onClick={handleContinueUnfocused}
                  className="text-xs transition-all"
                  style={{
                    color: continueClicked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.25)",
                  }}
                  onMouseEnter={(e) => {
                    if (!continueClicked) (e.target as HTMLElement).style.color = "rgba(255,255,255,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = continueClicked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.25)";
                  }}
                >
                  Continue unfocused
                </button>
                {continueClicked && (
                  <p
                    className="text-[10px] animate-fade-in"
                    style={{ color: "rgba(218,165,32,0.6)" }}
                  >
                    Are you sure? Click again to continue without a sprint.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
