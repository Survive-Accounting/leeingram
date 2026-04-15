import { ListChecks, BookOpen, Target, Zap, ShieldCheck } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

const OUTCOMES = [
  {
    icon: ListChecks,
    title: "Solve problems step-by-step",
    text: "No more guessing. Follow clear, repeatable steps.",
  },
  {
    icon: BookOpen,
    title: "Understand journal entries",
    text: "Know exactly what's happening — not just memorize.",
  },
  {
    icon: Target,
    title: "Recognize exam patterns",
    text: "Learn what professors actually test — and what they don't.",
  },
  {
    icon: Zap,
    title: "Move faster with confidence",
    text: "Stop second-guessing and trust your process.",
  },
  {
    icon: ShieldCheck,
    title: "Walk into exams prepared",
    text: "Feel calm knowing you've seen problems like this before.",
  },
];

interface OutcomesSectionProps {
  onCtaClick: () => void;
}

export default function OutcomesSection({ onCtaClick }: OutcomesSectionProps) {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "#fff" }}>
      <div className="mx-auto max-w-[900px]">
        <div className="text-center mb-12">
          <h2
            className="text-[24px] sm:text-[30px] font-bold tracking-tight"
            style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
          >
            What you'll be able to do
          </h2>
          <p
            className="mt-2 text-[14px] sm:text-[15px]"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
          >
            Not just watch videos — actually understand what shows up on your exam.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {OUTCOMES.map((item) => (
            <div
              key={item.title}
              className="rounded-xl p-6 text-center transition-all hover:shadow-md"
              style={{
                background: "#F8F8FA",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(20,33,61,0.08)" }}
              >
                <item.icon className="w-6 h-6" style={{ color: NAVY }} />
              </div>
              <h3
                className="text-[15px] font-bold leading-tight mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {item.title}
              </h3>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
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
