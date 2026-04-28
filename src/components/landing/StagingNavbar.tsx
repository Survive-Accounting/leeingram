import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Allow other pages to open the login modal by redirecting to "/?login=1"
  useEffect(() => {
    if (searchParams.get("login")) {
      setLoginOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("login");
      next.delete("reason");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
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
        {/* Solid layer — fades in on scroll/hover (navy so the white wordmark + amber dot stay legible) */}
        <div
          aria-hidden
          className="absolute inset-0 border-b pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,33,61,0.96) 0%, rgba(16,26,49,0.96) 100%)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.04) inset",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            opacity: isSolid ? 1 : 0,
            transition: `opacity ${TRANSITION}`,
          }}
        />

        {/* Logo — image wordmark, matches problem viewer */}
        <button
          onClick={() => navigate("/")}
          className="relative inline-flex items-center"
          aria-label="Survive Accounting — home"
        >
          {/* Navy version (on solid bg) */}
          <img
            src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
            alt="Survive Accounting"
            className="h-5 sm:h-[22px] w-auto object-contain select-none"
            draggable={false}
            style={{
              opacity: isSolid ? 1 : 0,
              transition: `opacity ${TRANSITION}`,
            }}
          />
          {/* White version (on transparent bg) */}
          <img
            aria-hidden
            src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png"
            alt=""
            className="h-5 sm:h-[22px] w-auto object-contain select-none absolute inset-0"
            draggable={false}
            style={{
              filter: "brightness(0) invert(1)",
              opacity: isSolid ? 0 : 1,
              transition: `opacity ${TRANSITION}`,
            }}
          />
        </button>

        {/* Right side */}
        <div className="relative flex items-center gap-3 sm:gap-5">
          <button
            onClick={handleCourses}
            className="hidden sm:inline-block text-[13px] font-semibold hover:opacity-70"
            style={{
              color: isSolid ? NAVY : "rgba(255,255,255,0.85)",
              fontFamily: "Inter, sans-serif",
              transition: `color ${TRANSITION}`,
            }}
          >
            What's inside
          </button>

          {/* Log in — quiet secondary link */}
          <button
            onClick={() => setLoginOpen(true)}
            className="text-[13px] font-medium hover:opacity-100"
            style={{
              color: isSolid ? "rgba(20,33,61,0.65)" : "rgba(255,255,255,0.7)",
              fontFamily: "Inter, sans-serif",
              transition: `color ${TRANSITION}`,
              opacity: 0.95,
            }}
          >
            Log in
          </button>

          {/* Primary CTA — Get free access */}
          <button
            onClick={onCtaClick}
            className="group relative text-[13px] font-semibold active:scale-[0.98] inline-flex items-center text-white"
            style={{
              borderRadius: 8,
              padding: "9px 16px",
              fontFamily: "Inter, sans-serif",
              background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
              boxShadow: "0 4px 14px rgba(206,17,38,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <span className="relative inline-flex items-center group-hover:brightness-110">
              Get free access <AnimatedArrow />
            </span>
          </button>
        </div>
      </nav>

      <MagicLinkModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
