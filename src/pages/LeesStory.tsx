import { useState } from "react";
import { LogIn } from "lucide-react";
import LandingFooter from "@/components/landing/LandingFooter";
import StagingWaitlistModal from "@/components/landing/StagingWaitlistModal";

const NAVY = "#14213D";
const RED = "#CE1126";
const LEE_PHOTO = "https://i.ibb.co/nNmPgMws/Lee-About-Me-Image.jpg";

export default function LeesStory() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#F8F8FA" }}>
      {/* Hero — Mt Cook (same pattern as CourseLanding) */}
      <div className="relative overflow-hidden lees-hero" style={{ height: 340 }}>
        <style>{`
          @media (max-width: 640px) { .lees-hero { height: 280px !important; } }
          .lees-hero::before {
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
          .lees-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to right, rgba(20,33,61,0.55) 0%, rgba(20,33,61,0.6) 30%, rgba(20,33,61,0.2) 60%, rgba(20,33,61,0.4) 100%);
            z-index: 1;
          }
        `}</style>

        <div className="absolute top-4 right-4" style={{ zIndex: 10 }}>
          <a
            href="/admin"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors"
            style={{ color: "rgba(255,255,255,0.25)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)")}
          >
            <LogIn className="w-3.5 h-3.5" />
            Admin
          </a>
        </div>

        <div
          className="relative h-full mx-auto max-w-[900px] px-4 sm:px-6 flex items-center gap-6 sm:gap-8"
          style={{ zIndex: 2 }}
        >
          <div className="flex-1 min-w-0">
            <h1
              className="text-[28px] sm:text-[40px] text-white leading-tight"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              Why I Built This
            </h1>
            <p
              className="mt-2 text-[14px] sm:text-[16px]"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter, sans-serif" }}
            >
              The story behind Survive Accounting
            </p>
          </div>
          <img
            src={LEE_PHOTO}
            alt="Lee Ingram"
            className="hidden sm:block w-[140px] h-[140px] md:w-[170px] md:h-[170px] shrink-0 object-cover rounded-xl shadow-xl"
            style={{ border: "3px solid rgba(255,255,255,0.9)" }}
          />
        </div>
      </div>

      {/* Wave divider */}
      <div style={{ background: "#F8F8FA", marginTop: "-2px", overflow: "hidden", lineHeight: 0 }}>
        <svg
          viewBox="0 0 1440 60"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: "60px" }}
        >
          <path d="M0,30 C240,60 480,55 720,35 C960,15 1200,50 1440,30 L1440,0 L0,0 Z" fill="#14213D" />
        </svg>
      </div>

      {/* Mobile photo */}
      <div className="sm:hidden flex justify-center -mt-12 mb-2 relative z-10">
        <img
          src={LEE_PHOTO}
          alt="Lee Ingram"
          className="w-[110px] h-[110px] object-cover rounded-xl shadow-xl"
          style={{ border: "3px solid #fff" }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-[760px] space-y-6">
          {/* Section 1 — My Story (Navy card) */}
          <section
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: NAVY,
              boxShadow: "0 8px 32px rgba(20,33,61,0.18)",
            }}
          >
            <h2
              className="text-[22px] sm:text-[26px] text-white mb-3"
              style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              My Story
            </h2>
            <p
              className="text-[14px] sm:text-[15px] italic"
              style={{
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.7,
                fontFamily: "Inter, sans-serif",
              }}
            >
              [Lee's story coming soon — from Dr. Death's classroom to building the platform I wished
              existed as a student.]
            </p>
          </section>

          {/* Section 2 — Why Your Campus Should Care (Light gray card) */}
          <section
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "#F1F2F4",
              border: "1px solid #E5E7EB",
            }}
          >
            <h2
              className="text-[22px] sm:text-[26px] mb-3"
              style={{
                color: NAVY,
                fontFamily: "'DM Serif Display', serif",
                fontWeight: 400,
              }}
            >
              Why Your Campus Should Care
            </h2>
            <p
              className="text-[14px] sm:text-[15px] italic"
              style={{
                color: "#6B7280",
                lineHeight: 1.7,
                fontFamily: "Inter, sans-serif",
              }}
            >
              [Coming soon — why Survive Accounting is different from every other study tool out
              there, and why professors and students both love it.]
            </p>
          </section>

          {/* Footer CTA */}
          <div
            className="text-center pt-6 text-[15px] sm:text-[16px]"
            style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
          >
            Want Survive Accounting at your school?{" "}
            <button
              type="button"
              onClick={() => setWaitlistOpen(true)}
              className="font-semibold underline underline-offset-2 hover:opacity-80"
              style={{ color: RED }}
            >
              Join the waitlist →
            </button>
          </div>
        </div>
      </main>

      <LandingFooter
        onScrollToCourses={() => (window.location.href = "/")}
        onScrollToContact={() => (window.location.href = "/")}
      />

      <StagingWaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        initialEmail=""
      />
    </div>
  );
}
