import { Play, X } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

export function WelcomeVideoCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl text-left transition-all hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        width: "100%",
        maxWidth: 320,
        aspectRatio: "16 / 9",
        background:
          "linear-gradient(135deg, #14213D 0%, #1E3A66 60%, #14213D 100%)",
        border: "1px solid rgba(20,33,61,0.12)",
        boxShadow: "0 12px 32px rgba(20,33,61,0.18)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-3xl"
        style={{ background: RED }}
      />
      <div className="relative h-full w-full p-5 flex flex-col justify-between">
        <div
          className="inline-flex items-center self-start gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.12)", color: "#FCA5A5" }}
        >
          A note from Lee
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full transition-transform group-hover:scale-110"
            style={{
              width: 48,
              height: 48,
              background: "#fff",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            }}
          >
            <Play
              className="h-5 w-5 ml-0.5"
              style={{ color: NAVY, fill: NAVY }}
            />
          </div>
          <div className="min-w-0">
            <p
              className="text-[14px] leading-tight"
              style={{
                color: "#fff",
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              Watch the welcome video
            </p>
            <p
              className="text-[11.5px] mt-0.5"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              ~90 seconds · Start here
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

export function WelcomeVideoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-black"
        style={{ aspectRatio: "16 / 9", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full p-2 hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Play className="h-7 w-7 ml-0.5 text-white/80" />
          </div>
          <p
            className="text-[20px] sm:text-[26px]"
            style={{
              color: "#fff",
              fontFamily: "'DM Serif Display', serif",
              fontWeight: 400,
            }}
          >
            Welcome video coming soon
          </p>
          <p
            className="mt-2 text-[13px] max-w-md"
            style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif" }}
          >
            Lee is recording a quick walkthrough of the beta. It'll show up right here.
          </p>
        </div>
      </div>
    </div>
  );
}
