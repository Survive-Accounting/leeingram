import { ArrowRight, Wand2, Brain, Sparkles } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

export type ToolKey = "practice" | "je";

interface Props {
  active: ToolKey | null;
  loading: boolean;
  chapterChosen: boolean;
  onSelect: (key: ToolKey) => void;
  onOpenFeedback: () => void;
  onNudgeChapter: () => void;
}

export default function StudyToolCards({
  active,
  loading,
  chapterChosen,
  onSelect,
  onOpenFeedback,
  onNudgeChapter,
}: Props) {
  const handleToolClick = (key: ToolKey) => {
    if (loading) return;
    if (!chapterChosen) {
      onNudgeChapter();
      return;
    }
    onSelect(key);
  };

  return (
    <section>
      <style>{`
        @keyframes sa-card-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sa-card-in { animation: sa-card-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>
      {/* Two primary tools, then a quieter "feedback" card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div
          className="md:col-span-5 sa-card-in"
          style={{ animationDelay: "0ms" }}
        >
          <PrimaryToolCard
            icon={<Wand2 className="h-4 w-4" />}
            title="Practice Problem Helper"
            body="Step-by-step help, hints, walkthroughs, and challenge questions."
            cta="Open"
            isActive={active === "practice"}
            loading={loading}
            onClick={() => handleToolClick("practice")}
          />
        </div>
        <div
          className="md:col-span-5 sa-card-in"
          style={{ animationDelay: "80ms" }}
        >
          <PrimaryToolCard
            icon={<Brain className="h-4 w-4" />}
            title="Journal Entry Helper"
            body="Drill the journal entries you'll need to know for the exam."
            cta="Preview"
            badge="Coming soon"
            isActive={active === "je"}
            loading={loading}
            onClick={() => handleToolClick("je")}
          />
        </div>
        <div
          className="md:col-span-2 sa-card-in"
          style={{ animationDelay: "160ms" }}
        >
          <SecondaryToolCard
            title="Tell us what to build next"
            body="What study tool would make this even better for you?"
            cta="Drop an idea"
            onClick={onOpenFeedback}
            disabled={loading}
          />
        </div>
      </div>
    </section>
  );
}

/* ─── Primary tool card ─── */

function PrimaryToolCard({
  icon,
  title,
  body,
  cta,
  badge,
  isActive,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  badge?: string;
  isActive: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group relative w-full h-full text-left rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 flex flex-col overflow-hidden"
      style={{
        background: "#fff",
        border: `1px solid ${isActive ? NAVY : "#E0E7F0"}`,
        boxShadow: isActive
          ? "0 0 0 3px rgba(20,33,61,0.10), 0 12px 28px rgba(20,33,61,0.14)"
          : "0 6px 18px rgba(20,33,61,0.07)",
        fontFamily: "Inter, sans-serif",
        minHeight: 200,
        opacity: loading ? 0.7 : 1,
        cursor: loading ? "wait" : "pointer",
      }}
    >
      {/* Shimmer while a chapter is loading */}
      {loading && (
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(206,17,38,0.10) 50%, rgba(255,255,255,0) 100%)",
            animation: "sa-shimmer 1.1s ease-in-out infinite",
          }}
        />
      )}

      {badge && (
        <span
          className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-semibold rounded-full px-2 py-0.5 z-10"
          style={{ background: "#FEF3C7", color: "#92400E" }}
        >
          {badge}
        </span>
      )}

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 relative z-10"
        style={{ background: `${NAVY}0F`, color: NAVY }}
      >
        {icon}
      </div>

      <h3
        className="text-[16px] sm:text-[16.5px] font-semibold leading-snug relative z-10"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      <p
        className="mt-1.5 text-[13px] leading-relaxed flex-1 relative z-10"
        style={{ color: "#64748B" }}
      >
        {body}
      </p>

      <div
        className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5 relative z-10"
        style={{ color: RED }}
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}

/* ─── Quieter secondary card (feedback) ─── */

function SecondaryToolCard({
  title,
  body,
  cta,
  onClick,
  disabled,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group w-full h-full text-left rounded-2xl p-5 transition-all duration-200 hover:bg-white hover:-translate-y-0.5 flex flex-col"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1.5px dashed #CBD5E1",
        fontFamily: "Inter, sans-serif",
        minHeight: 200,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center mb-3"
        style={{ background: "transparent", color: "#94A3B8" }}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <h3
        className="text-[13.5px] font-semibold leading-snug"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      <p
        className="mt-1.5 text-[12px] leading-relaxed flex-1"
        style={{ color: "#64748B" }}
      >
        {body}
      </p>

      <div
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold transition-transform group-hover:translate-x-0.5"
        style={{ color: NAVY }}
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}
