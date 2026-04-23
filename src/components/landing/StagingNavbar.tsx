import { useState } from "react";
import { useNavigate } from "react-router-dom";

const NAVY = "#14213D";
const RED = "#CE1126";

interface StagingNavbarProps {
  onCtaClick: () => void;
  onPricingClick?: () => void;
}

export default function StagingNavbar({ onCtaClick, onPricingClick }: StagingNavbarProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-6 z-50 w-full">
      <nav
        className="w-full px-5 sm:px-8 h-16 flex items-center justify-between border-b"
        style={{
          background: "rgba(255,255,255,0.98)",
          borderColor: "rgba(0,0,0,0.06)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
            onClick={() => {
              if (onPricingClick) onPricingClick();
              else navigate("/get-access");
            }}
            className="text-[13px] font-semibold transition-colors hover:opacity-70"
            style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
          >
            Pricing
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
            Login
          </button>
        </div>
      </nav>
    </div>
  );
}
