import { ArrowRight, Wand2, Brain, Sparkles, Plus } from "lucide-react";

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ToolCard
          icon={<Wand2 className="h-4 w-4" />}
          eyebrow="Tool 01"
          title="Practice Problem Helper"
          body="Step-by-step explanations for any problem in this chapter."
          cta="Open"
          status="active"
          accent={RED}
          isActive={active === "practice"}
          loading={loading}
          onClick={() => handleToolClick("practice")}
        />
        <ToolCard
          icon={<Brain className="h-4 w-4" />}
          eyebrow="Tool 02 · Building"
          title="Journal Entry Helper"
          body="Drill the JEs you'll need to memorize for the exam."
          cta="Preview"
          status="soon"
          accent={NAVY}
          isActive={active === "je"}
          loading={loading}
          onClick={() => handleToolClick("je")}
        />
        <ToolCard
          icon={<Sparkles className="h-4 w-4" />}
          eyebrow="Tool 03 · Your turn"
          title="Tell us what you want built"
          body="If we could build the perfect study tool for you, what would it do?"
          cta="Drop an idea"
          status="prompt"
          accent={NAVY}
          isActive={false}
          loading={loading}
          onClick={onOpenFeedback}
          dashed
        />
      </div>
    </section>
  );
}

function ToolCard({
  icon,
  eyebrow,
  title,
  body,
  cta,
  status,
  accent,
  isActive,
  loading,
  onClick,
  dashed,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  status: "active" | "soon" | "prompt";
  accent: string;
  isActive: boolean;
  loading: boolean;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group relative text-left rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col overflow-hidden"
      style={{
        background: "#fff",
        border: dashed
          ? `2px dashed ${isActive ? NAVY : "#CBD5E1"}`
          : `1px solid ${isActive ? NAVY : "#E0E7F0"}`,
        boxShadow: isActive
          ? "0 0 0 3px rgba(20,33,61,0.10), 0 8px 22px rgba(20,33,61,0.10)"
          : "0 4px 14px rgba(20,33,61,0.05)",
        fontFamily: "Inter, sans-serif",
        minHeight: 200,
        opacity: loading ? 0.7 : 1,
        cursor: loading ? "wait" : "pointer",
      }}
    >
      {/* Shimmer overlay while a chapter is loading */}
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

      {status === "soon" && (
        <span
          className="absolute top-3 right-3 text-[10px] uppercase tracking-widest font-semibold rounded-full px-2 py-0.5 z-10"
          style={{ background: "#FEF3C7", color: "#92400E" }}
        >
          Coming soon
        </span>
      )}
      {status === "prompt" && (
        <span
          className="absolute top-3 right-3 text-[10px] uppercase tracking-widest font-semibold rounded-full px-2 py-0.5 z-10 inline-flex items-center gap-1"
          style={{ background: "#EEF2F7", color: NAVY }}
        >
          <Plus className="h-3 w-3" /> Add a tool
        </span>
      )}

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 relative z-10"
        style={{ background: `${accent}15`, color: accent }}
      >
        {icon}
      </div>

      <p
        className="text-[10.5px] uppercase tracking-widest font-semibold mb-1 relative z-10"
        style={{ color: "#94A3B8" }}
      >
        {eyebrow}
      </p>
      <h3
        className="text-[15.5px] font-semibold leading-snug relative z-10"
        style={{ color: NAVY }}
      >
        {title}
      </h3>
      <p
        className="mt-1.5 text-[12.5px] leading-relaxed flex-1 relative z-10"
        style={{ color: "#64748B" }}
      >
        {body}
      </p>

      <div
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold transition-transform group-hover:translate-x-0.5 relative z-10"
        style={{ color: accent }}
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}
