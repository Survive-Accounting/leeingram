import { Helmet } from "react-helmet-async";
import SiteNavbar from "@/components/landing/SiteNavbar";

const NAVY = "#14213D";

interface CampusHeaderProps {
  campusName: string;
  courseName: string;
}

export default function CampusHeader({ campusName, courseName }: CampusHeaderProps) {
  return (
    <>
      <Helmet>
        <title>{campusName ? `${campusName} | ` : ""}{courseName} Exam Prep | Survive Accounting</title>
        <meta
          name="description"
          content={`Practice problems and exam prep for ${courseName}${campusName ? ` at ${campusName}` : ""}. Trusted by 1,000+ students.`}
        />
      </Helmet>

      <SiteNavbar />

      <div className="relative overflow-hidden campus-hero" style={{ height: 260 }}>
        <style>{`
          @media (max-width: 640px) { .campus-hero { height: 200px !important; } }
          .campus-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url('https://i.ibb.co/Qj8d4Hhs/Survive-Accounting-Hero-Image.jpg');
            background-size: cover;
            background-position: 60% 40%;
            background-repeat: no-repeat;
            transform: scaleX(-1);
            z-index: 0;
          }
          .campus-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to right, rgba(20,33,61,0.35) 0%, rgba(20,33,61,0.5) 30%, rgba(20,33,61,0.65) 50%, rgba(20,33,61,0.5) 70%, rgba(20,33,61,0.35) 100%);
            z-index: 1;
          }
        `}</style>

        <div className="relative h-full mx-auto max-w-[900px] px-4 sm:px-6 flex flex-col items-center justify-center text-center" style={{ zIndex: 2 }}>
          <h1
            className="text-[30px] sm:text-[42px] md:text-[48px] text-white leading-[1.15] tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)" }}
          >
            {courseName}
          </h1>
          {campusName ? (
            <p className="mt-3 text-[14px] sm:text-[15px] tracking-wide" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
              {campusName} · Exam prep by Lee Ingram
            </p>
          ) : (
            <p className="mt-3 text-[14px] sm:text-[15px] tracking-wide" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
              Exam prep by Lee Ingram · Trusted by 1,000+ students
            </p>
          )}
        </div>
      </div>

      {/* Wave divider */}
      <div style={{ background: "#F8F8FA", marginTop: "-2px", overflow: "hidden", lineHeight: 0 }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "60px" }}>
          <path d="M0,30 C240,60 480,55 720,35 C960,15 1200,50 1440,30 L1440,0 L0,0 Z" fill={NAVY} />
        </svg>
      </div>
    </>
  );
}
