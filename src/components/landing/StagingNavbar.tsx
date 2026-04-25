import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MagicLinkModal from "./MagicLinkModal";
import AnimatedArrow from "./AnimatedArrow";

const NAVY = "#14213D";
const RED = "#CC0000";

interface StagingNavbarProps {
  onCtaClick: () => void;
  onPricingClick?: () => void;
  onCoursesClick?: () => void;
  /** When true, navbar is transparent at top of page and turns solid white on scroll/hover. */
  transparentOnTop?: boolean;
}

export default function StagingNavbar({
  onCtaClick,
  onPricingClick,
  onCoursesClick,
  transparentOnTop = false,
}: StagingNavbarProps) {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!transparentOnTop) return;
    // Use a hysteresis range so the bar doesn't flicker right at the threshold.
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 40 : y > 80));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentOnTop]);

  const handleMouseEnter = () => {
    if (!transparentOnTop) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    // Small delay so a passing cursor doesn't trigger the flip
    hoverTimer.current = window.setTimeout(() => setHovered(true), 120);
  };
  const handleMouseLeave = () => {
    if (!transparentOnTop) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(false), 180);
  };

  // "Solid" = white background, navy text. "Transparent" = clear bg, white text.
  const isSolid = !transparentOnTop || scrolled || hovered;

  // Always-mounted layers; we just toggle opacity for a smooth crossfade.
  const TRANSITION = "600ms cubic-bezier(0.4, 0, 0.2, 1)";

  const handleCourses = () => {
    if (onCoursesClick) {
      onCoursesClick();
      return;
    }
    const el = document.getElementById("exam-coming-up");
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div
      className={`${transparentOnTop ? "fixed" : "sticky"} top-0 left-0 right-0 z-50 w-full`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <nav
        className="relative w-full px-5 sm:px-8 h-16 flex items-center justify-between"
        style={{ background: "transparent" }}
      >
        {/* Solid layer — fades in on scroll/hover */}
        <div
          aria-hidden
          className="absolute inset-0 border-b pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,254,0.96) 100%)",
            borderColor: "rgba(20,33,61,0.08)",
            boxShadow: "0 4px 16px rgba(20,33,61,0.06), 0 1px 0 rgba(20,33,61,0.04)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            opacity: isSolid ? 1 : 0,
            transition: `opacity ${TRANSITION}`,
          }}
        />

        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="relative text-[16px] sm:text-[18px] tracking-tight"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          <span style={{ color: RED, fontWeight: 800 }}>Survive</span>
          {/* Crossfade Accounting text colors */}
          <span className="relative inline-block" style={{ fontWeight: 400 }}>
            <span
              style={{
                color: "#FFFFFF",
                opacity: isSolid ? 0 : 1,
                transition: `opacity ${TRANSITION}`,
              }}
            >
              {" "}Accounting
              <sup className="text-[9px] font-normal ml-0.5 opacity-70">™</sup>
            </span>
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                color: NAVY,
                opacity: isSolid ? 1 : 0,
                transition: `opacity ${TRANSITION}`,
              }}
            >
              {" "}Accounting
              <sup className="text-[9px] font-normal ml-0.5 opacity-70">™</sup>
            </span>
          </span>
        </button>

        {/* Right side */}
        <div className="relative flex items-center gap-4 sm:gap-5">
          <button
            onClick={handleCourses}
            className="hidden sm:inline-block text-[13px] font-semibold hover:opacity-70"
            style={{
              color: isSolid ? NAVY : "rgba(255,255,255,0.85)",
              fontFamily: "Inter, sans-serif",
              transition: `color ${TRANSITION}`,
            }}
          >
            Courses
          </button>
          <button
            onClick={() => {
              if (onPricingClick) onPricingClick();
              else navigate("/get-access");
            }}
            className="text-[13px] font-semibold hover:opacity-70"
            style={{
              color: isSolid ? NAVY : "rgba(255,255,255,0.85)",
              fontFamily: "Inter, sans-serif",
              transition: `color ${TRANSITION}`,
            }}
          >
            Pricing
          </button>

          {/* Log In — wrap two visual states and crossfade between them */}
          <button
            onClick={() => setLoginOpen(true)}
            className="group relative text-[13px] font-semibold active:scale-[0.98] inline-flex items-center"
            style={{
              borderRadius: 8,
              padding: "9px 18px",
              fontFamily: "Inter, sans-serif",
              color: "#FFFFFF",
              background: "transparent",
              border: "1px solid transparent",
            }}
          >
            {/* Transparent-state ring */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-[8px]"
              style={{
                border: "1px solid rgba(255,255,255,0.85)",
                opacity: isSolid ? 0 : 1,
                transition: `opacity ${TRANSITION}`,
              }}
            />
            {/* Solid-state navy fill */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-[8px]"
              style={{
                background: NAVY,
                boxShadow: "0 2px 8px rgba(20,33,61,0.25)",
                opacity: isSolid ? 1 : 0,
                transition: `opacity ${TRANSITION}`,
              }}
            />
            <span className="relative inline-flex items-center group-hover:brightness-110">
              Log In <AnimatedArrow />
            </span>
          </button>
        </div>
      </nav>

      <MagicLinkModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
