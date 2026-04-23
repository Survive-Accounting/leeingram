import { Sword, PenLine, MonitorPlay, type LucideIcon } from "lucide-react";

const NAVY = "#14213D";

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
        boxShadow: "0 12px 40px rgba(20,33,61,0.10), 0 2px 6px rgba(20,33,61,0.06)",
        border: "1px solid rgba(20,33,61,0.06)",
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
}

export default function StagingFeatureCardsSection({
  onBrowseTools,
  onBrowseProblems,
  onRequestEarlyAccess,
}: Props) {
  return (
    <section className="py-16 px-4 sm:px-6" style={{ background: "#F8FAFC" }}>
      <div className="max-w-[1100px] mx-auto w-full">
        <div className="text-center mb-12">
          <h2
            className="text-[32px] sm:text-[44px] md:text-[52px] font-bold leading-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Your next exam is coming up.
          </h2>
          <p
            className="mt-4 text-[16px] sm:text-[18px]"
            style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}
          >
            Get exactly what you need to study smarter.
          </p>
        </div>

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
