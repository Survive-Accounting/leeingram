import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, MessageCircleQuestion, Wand2 } from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

export default function BetaToolCards({
  onOpenFeedback,
}: {
  email?: string | null;
  onOpenFeedback: () => void;
}) {
  const navigate = useNavigate();

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-[20px] sm:text-[22px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Beta Tools
        </h2>
        <button
          type="button"
          onClick={onOpenFeedback}
          className="text-[10.5px] uppercase tracking-widest font-semibold hover:underline transition-colors"
          style={{ color: RED }}
        >
          Your feedback is implemented in real time →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ToolCard
          icon={<Wand2 className="h-4 w-4" />}
          eyebrow="Tool 01 · Active"
          title="Practice Problem Helper"
          body="Get instant help for any problem in your chapter."
          cta="Open"
          onClick={() => navigate("/cram")}
          accent={RED}
          status="active"
        />
        <ToolCard
          icon={<Brain className="h-4 w-4" />}
          eyebrow="Tool 02 · Building"
          title="Journal Entry Memorizer"
          body="Drill the JEs for deeper understanding."
          cta="Tell us what you'd want"
          onClick={onOpenFeedback}
          accent="#94A3B8"
          status="soon"
        />
        <ToolCard
          icon={<MessageCircleQuestion className="h-4 w-4" />}
          eyebrow="Tool 03 · Your turn"
          title="Help us decide"
          subtitle="If we could build you the perfect study tool, what all would it do?"
          body=""
          cta="Drop an idea"
          onClick={onOpenFeedback}
          accent={NAVY}
          status="prompt"
        />
      </div>
    </section>
  );
}

function ToolCard({
  icon,
  eyebrow,
  title,
  subtitle,
  body,
  cta,
  onClick,
  accent,
  status,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  body: string;
  cta: string;
  onClick: () => void;
  accent: string;
  status: "active" | "soon" | "prompt";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg flex flex-col"
      style={{
        background: "#fff",
        border: "1px solid #E0E7F0",
        boxShadow: "0 4px 14px rgba(20,33,61,0.05)",
        fontFamily: "Inter, sans-serif",
        minHeight: 200,
      }}
    >
      {status === "soon" && (
        <span
          className="absolute top-3 right-3 text-[10px] uppercase tracking-widest font-semibold rounded-full px-2 py-0.5"
          style={{ background: "#FEF3C7", color: "#92400E" }}
        >
          Coming soon
        </span>
      )}

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{ background: `${accent}15`, color: accent }}
      >
        {icon}
      </div>

      <p
        className="text-[10.5px] uppercase tracking-widest font-semibold mb-1"
        style={{ color: "#94A3B8" }}
      >
        {eyebrow}
      </p>
      <h3 className="text-[15.5px] font-semibold leading-snug" style={{ color: NAVY }}>
        {title}
      </h3>
      {subtitle && (
        <p
          className="mt-1.5 text-[12.5px] leading-relaxed flex-1"
          style={{ color: "#475569", fontStyle: "italic" }}
        >
          {subtitle}
        </p>
      )}
      {body && (
        <p
          className="mt-1.5 text-[12.5px] leading-relaxed flex-1"
          style={{ color: "#64748B" }}
        >
          {body}
        </p>
      )}

      <div
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold transition-transform group-hover:translate-x-0.5"
        style={{ color: accent }}
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}
