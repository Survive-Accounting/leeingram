import { ArrowRight, Wand2, Brain, Lightbulb } from "lucide-react";

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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 sa-card-in" style={{ animationDelay: "0ms" }}>
          <PrimaryToolCard
            icon={<Wand2 className="h-4 w-4" />}
            title="Practice Problem Helper"
            body="Guided explanations for 2,500+ textbook problems."
            cta="Open"
            isActive={active === "practice"}
            loading={loading}
            onClick={() => handleToolClick("practice")}
          />
        </div>
        <div className="md:col-span-5 sa-card-in" style={{ animationDelay: "80ms" }}>
          <PrimaryToolCard
            icon={<Brain className="h-4 w-4" />}
            title="Journal Entry Helper"
            body="Understanding JEs > memorizing them."
            cta="Preview"
            isActive={active === "je"}
            loading={loading}
            onClick={() => handleToolClick("je")}
          />
        </div>
        <div className="md:col-span-2 sa-card-in" style={{ animationDelay: "160ms" }}>
          <SecondaryToolCard
            title="Help shape what we build next"
            body="Tell us which study tools you'd actually use."
            cta="Rank ideas"
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
  isActive,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  isActive: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group relative w-full h-full text-left rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden"
      style={{
        background: "#fff",
        border: `1px solid ${isActive ? NAVY : "#E5EAF2"}`,
        boxShadow: isActive
          ? "0 0 0 3px rgba(20,33,61,0.10), 0 18px 38px rgba(20,33,61,0.16)"
          : "0 10px 24px rgba(20,33,61,0.08), 0 2px 6px rgba(20,33,61,0.04)",
        fontFamily: "Inter, sans-serif",
        minHeight: 210,
        opacity: loading ? 0.7 : 1,
        cursor: loading ? "wait" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!loading && !isActive) {
          e.currentTarget.style.boxShadow =
            "0 18px 40px rgba(20,33,61,0.14), 0 4px 10px rgba(20,33,61,0.06)";
          e.currentTarget.style.borderColor = "#C9D3E2";
        }
      }}
      onMouseLeave={(e) => {
        if (!loading && !isActive) {
          e.currentTarget.style.boxShadow =
            "0 10px 24px rgba(20,33,61,0.08), 0 2px 6px rgba(20,33,61,0.04)";
          e.currentTarget.style.borderColor = "#E5EAF2";
        }
      }}
    >
      {/* subtle top accent line */}
      <span
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 60%, ${RED} 100%)`,
          opacity: isActive ? 1 : 0.85,
        }}
      />

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

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 relative z-10 transition-transform duration-300 group-hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1E2F52 100%)`,
          color: "#fff",
          boxShadow: "0 4px 12px rgba(20,33,61,0.18)",
        }}
      >
        {icon}
      </div>

      <h3
        className="text-[17px] font-semibold leading-snug tracking-tight relative z-10"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[13.5px] leading-relaxed flex-1 relative z-10"
        style={{ color: "#5B6679" }}
      >
        {body}
      </p>

      <div
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-200 group-hover:translate-x-1 relative z-10"
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
      className="group w-full h-full text-left rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 flex flex-col relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(243,246,251,0.9) 100%)",
        border: "1px solid #D9E0EC",
        fontFamily: "Inter, sans-serif",
        minHeight: 210,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        boxShadow: "0 4px 14px rgba(20,33,61,0.05)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = "0 10px 24px rgba(20,33,61,0.10)";
          e.currentTarget.style.borderColor = "#C9D3E2";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(20,33,61,0.05)";
          e.currentTarget.style.borderColor = "#D9E0EC";
        }
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
        style={{
          background: "#fff",
          color: NAVY,
          border: "1px solid #E5EAF2",
        }}
      >
        <Lightbulb className="h-4 w-4" />
      </div>

      <h3
        className="text-[14px] font-semibold leading-snug tracking-tight"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      <p
        className="mt-1.5 text-[12.5px] leading-relaxed flex-1"
        style={{ color: "#64748B" }}
      >
        {body}
      </p>

      <div
        className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ color: NAVY }}
      >
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}
