import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { AboutLeeModal } from "@/components/AboutLeeModal";

const NAVY = "#14213D";

interface LandingHeaderProps {
  onPricingClick: () => void;
  onCoursesClick: () => void;
}

export default function LandingHeader({ onPricingClick, onCoursesClick }: LandingHeaderProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "About Lee", onClick: () => { setAboutOpen(true); setMenuOpen(false); } },
    { label: "Pricing", onClick: () => { onPricingClick(); setMenuOpen(false); } },
  ];

  return (
    <>
      <header
        className="w-full fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          background: scrolled ? "rgba(20,33,61,0.92)" : NAVY,
          backdropFilter: scrolled ? "blur(8px)" : "none",
          height: 64,
        }}
      >
        <div className="mx-auto max-w-[900px] h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <span className="text-[17px] text-white tracking-tight" style={{ fontFamily: "Inter, sans-serif" }}>
            <span className="font-bold">Survive</span>{" "}
            <span className="font-normal">Accounting</span>
            <sup className="text-[9px] font-normal ml-0.5 opacity-60">™</sup>
          </span>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6">
            {navLinks.map((l) => (
              <button
                key={l.label}
                onClick={l.onClick}
                className="text-[13px] text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={() => { onCoursesClick(); setMenuOpen(false); }}
              className="text-[13px] font-semibold text-white px-5 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: "#CE1126", fontFamily: "Inter, sans-serif" }}
            >
              Courses
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-white/70 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="sm:hidden px-4 pb-4 pt-2 space-y-1"
            style={{ background: NAVY, borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            {navLinks.map((l) => (
              <button
                key={l.label}
                onClick={l.onClick}
                className="block w-full text-left text-[14px] text-white/70 hover:text-white py-2 transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={() => { onCoursesClick(); setMenuOpen(false); }}
              className="block w-full text-center text-[14px] font-semibold text-white py-2.5 mt-2 rounded-lg"
              style={{ background: "#CE1126", fontFamily: "Inter, sans-serif" }}
            >
              Courses
            </button>
          </div>
        )}
      </header>

      {/* Spacer for fixed header */}
      <div style={{ height: 64 }} />

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
