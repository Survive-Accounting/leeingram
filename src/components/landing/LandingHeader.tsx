import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AboutLeeModal } from "@/components/AboutLeeModal";

const NAVY = "#14213D";

interface LandingHeaderProps {
  onPricingClick: () => void;
}

export default function LandingHeader({ onPricingClick }: LandingHeaderProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { label: "About Lee", onClick: () => { setAboutOpen(true); setMenuOpen(false); } },
    { label: "Pricing", onClick: () => { onPricingClick(); setMenuOpen(false); } },
    { label: "Student Login", onClick: () => { window.location.href = "/login"; setMenuOpen(false); } },
  ];

  return (
    <>
      <header className="w-full" style={{ background: NAVY }}>
        <div className="mx-auto max-w-[900px] px-4 sm:px-6 flex items-center justify-between" style={{ height: 52 }}>
          {/* Logo */}
          <span
            className="text-[16px] text-white tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Survive Accounting™
          </span>

          {/* Desktop links */}
          <nav className="hidden sm:flex items-center gap-6">
            {links.map((l) => (
              <button
                key={l.label}
                onClick={l.onClick}
                className="text-[13px] text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {l.label}
              </button>
            ))}
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
          <div className="sm:hidden border-t border-white/10 px-4 pb-3 pt-2 space-y-1">
            {links.map((l) => (
              <button
                key={l.label}
                onClick={l.onClick}
                className="block w-full text-left text-[14px] text-white/70 hover:text-white py-2 transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
