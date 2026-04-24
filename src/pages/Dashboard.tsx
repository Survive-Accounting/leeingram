import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";
const BG_GRADIENT =
  "radial-gradient(ellipse at 50% 0%, #DBEAFE 0%, #EFF6FF 35%, #F8FAFC 70%, #F8FAFC 100%)";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: BG_GRADIENT, fontFamily: "Inter, sans-serif" }}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl p-8 sm:p-10 text-center"
        style={{
          background: "#fff",
          border: "1px solid rgba(20,33,61,0.08)",
          boxShadow: "0 24px 60px rgba(20,33,61,0.10)",
        }}
      >
        <h1
          className="text-[30px] sm:text-[36px] leading-tight"
          style={{
            color: NAVY,
            fontFamily: "'DM Serif Display', serif",
            fontWeight: 400,
          }}
        >
          You're in. Let's get you ready for your exam.
        </h1>

        <button
          onClick={() => navigate("/cram")}
          className="mt-7 w-full rounded-xl py-3.5 text-[16px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(180deg, ${RED} 0%, #A8101F 100%)`,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 24px rgba(206,17,38,0.35)",
          }}
        >
          Start Studying <ArrowRight className="w-4 h-4" />
        </button>

        <p
          className="mt-5 text-[12px]"
          style={{ color: "#94A3B8" }}
        >
          Use your email anytime to log back in — no password needed.
        </p>
      </div>
    </div>
  );
}
