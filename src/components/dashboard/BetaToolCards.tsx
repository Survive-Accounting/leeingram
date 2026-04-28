import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, MessageCircleQuestion, Wand2 } from "lucide-react";
import { toast } from "sonner";
import FeedbackToolModal from "./FeedbackToolModal";

const NAVY = "#14213D";
const RED = "#CE1126";

export default function BetaToolCards({ email }: { email: string | null }) {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-[20px] sm:text-[22px] leading-tight"
          style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
        >
          Beta Tools
        </h2>
        <span
          className="text-[10.5px] uppercase tracking-widest font-semibold"
          style={{ color: "#94A3B8" }}
        >
          You're shaping these
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ToolCard
          icon={<Wand2 className="h-4 w-4" />}
          eyebrow="Tool 01 · Active"
          title="Practice Problem Helper"
          body="Your live tutor for any problem in your chapter."
          cta="Open"
          onClick={() => navigate("/cram")}
          accent={RED}
          status="active"
        />
        <ToolCard
          icon={<Brain className="h-4 w-4" />}
          eyebrow="Tool 02 · Building"
          title="Journal Entry Memorizer"
          body="Drill the JEs you keep getting wrong. Coming soon."
          cta="Tell us what you'd want"
          onClick={() => {
            toast.info(
              "Hop into 'Help us decide' and tell us what would make this tool actually useful for you.",
            );
            setFeedbackOpen(true);
          }}
          accent="#94A3B8"
          status="soon"
        />
        <ToolCard
          icon={<MessageCircleQuestion className="h-4 w-4" />}
          eyebrow="Tool 03 · Your turn"
          title="Help us decide"
          body="What should we build next? Your idea could be Tool 04."
          cta="Drop an idea"
          onClick={() => setFeedbackOpen(true)}
          accent={NAVY}
          status="prompt"
        />
      </div>

      <FeedbackToolModal
        open={feedbackOpen}
        email={email}
        onClose={() => setFeedbackOpen(false)}
      />
    </section>
  );
}

function ToolCard({
  icon,
  eyebrow,
  title,
  body,
  cta,
  onClick,
  accent,
  status,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
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
        minHeight: 180,
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
      <p
        className="mt-1.5 text-[12.5px] leading-relaxed flex-1"
        style={{ color: "#64748B" }}
      >
        {body}
      </p>

      <div
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold transition-transform group-hover:translate-x-0.5"
        style={{ color: accent }}
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}
