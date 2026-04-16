import { BookOpen, Layers, CheckCircle2 } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

const STEPS = [
  {
    number: "1",
    icon: BookOpen,
    title: "Choose your course",
    text: "We'll point you to the material that matches what you're learning.",
  },
  {
    number: "2",
    icon: Layers,
    title: "Work through targeted explanations and problems",
    text: "Use videos, practice, and breakdowns to go deeper than lectures.",
  },
  {
    number: "3",
    icon: CheckCircle2,
    title: "Build real understanding over time",
    text: "So exams feel more familiar — and less overwhelming.",
  },
];

interface HowItWorksSectionProps {
  onCtaClick: () => void;
}

export default function HowItWorksSection({ onCtaClick }: HowItWorksSectionProps) {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[900px]">
        <p
          className="text-center mb-3 text-[13px] sm:text-[14px]"
          style={{ color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}
        >
          This works alongside your class — not instead of it.
        </p>
        <h2
          className="text-center text-[24px] sm:text-[30px] font-bold tracking-tight mb-14"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif" }}
        >
          How it works
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 relative">
          {/* Connector lines (desktop only) */}
          <div
            className="hidden sm:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px"
            style={{ background: "#E5E7EB" }}
          />

          {STEPS.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {/* Numbered icon */}
              <div className="relative mb-5">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(20,33,61,0.06)" }}
                >
                  <step.icon className="w-8 h-8" style={{ color: NAVY }} />
                </div>
                <span
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                  style={{ background: RED }}
                >
                  {step.number}
                </span>
              </div>

              <h3
                className="text-[16px] font-bold mb-2"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {step.title}
              </h3>
              <p
                className="text-[13px] leading-relaxed max-w-[240px]"
                style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
              >
                {step.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <button
            onClick={onCtaClick}
            className="rounded-xl px-8 py-4 text-[16px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: RED,
              boxShadow: "0 4px 16px rgba(206,17,38,0.25)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Get Started →
          </button>
        </div>
      </div>
    </section>
  );
}
