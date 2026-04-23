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

function Card({ title, body, buttonLabel, icon: Icon, iconColor, onClick }: CardProps) {
  return (
    <div
      className="rounded-2xl px-7 py-9 flex flex-col items-center text-center transition-all hover:-translate-y-0.5"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)",
      }}
    >
      <div className="mb-5 flex items-center justify-center" style={{ height: 48 }}>
        <Icon size={44} color={iconColor} strokeWidth={1.5} opacity={0.85} />
      </div>
      <h3
        className="text-[20px] font-bold mb-3"
        style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
      >
        {title}
      </h3>
      <p
        className="text-[13px] leading-relaxed mb-6 flex-1"
        style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}
      >
        {body}
      </p>
      <button
        onClick={onClick}
        className="rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99]"
        style={{
          background: NAVY,
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 1px 2px rgba(20,33,61,0.10)",
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
      className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 relative"
      style={{ scrollMarginTop: "0px" }}
    >
      <div className="max-w-[1100px] mx-auto w-full relative" style={{ zIndex: 1 }}>
        <div className="text-center mb-16 md:mb-20">
          <h2
            className="text-[32px] sm:text-[44px] md:text-[52px] font-bold leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            {new Date() < new Date("2026-05-16T00:00:00")
              ? "Final exams are 1 week away."
              : "Your next exam is coming up."}
          </h2>
          <p
            className="mt-2 text-[16px] sm:text-[18px]"
            style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
          >
            Get exactly what you need to study smarter.
          </p>

          {/* Subtle underlined link */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onStartStudying}
              className="text-[15px] md:text-[16px] font-semibold underline underline-offset-[6px] decoration-2 transition-opacity hover:opacity-80 px-2 py-1.5"
              style={{
                color: NAVY,
                fontFamily: "Inter, sans-serif",
                background: "none",
                border: "none",
              }}
            >
              Start studying now →
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1040px] grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 justify-items-stretch">
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
