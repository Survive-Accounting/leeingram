import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#14213D";
const RED = "#CE1126";

interface StagingStickyBarProps {
  onCtaClick: () => void;
  /** Hide entirely (e.g. when an email modal is open). */
  hidden?: boolean;
}

/**
 * Two stickies in one:
 *   - Desktop (≥768px): slim white bar at top, fades in after the hero scrolls out.
 *   - Mobile (<768px): always-visible bottom navy bar with red CTA + login link.
 */
export default function StagingStickyBar({ onCtaClick, hidden = false }: StagingStickyBarProps) {
  const navigate = useNavigate();
  const [showDesktop, setShowDesktop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past ~480px (hero min-height)
      setShowDesktop(window.scrollY > 460);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (hidden) return null;

  return (
    <>
      {/* DESKTOP STICKY TOP BAR */}
      <div
        className="hidden md:block fixed left-0 right-0 z-[90] transition-all duration-300"
        style={{
          top: 24, // below the amber "STAGING" banner
          opacity: showDesktop ? 1 : 0,
          transform: showDesktop ? "translateY(0)" : "translateY(-12px)",
          pointerEvents: showDesktop ? "auto" : "none",
        }}
      >
        <div
          className="mx-auto max-w-[1100px] mx-4 rounded-xl px-5 h-14 flex items-center justify-between"
          style={{
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 6px 24px rgba(20,33,61,0.10), 0 1px 2px rgba(0,0,0,0.04)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={() => navigate("/staging")}
            className="text-[16px] font-bold tracking-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            Survive Accounting
          </button>

          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate("/login")}
              className="text-[12px] font-medium transition-colors hover:opacity-80"
              style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
            >
              Log in →
            </button>
            <button
              onClick={onCtaClick}
              className="rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: RED,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 2px 8px rgba(206,17,38,0.25)",
              }}
            >
              Start Studying →
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div
        className="md:hidden fixed left-0 right-0 bottom-0 z-[90]"
        style={{
          background: NAVY,
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          paddingTop: 10,
          paddingLeft: 16,
          paddingRight: 16,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={() => navigate("/login")}
          className="block w-full text-center text-[12px] mb-2 transition-opacity hover:opacity-90"
          style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif" }}
        >
          Already have access? Log in →
        </button>
        <button
          onClick={onCtaClick}
          className="w-full rounded-lg text-white text-[15px] font-bold flex items-center justify-center transition-all active:scale-[0.99]"
          style={{
            background: RED,
            fontFamily: "Inter, sans-serif",
            minHeight: 56,
            boxShadow: "0 4px 14px rgba(206,17,38,0.35)",
          }}
        >
          Start Studying →
        </button>
      </div>
    </>
  );
}
