import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#14213D";

interface StagingStickyBarProps {
  onCtaClick?: () => void;
  /** Hide entirely (e.g. when an email modal is open). */
  hidden?: boolean;
}

/**
 * Desktop (≥768px): slim white bar at top with Log In, fades in after the hero scrolls out.
 * Mobile (<768px): always-visible bottom navy bar with Log In link.
 */
export default function StagingStickyBar({ hidden = false }: StagingStickyBarProps) {
  const navigate = useNavigate();
  const [showDesktop, setShowDesktop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
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
          top: 24,
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

          <button
            onClick={() => navigate("/login")}
            className="text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: NAVY,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 2px 8px rgba(20,33,61,0.25)",
            }}
          >
            Student Login
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div
        className="md:hidden fixed left-0 right-0 bottom-0 z-[90]"
        style={{
          background: NAVY,
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          paddingTop: 12,
          paddingLeft: 16,
          paddingRight: 16,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={() => navigate("/login")}
          className="w-full rounded-lg text-[15px] font-bold flex items-center justify-center transition-all active:scale-[0.99]"
          style={{
            background: "#BFDBFE",
            color: NAVY,
            fontFamily: "Inter, sans-serif",
            minHeight: 48,
          }}
        >
          Log In →
        </button>
      </div>
    </>
  );
}
