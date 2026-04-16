import { Brain, Clock, PenLine, RotateCw, Target, AlertCircle } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

interface PainPoint {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  text: string;
}

const PAIN_POINTS: PainPoint[] = [
  {
    icon: Brain,
    title: "You feel lost during lectures",
    text: "The professor is explaining it… but it's just not clicking.",
  },
  {
    icon: Clock,
    title: "You're cramming before exams",
    text: "You wait until the last minute and hope something sticks.",
  },
  {
    icon: PenLine,
    title: "Homework problems don't make sense",
    text: "You look at the solution and still don't understand the steps.",
  },
  {
    icon: RotateCw,
    title: "You memorize instead of understanding",
    text: "It feels familiar — until you have to actually do it.",
  },
  {
    icon: Target,
    title: "You don't know what to focus on",
    text: "Everything feels important… which makes it hard to know where to start.",
  },
  {
    icon: AlertCircle,
    title: "You've already struggled on a test",
    text: "And you want to turn things around before the next one.",
  },
];

interface ThisIsForYouSectionProps {
  onCtaClick: () => void;
}

export default function ThisIsForYouSection({ onCtaClick }: ThisIsForYouSectionProps) {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[800px]">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2
            className="text-[24px] sm:text-[30px] font-bold tracking-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            This is for you if...
          </h2>
          <p
            className="mt-2 text-[14px] sm:text-[15px]"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            You're not alone — most students feel this way before exams.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {PAIN_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-xl p-5 transition-all hover:shadow-md"
              style={{
                background: "#fff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(20,33,61,0.08)" }}
                >
                  <point.icon
                    className="w-5 h-5"
                    style={{ color: NAVY }}
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
                    className="mt-1.5 text-[13px] leading-relaxed"
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
        <div className="mt-12 text-center">
          <p
            className="text-[16px] sm:text-[18px] font-medium leading-relaxed"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            You don't need more studying.
            <br />
            You need the <em style={{ fontStyle: "italic" }}>right</em> kind of studying.
          </p>
        </div>

        {/* CTA Button */}
        <div className="mt-8 flex justify-center">
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
