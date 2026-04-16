import { Brain, Clock, PenLine, RotateCw, Target, AlertCircle } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface PainPoint {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  text: string;
  accentBg: string;
  accentColor: string;
}

const PAIN_POINTS: PainPoint[] = [
  {
    icon: Brain,
    title: "You feel lost during lectures",
    text: "The professor is explaining it… but it feels like a foreign language. In one ear, out the other.",
    accentBg: "rgba(20,33,61,0.08)",
    accentColor: NAVY,
  },
  {
    icon: Clock,
    title: "You're cramming before exams",
    text: "You study for hours and hours… and still bomb the exam.",
    accentBg: "rgba(206,17,38,0.08)",
    accentColor: RED,
  },
  {
    icon: PenLine,
    title: "Homework problems don't make sense",
    text: "You look at the solution and still don't understand anything. It feels more like a crutch than a teaching tool.",
    accentBg: "rgba(99,102,241,0.08)",
    accentColor: "#4F46E5",
  },
  {
    icon: RotateCw,
    title: "You memorize instead of understanding",
    text: "It feels familiar — until you have to actually do it on the exam.",
    accentBg: "rgba(217,119,6,0.08)",
    accentColor: "#B45309",
  },
  {
    icon: Target,
    title: "You don't know what to focus on",
    text: "Your textbook is huge. Everything feels important… which makes it hard to know where to start.",
    accentBg: "rgba(34,197,94,0.08)",
    accentColor: "#15803D",
  },
  {
    icon: AlertCircle,
    title: "You've already struggled on a test",
    text: "Which feels awful. You know you can do better — and you want to turn things around before the next one.",
    accentBg: "rgba(139,92,246,0.08)",
    accentColor: "#7C3AED",
  },
];

interface ThisIsForYouSectionProps {
  onCtaClick: () => void;
}

export default function ThisIsForYouSection({ onCtaClick }: ThisIsForYouSectionProps) {
  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[800px]">
        {/* Section Header */}
        <div className="text-center mb-14">
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            This is for you if...
          </h2>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {PAIN_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-xl p-6 transition-all duration-300 ease-out hover:shadow-lg group"
              style={{
                background: "#fff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.04)",
                transform: "translateY(0)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-colors duration-300"
                  style={{ background: point.accentBg }}
                >
                  <point.icon
                    className="w-5 h-5"
                    style={{ color: point.accentColor }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-[15px] font-semibold leading-tight"
                    style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                  >
                    {point.title}
                  </h3>
                  <p
                    className="mt-2 text-[14px] leading-relaxed"
                    style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
                  >
                    {point.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Transition Statement */}
        <div className="mt-16 text-center">
          <p
            className="text-[17px] sm:text-[19px] font-medium leading-relaxed"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            You don't necessarily need more studying.
          </p>
          <p
            className="mt-2 text-[15px] sm:text-[16px] italic"
            style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
          >
            Sounds miserable anyway.
          </p>
          <p
            className="mt-6 text-[17px] sm:text-[19px] font-medium leading-relaxed max-w-[600px] mx-auto"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            You need a more effective way to study — in less time — so you can actually enjoy being a student again.
          </p>
        </div>

        {/* CTA Button */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={onCtaClick}
            className="rounded-xl px-8 py-4 text-[16px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: RED,
              boxShadow: "0 4px 16px rgba(206,17,38,0.25)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Start Studying Smarter →
          </button>
        </div>
      </div>
    </section>
  );
}
