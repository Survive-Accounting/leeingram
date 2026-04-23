import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AboutLeeModal } from "@/components/AboutLeeModal";

const NAVY = "#14213D";

interface CampusHeaderProps {
  campusName: string;
  courseName: string;
}

export default function CampusHeader({ campusName, courseName }: CampusHeaderProps) {
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>{campusName ? `${campusName} | ` : ""}{courseName} Exam Prep | Survive Accounting</title>
        <meta
          name="description"
          content={`Practice problems and exam prep for ${courseName}${campusName ? ` at ${campusName}` : ""}. Trusted by 1,000+ students.`}
        />
      </Helmet>

      <div className="relative z-50 px-4 pt-4">
        <nav
          className="mx-auto max-w-[1000px] rounded-xl px-5 h-14 flex items-center justify-between"
          style={{
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            onClick={() => navigate("/staging")}
            className="text-[16px] sm:text-[18px] font-bold tracking-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            Survive Accounting
            <sup style={{ fontSize: 9, fontWeight: 400, marginLeft: 2, opacity: 0.6 }}>™</sup>
          </button>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => setAboutOpen(true)}
              className="hidden sm:inline-flex text-[13px] font-medium transition-opacity hover:opacity-70"
              style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
            >
              About Lee Ingram
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
              Log In →
            </button>
          </div>
        </nav>
      </div>

      <AboutLeeModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
