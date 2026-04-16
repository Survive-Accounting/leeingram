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
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={() => navigate("/greek")}
            className="hidden sm:inline text-[12px] font-medium transition-colors hover:opacity-80"
            style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
          >
            For Greek Orgs
          </button>

          <button
            onClick={() => navigate("/login")}
            className="text-[12px] font-medium transition-colors hover:opacity-80"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            Log in
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
      </nav>
    </div>
  );
}
