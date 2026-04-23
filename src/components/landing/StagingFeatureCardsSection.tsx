import { Sword, PenLine, MonitorPlay, type LucideIcon } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface CardProps {
  title: string;
  body: string;
  buttonLabel: string;
  icon: LucideIcon;
  iconColor: string;
  tint: string;
  onClick?: () => void;
}

function Card({ title, body, buttonLabel, icon: Icon, iconColor, tint, onClick }: CardProps) {
  return (
    <div
      className="rounded-2xl px-5 py-5 flex flex-col items-center text-center"
      style={{
        background: tint,
        boxShadow: "0 12px 40px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.18)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="mb-3 flex items-center justify-center" style={{ height: 48 }}>
        <Icon size={48} color={iconColor} strokeWidth={1.75} />
      </div>
      <h3
        className="text-[20px] font-bold mb-2"
        style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] leading-snug mb-4 flex-1"
        style={{ color: "#4B5563", fontFamily: "Inter, sans-serif" }}
      >
        {body}
      </p>
      <button
        onClick={onClick}
        className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99]"
        style={{
          background: NAVY,
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 2px 8px rgba(20,33,61,0.20)",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface Props {
  onBrowseTools?: () => void;
  onBrowseProblems?: () => void;
  onRequestEarlyAccess?: () => void;
  onStartStudying?: () => void;
}

export default function StagingFeatureCardsSection({
  onBrowseTools,
  onBrowseProblems,
  onRequestEarlyAccess,
  onStartStudying,
}: Props) {
  return (
    <section
      id="exam-coming-up"
      className="pt-20 pb-8 px-4 sm:px-6 relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, #0F1A2E 0%, ${NAVY} 100%)`,
        scrollMarginTop: "0px",
      }}
    >
      <div className="max-w-[1100px] mx-auto w-full relative">
        <div className="text-center mb-10">
          <h2
            className="text-[32px] sm:text-[44px] md:text-[52px] font-bold leading-tight text-white"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, textShadow: "2px 2px 12px rgba(0,0,0,0.5)" }}
          >
            {new Date() < new Date("2026-05-16T00:00:00")
              ? "Final exams are 1 week away."
              : "Your next exam is coming up."}
          </h2>
          <p
            className="mt-4 text-[16px] sm:text-[18px]"
            style={{ color: "rgba(255,255,255,0.78)", fontFamily: "Inter, sans-serif" }}
          >
            Get exactly what you need to study smarter.
          </p>

          {/* Subtle underlined link */}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onStartStudying}
              className="text-[15px] md:text-[16px] font-semibold underline underline-offset-[6px] decoration-2 transition-opacity hover:opacity-100 opacity-90 px-2 py-1.5"
              style={{
                color: "rgba(255,255,255,0.92)",
                fontFamily: "Inter, sans-serif",
                background: "none",
                border: "none",
              }}
            >
              Start studying now →
            </button>
          </div>
        </div>

        {/* Padding spacer between CTA and feature cards */}
        <div className="h-8 md:h-12" aria-hidden="true" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          <Card
            icon={Sword}
            iconColor="#16a34a"
            tint="#f0fdf4"
            title="Survival Tools"
            body="Built for late night cramming. Flashcards, journal entries, formulas — optimized for speed."
            buttonLabel="Browse Tools →"
            onClick={onBrowseTools}
          />
          <Card
            icon={PenLine}
            iconColor="#d97706"
            tint="#fffbeb"
            title="Practice Problems"
            body="Your solutions manual sucks. Mine actually teach you something."
            buttonLabel="Browse Problems →"
            onClick={onBrowseProblems}
          />
          <Card
            icon={MonitorPlay}
            iconColor="#2563eb"
            tint="#eff6ff"
            title="On Demand Videos"
            body="Lee's full video library, 24/7. Binge what's there, request what's not. New videos drop every week."
            buttonLabel="Request Early Access"
            onClick={onRequestEarlyAccess}
          />
        </div>
      </div>
    </section>
  );
}
