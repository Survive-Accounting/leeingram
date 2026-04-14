import { Helmet } from "react-helmet-async";

const NAVY = "#14213D";

interface CampusHeaderProps {
  campusName: string;
  courseName: string;
}

export default function CampusHeader({ campusName, courseName }: CampusHeaderProps) {
  return (
    <>
      <Helmet>
        <title>{campusName} | {courseName} Exam Prep | Survive Accounting</title>
        <meta
          name="description"
          content={`Practice problems and exam prep for ${courseName} at ${campusName}. Trusted by 1,000+ students.`}
        />
      </Helmet>

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
            background: linear-gradient(to right, rgba(20,33,61,0.5) 0%, rgba(20,33,61,0.6) 30%, rgba(20,33,61,0.15) 60%, rgba(20,33,61,0.4) 100%);
            z-index: 1;
          }
        `}</style>

        <div className="relative h-full mx-auto max-w-[780px] px-4 sm:px-6 flex flex-col justify-center" style={{ zIndex: 2 }}>
          <p className="text-[12px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {campusName}
          </p>
          <h1
            className="text-[24px] sm:text-[32px] text-white leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
          >
            {courseName}
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            Practice problems, explanations & exam prep
          </p>
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
