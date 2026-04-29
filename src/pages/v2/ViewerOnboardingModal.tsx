import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Mail, Laptop, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReferralShareStrip } from "@/components/share/ReferralShareStrip";

const NAVY = "#14213D";
const RED = "#CE1126";
const LOGO_FONT = "'DM Serif Display', serif";
const SESSION_FLAG = "sa.viewer.onboarding.shown";
const PERMANENT_FLAG = "sa.viewer.onboarding.dismissed";

interface ViewerOnboardingModalProps {
  /** Asset code currently loaded — used to build the full-screen link. */
  assetCode: string | null;
  /** Logged-in user id, for prefilling the email + share strip. */
  userId?: string | null;
  /** Logged-in user's email, for prefilling. */
  userEmail?: string | null;
}

/**
 * One-time onboarding modal shown on the first load of the Solutions Viewer
 * inside an iframe. Suggests opening full screen on desktop, or sending a
 * link to the student's email on mobile so they can pick it up on a laptop.
 */
export function ViewerOnboardingModal({
  assetCode,
  userId,
  userEmail,
}: ViewerOnboardingModalProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(userEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only show inside iframe — full-screen viewer doesn't need this prompt.
    const inIframe = window.top !== window.self;
    if (!inIframe) return;

    // Don't show if permanently dismissed or already shown this session.
    let permanent = false;
    let session = false;
    try {
      permanent = localStorage.getItem(PERMANENT_FLAG) === "1";
      session = sessionStorage.getItem(SESSION_FLAG) === "1";
    } catch { /* ignore */ }
    if (permanent || session) return;

    // Brief delay so the viewer has a moment to render before we interrupt.
    const t = setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch { /* ignore */ }
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (userEmail && !email) setEmail(userEmail);
  }, [userEmail, email]);

  const handleClose = () => {
    if (dontShowAgain) {
      try { localStorage.setItem(PERMANENT_FLAG, "1"); } catch { /* ignore */ }
    }
    setOpen(false);
  };

  const handleDismissPermanent = () => {
    try { localStorage.setItem(PERMANENT_FLAG, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const handleSendLink = async () => {
    if (!assetCode || !email || sending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-viewer-link", {
        body: {
          email: email.trim(),
          assetCode,
          path: `/v2/solutions/${encodeURIComponent(assetCode)}`,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Link sent — check your inbox on your laptop");
      setTimeout(() => handleClose(), 1500);
    } catch (e) {
      console.error("send-viewer-link failed", e);
      toast.error("Couldn't send the link. Try again or open it on your laptop.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        className="max-w-md p-0 gap-0 border-0 overflow-hidden [&>button]:hidden"
        style={{ background: "#FFFFFF" }}
      >
        {/* Header band */}
        <div
          className="px-6 pt-6 pb-5 relative"
          style={{
            background: `linear-gradient(180deg, ${NAVY} 0%, #1A2A4F 100%)`,
            color: "#FFFFFF",
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.7)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X className="h-4 w-4" />
          </button>
          <div
            className="inline-flex items-center gap-2 mb-3 text-[10.5px] font-bold uppercase"
            style={{ color: "#FF6B7A", letterSpacing: "0.18em" }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 5, height: 5, background: RED, boxShadow: "0 0 6px rgba(206,17,38,0.6)" }}
            />
            {isMobile ? "Tip for cramming" : "Pro tip"}
          </div>
          <h2
            className="text-[22px] sm:text-[24px] leading-tight"
            style={{ fontFamily: LOGO_FONT, fontWeight: 400 }}
          >
            {isMobile ? "Cram better on a laptop." : "Press F11 for fullscreen."}
          </h2>
          <p
            className="mt-2 text-[13px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif" }}
          >
            {isMobile
              ? "The Solutions Viewer is built for a bigger screen. Send yourself a link and pick it up on your laptop."
              : "Hit F11 to give the viewer the full screen — way better for cramming."}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4" style={{ fontFamily: "Inter, sans-serif" }}>
          {isMobile ? (
            <>
              <div>
                <label
                  className="block text-[11px] font-semibold uppercase mb-1.5"
                  style={{ color: "#64748B", letterSpacing: "0.08em" }}
                >
                  Your email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="w-full rounded-md px-3 py-2.5 text-[14px] outline-none transition-all"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    color: NAVY,
                  }}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleSendLink}
                disabled={sending || sent || !email}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[14px] font-semibold text-white transition-all disabled:opacity-60"
                style={{
                  background: sent ? "#16A34A" : `linear-gradient(180deg, ${NAVY} 0%, #1A2A4F 100%)`,
                  boxShadow: "0 4px 12px rgba(20,33,61,0.18)",
                }}
              >
                <Mail className="h-4 w-4" />
                {sent ? "Sent — check your inbox" : sending ? "Sending…" : "Send link to my email"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-center text-[13px] font-medium hover:underline"
                style={{ color: "#64748B" }}
              >
                Continue on phone
              </button>
            </>
          ) : (
            <>
              <style>{`
                @keyframes sa-key-press {
                  0%, 70%, 100% {
                    transform: translateY(0);
                    box-shadow:
                      0 4px 0 rgba(20,33,61,0.45),
                      0 6px 10px rgba(20,33,61,0.18),
                      inset 0 1px 0 rgba(255,255,255,0.85);
                  }
                  82% {
                    transform: translateY(3px);
                    box-shadow:
                      0 1px 0 rgba(20,33,61,0.45),
                      0 2px 4px rgba(20,33,61,0.18),
                      inset 0 1px 0 rgba(255,255,255,0.65);
                  }
                }
                .sa-f11-key {
                  animation: sa-key-press 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
              `}</style>
              <div className="flex items-center justify-center py-2">
                <div
                  aria-hidden
                  className="sa-f11-key inline-flex items-center justify-center select-none"
                  style={{
                    minWidth: 64,
                    height: 52,
                    padding: "0 14px",
                    borderRadius: 8,
                    background: "linear-gradient(180deg, #FAFBFC 0%, #E5E9EF 100%)",
                    border: "1px solid #C7CDD6",
                    color: NAVY,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: "0.02em",
                  }}
                >
                  F11
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
                style={{
                  background: `linear-gradient(180deg, ${NAVY} 0%, #1A2A4F 100%)`,
                  boxShadow: "0 4px 12px rgba(20,33,61,0.18)",
                }}
              >
                Got it
              </button>

              <label
                className="flex items-center justify-center gap-2 cursor-pointer text-[12px] select-none"
                style={{ color: "#64748B" }}
              >
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="h-3.5 w-3.5 rounded cursor-pointer"
                  style={{ accentColor: NAVY }}
                />
                Don't show again
              </label>
            </>
          )}

          {/* Subtle viral share — only when logged in */}
          {userId && (
            <div className="pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
              <ReferralShareStrip userId={userId} variant="light" />
            </div>
          )}

          {/* Mobile + not logged in — still hint at sharing without the strip */}
          {isMobile && !userId && (
            <div
              className="pt-3 text-center text-[11px]"
              style={{ borderTop: "1px solid #F1F5F9", color: "#94A3B8" }}
            >
              <Laptop className="h-3 w-3 inline mr-1 -mt-0.5" />
              Sign in to invite friends and unlock more.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
