import { useState } from "react";
import { ChevronRight, Settings, Database, Sparkles, Play, CreditCard, Mail, Phone, Video, Image, Search, BookOpen, FileText, Rocket } from "lucide-react";

const PIPELINE_STEPS = [
  { emoji: "📚", label: "Textbook", desc: "Source material from Kieso (IA1/IA2) and Wild & Shaw (Intro)" },
  { emoji: "⌨️", label: "VA Data Entry", desc: "VAs input problem text, instructions, and source references" },
  { emoji: "🤖", label: "AI Generation (Claude)", desc: "Claude generates solutions, JEs, formulas, key terms, and more" },
  { emoji: "👨‍🏫", label: "Lee QA Review", desc: "Lee approves all content before it goes live" },
  { emoji: "👑", label: "King / VA QA", desc: "King and VAs do final quality pass on approved assets" },
  { emoji: "✅", label: "Student-Facing", desc: "Live on learn.surviveaccounting.com" },
];

const TOOLS: { icon: React.ReactNode; name: string; desc: string; drillDeeper?: string }[] = [
  { icon: <Settings className="h-4 w-4" />, name: "Lovable", desc: "No-code React development environment. All frontend UI is built here. Connects directly to Supabase." },
  { icon: <Database className="h-4 w-4" />, name: "Supabase", desc: "PostgreSQL database, edge functions, and auth. Stores all teaching assets, chapter content, student data, and quiz responses. Schema visualizer coming soon." },
  {
    icon: <Sparkles className="h-4 w-4" />, name: "Anthropic / Claude",
    desc: "AI engine for all content generation. Called directly via api.anthropic.com from Supabase edge functions. Model: claude-sonnet-4-20250514. Cost tracked via ai_cost_log table.",
    drillDeeper: "Direct API integration bypasses Lovable gateway — 6-10x cheaper. 6 sequential API calls per chapter for content suite generation.",
  },
  { icon: <Play className="h-4 w-4" />, name: "LearnWorlds", desc: "Course player at player.surviveaccounting.com. Handles DRM, video hosting structure, user tagging, quiz delivery, and course completion tracking. API used for coupon generation and user management." },
  { icon: <CreditCard className="h-4 w-4" />, name: "Stripe", desc: "Payment processing. Semester Pass $125, Chapter Pass $30, Finals Special $99. Webhook-based access control coming soon." },
  { icon: <Mail className="h-4 w-4" />, name: "Resend", desc: "Transactional email from lee@mail.surviveaccounting.com. Used for student fix notifications and future auth magic links." },
  { icon: <Phone className="h-4 w-4" />, name: "Twilio", desc: "SMS notifications. $125 study pass link delivery via send-discount-sms edge function. Rate limited 24hr via sms_discount_log table. Coming soon." },
  { icon: <Video className="h-4 w-4" />, name: "Vimeo", desc: "Video hosting. 30-second preview cuts only at current stage. Full video pipeline coming soon." },
  { icon: <Image className="h-4 w-4" />, name: "htmlcsstoimage.com", desc: "Formula card image generation. 800×400px at 2x device pixel ratio. Navy background, red expression text. Called from generate-formula-images edge function." },
  { icon: <Search className="h-4 w-4" />, name: "Google Search Console", desc: "SEO monitoring across 3 verified properties: learn.surviveaccounting.com, greek.surviveaccounting.com, player.surviveaccounting.com." },
  { icon: <BookOpen className="h-4 w-4" />, name: "Textbooks", desc: "Kieso 18th Edition (IA1/IA2), Wild & Shaw (Intro 1/2). Source of all 2,531 practice problems. Textbook sourcing kept out of marketing copy — SEO handles discovery." },
  { icon: <FileText className="h-4 w-4" />, name: "Teaching Asset Pipeline", desc: "2,531 approved practice problems across 4 courses. Each asset: problem text, solution, journal entries, key concepts, exam traps, and flowchart data." },
];

function ToolCard({ tool }: { tool: typeof TOOLS[number] }) {
  const [open, setOpen] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);

  return (
    <div
      className="rounded-lg transition-all"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${open ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
        borderLeft: open ? "2px solid #CE1126" : undefined,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full text-left px-4 py-3"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{tool.icon}</span>
        <span className="text-[13px] font-semibold text-white flex-1">{tool.name}</span>
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? 500 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-3 pl-11">
          <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{tool.desc}</p>
          {tool.drillDeeper && (
            <>
              <button
                onClick={() => setDrillOpen(!drillOpen)}
                className="flex items-center gap-1 mt-2 text-[11px] font-semibold"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#3B82F6" }}
              >
                <ChevronRight className="h-3 w-3 transition-transform duration-200" style={{ transform: drillOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
                Drill deeper
              </button>
              <div className="overflow-hidden transition-all duration-200" style={{ maxHeight: drillOpen ? 200 : 0, opacity: drillOpen ? 1 : 0 }}>
                <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{tool.drillDeeper}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pipeline (exported separately) ──
export function ContentPipeline() {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex flex-wrap items-start gap-1.5">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-start gap-1.5">
            <div
              className="rounded-lg px-3.5 py-3 text-center shrink-0"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                minWidth: 100,
                maxWidth: 130,
              }}
            >
              <span className="text-lg block mb-1">{step.emoji}</span>
              <span className="text-[13px] font-semibold text-white block leading-tight">{step.label}</span>
              <span className="text-[11px] block mt-1 leading-snug" style={{ color: "rgba(255,255,255,0.45)" }}>{step.desc}</span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className="text-[18px] font-bold self-center shrink-0 mt-3" style={{ color: "#CE1126" }}>→</span>
            )}
          </div>
        ))}

        {/* Box 7 — Students Buy Passes */}
        <div className="flex items-start gap-1.5">
          <span className="text-[18px] font-bold self-center shrink-0 mt-3" style={{ color: "#CE1126" }}>→</span>
          <div
            className="rounded-lg px-3.5 py-3 text-center shrink-0"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              minWidth: 100,
              maxWidth: 130,
            }}
          >
            <CreditCard className="h-4 w-4 mx-auto mb-1" style={{ color: "rgba(255,255,255,0.6)" }} />
            <span className="text-[13px] font-semibold text-white block leading-tight">Students Buy Passes</span>
            <span className="text-[11px] block mt-1 leading-snug" style={{ color: "rgba(255,255,255,0.45)" }}>
              Semester Study Passes expire end of semester. Students rebuy each semester — built-in recurring revenue.
            </span>
          </div>
        </div>

        {/* Box 8 — Future Content Plans */}
        <div className="flex items-start gap-1.5">
          <span className="text-[18px] font-bold self-center shrink-0 mt-3" style={{ color: "#CE1126", opacity: 0.5 }}>⇢</span>
          <div
            className="rounded-lg px-3.5 py-3 text-left shrink-0"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px dashed rgba(255,255,255,0.15)",
              minWidth: 200,
              maxWidth: 240,
            }}
          >
            <Rocket className="h-4 w-4 mb-1" style={{ color: "rgba(255,255,255,0.6)" }} />
            <span className="text-[13px] font-semibold text-white block leading-tight mb-2">Future Content Plans</span>
            <span className="text-[11px] block leading-snug mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>Follows the same pipeline ↑</span>
            <span className="text-[11px] block leading-snug mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>Four additional courses → eight total courses.</span>
            <div className="space-y-2 mt-2">
              <div>
                <span className="text-[12px] block" style={{ color: "#FFFFFF" }}>🎓 <span className="font-semibold">SurviveAccounting.com</span></span>
                <span className="text-[11px] block pl-5" style={{ color: "rgba(255,255,255,0.45)" }}>Clone for Cost Accounting + Advanced Accounting</span>
              </div>
              <div>
                <span className="text-[12px] block" style={{ color: "#FFFFFF" }}>💰 <span className="font-semibold">SurviveTax.com</span></span>
                <span className="text-[11px] block pl-5" style={{ color: "rgba(255,255,255,0.45)" }}>Domain acquired. Clone for undergrad Income Tax 1.</span>
              </div>
              <div>
                <span className="text-[12px] block" style={{ color: "#FFFFFF" }}>🔍 <span className="font-semibold">SurviveAudit.com</span></span>
                <span className="text-[11px] block pl-5" style={{ color: "rgba(255,255,255,0.45)" }}>Domain acquired. Clone for undergrad Audit class.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Infrastructure (tools only) ──
export default function InfrastructureSection() {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
        Tools & Integrations
      </p>
      <div className="space-y-1.5">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}
