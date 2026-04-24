import { useState, useEffect } from "react";
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

  const navStyle: React.CSSProperties = isSolid
    ? {
        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,254,0.96) 100%)",
        borderColor: "rgba(20,33,61,0.08)",
        boxShadow: "0 4px 16px rgba(20,33,61,0.06), 0 1px 0 rgba(20,33,61,0.04)",
        backdropFilter: "blur(14px)",
      }
    : {
        background: "transparent",
        borderColor: "transparent",
        boxShadow: "none",
        backdropFilter: "none",
      };

  const accountingColor = isSolid ? NAVY : "#FFFFFF";
  const mutedTextColor = isSolid ? NAVY : "rgba(255,255,255,0.85)";

  const loginStyle: React.CSSProperties = isSolid
    ? {
        background: NAVY,
        color: "#fff",
        border: "1px solid transparent",
        borderRadius: 8,
        padding: "9px 18px",
        fontFamily: "Inter, sans-serif",
        boxShadow: "0 2px 8px rgba(20,33,61,0.25)",
      }
    : {
        background: "transparent",
        color: "#FFFFFF",
        border: "1px solid rgba(255,255,255,0.85)",
        borderRadius: 8,
        padding: "9px 18px",
        fontFamily: "Inter, sans-serif",
        boxShadow: "none",
      };

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
      onMouseEnter={() => transparentOnTop && setHovered(true)}
      onMouseLeave={() => transparentOnTop && setHovered(false)}
    >
      <nav
        className="w-full px-5 sm:px-8 h-16 flex items-center justify-between border-b"
        style={{ ...navStyle, transition: "all 0.3s ease" }}
      >
        {/* Logo */}
        <button
          onClick={() => navigate("/staging")}
          className="text-[16px] sm:text-[18px] tracking-tight"
          style={{
            fontFamily: "'DM Serif Display', serif",
            transition: "color 0.3s ease",
          }}
        >
          <span style={{ color: RED, fontWeight: 800 }}>Survive</span>
          <span style={{ color: accountingColor, fontWeight: 400 }}>
            {" "}Accounting
            <sup className="text-[9px] font-normal ml-0.5 opacity-70">™</sup>
          </span>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-5">
          <button
            onClick={handleCourses}
            className="hidden sm:inline-block text-[13px] font-semibold transition-colors hover:opacity-70"
            style={{ color: mutedTextColor, fontFamily: "Inter, sans-serif", transition: "color 0.3s ease" }}
          >
            Courses
          </button>
          <button
            onClick={() => {
              if (onPricingClick) onPricingClick();
              else navigate("/get-access");
            }}
            className="text-[13px] font-semibold transition-colors hover:opacity-70"
            style={{ color: mutedTextColor, fontFamily: "Inter, sans-serif", transition: "color 0.3s ease" }}
          >
            Pricing
          </button>
          <button
            onClick={() => setLoginOpen(true)}
            className="group text-[13px] font-semibold hover:brightness-110 active:scale-[0.98] inline-flex items-center"
            style={{ ...loginStyle, transition: "all 0.3s ease" }}
          >
            Log In <AnimatedArrow />
          </button>
        </div>
      </nav>

      <MagicLinkModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
