import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MagicLinkModal from "./MagicLinkModal";

const NAVY = "#14213D";

interface StagingNavbarProps {
  onCtaClick: () => void;
  onPricingClick?: () => void;
}

export default function StagingNavbar({ onCtaClick, onPricingClick }: StagingNavbarProps) {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="sticky top-6 z-50 w-full">
      <nav
        className="w-full px-5 sm:px-8 h-16 flex items-center justify-between border-b"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,254,0.96) 100%)",
          borderColor: "rgba(20,33,61,0.08)",
          boxShadow: "0 4px 16px rgba(20,33,61,0.06), 0 1px 0 rgba(20,33,61,0.04)",
          backdropFilter: "blur(14px)",
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
            onClick={() => setLoginOpen(true)}
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

      <MagicLinkModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
