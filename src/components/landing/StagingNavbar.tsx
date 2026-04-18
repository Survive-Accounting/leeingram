import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#14213D";
const RED = "#CE1126";

interface StagingNavbarProps {
  onCtaClick: () => void;
}

export default function StagingNavbar({ onCtaClick }: StagingNavbarProps) {
  const navigate = useNavigate();

  return (
    <div className="relative z-50 px-4 pt-4">
      <nav
        className="mx-auto max-w-[1000px] rounded-xl px-5 h-14 flex items-center justify-between"
        style={{ 
          background: "rgba(255,255,255,0.98)", 
          boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Logo */}
        <button
          onClick={() => navigate("/staging")}
          className="text-[16px] sm:text-[18px] font-bold tracking-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
        >
          Survive Accounting
        </button>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-5">
          <button
            onClick={() => navigate("/greek-landing")}
            className="text-[13px] font-medium transition-opacity hover:opacity-70"
            style={{ color: NAVY, opacity: 0.7, fontFamily: "Inter, sans-serif" }}
          >
            For Greek Orgs
          </button>

          <button
            onClick={() => navigate("/login")}
            className="text-[13px] font-medium transition-colors"
            style={{
              background: "#BFDBFE",
              color: NAVY,
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontFamily: "Inter, sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#93C5FD")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#BFDBFE")}
          >
            Log In →
          </button>
        </div>
      </nav>
    </div>
  );
}
