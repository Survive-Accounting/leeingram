import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MagicLinkModal from "./MagicLinkModal";

const NAVY = "#14213D";

interface StagingNavbarProps {
  onCtaClick: () => void;
  onPricingClick?: () => void;
  /** When true, navbar is transparent at top of page and turns solid white on scroll/hover. */
  transparentOnTop?: boolean;
}

export default function StagingNavbar({ onCtaClick, onPricingClick, transparentOnTop = false }: StagingNavbarProps) {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!transparentOnTop) return;
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentOnTop]);

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

  const textColor = isSolid ? NAVY : "#FFFFFF";
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
          className="text-[16px] sm:text-[18px] font-bold tracking-tight"
          style={{
            color: textColor,
            fontFamily: "'DM Serif Display', serif",
            transition: "color 0.3s ease",
          }}
        >
          Survive Accounting{!isSolid ? "™" : ""}
        </button>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-5">
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
            className="text-[13px] font-semibold hover:brightness-110 active:scale-[0.98]"
            style={{ ...loginStyle, transition: "all 0.3s ease" }}
          >
            Login
          </button>
        </div>
      </nav>

      <MagicLinkModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
