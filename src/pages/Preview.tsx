import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ChevronDown, ChevronUp, ChevronRight, Monitor, TrendingUp, Settings, Megaphone, Workflow } from "lucide-react";
import RevenueCalculator from "@/components/preview/RevenueCalculator";
import InfrastructureSection, { ContentPipeline } from "@/components/preview/InfrastructureSection";
import MarketingSection from "@/components/preview/MarketingSection";
import SolutionsViewerSection from "@/components/preview/SolutionsViewerSection";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png";
const PASSWORD = "survive2026";
const SESSION_KEY = "sa_preview_auth";

const COURSE_ORDER: Record<string, number> = { INTRO1: 0, INTRO2: 1, IA1: 2, IA2: 3 };
const COURSE_LABELS: Record<string, string> = {
  INTRO1: "Intro Accounting 1",
  INTRO2: "Intro Accounting 2",
  IA1: "Intermediate Accounting 1",
  IA2: "Intermediate Accounting 2",
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "All Student-Facing Pages": <Monitor className="h-5 w-5" />,
  "Revenue Potential": <TrendingUp className="h-5 w-5" />,
  "How Content Gets Built": <Workflow className="h-5 w-5" />,
  "Infrastructure": <Settings className="h-5 w-5" />,
  "Marketing": <Megaphone className="h-5 w-5" />,
};

// ── Coming Soon Badge ──
function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "#F59E0B", color: "#14213D" }}>
      🚧 Coming Soon
    </span>
  );
}

// ── Password Gate ──
function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#14213D" }}>
      <style>{`
        @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }
        .shake-anim { animation: shake 0.4s ease; }
      `}</style>
      <form onSubmit={handleSubmit} className={`w-full max-w-[340px] px-6 ${shake ? "shake-anim" : ""}`}>
        <img src={LOGO_URL} alt="Survive Accounting" className="h-8 mx-auto mb-6 object-contain" />
        <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>Team Access</p>
        <p className="text-center text-[14px] mb-0 mx-auto" style={{ color: "rgba(255,255,255,0.75)", maxWidth: 320, lineHeight: 1.5 }}>
          Preview all student-facing pages to test usability, conversion, and educational value. Your improvements matter.
        </p>
        <p className="text-center text-[13px] italic mx-auto mb-6" style={{ color: "rgba(255,255,255,0.55)", marginTop: 8 }}>
          I couldn't build this without your help. Thank you. — Lee
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-lg text-[14px] outline-none mb-3"
          style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${error ? "#CE1126" : "rgba(255,255,255,0.15)"}`, color: "#FFFFFF" }}
        />
        {error && <p className="text-[12px] mb-2" style={{ color: "#CE1126" }}>Try again</p>}
        <button type="submit" className="w-full py-3 rounded-lg text-[14px] font-bold text-white transition-all hover:brightness-110" style={{ background: "#CE1126" }}>
          Enter →
        </button>
      </form>
    </div>
  );
}

// ── Feedback Form ──
function FeedbackForm() {
  const [pageUrl, setPageUrl] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lovablePrompt, setLovablePrompt] = useState("");
  const [name, setName] = useState("");
  const [ss1, setSs1] = useState("");
  const [ss2, setSs2] = useState("");
  const [ss3, setSs3] = useState("");
  const [ssCount, setSsCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await (supabase as any).from("va_feedback").insert({
        page_url: pageUrl.trim() || null,
        feedback: feedback.trim(),
        lovable_prompt: lovablePrompt.trim() || null,
        va_name: name.trim() || null,
        screenshot_url_1: ss1.trim() || null,
        screenshot_url_2: ss2.trim() || null,
        screenshot_url_3: ss3.trim() || null,
      });
      setSuccess(true);
      setTimeout(() => {
        setPageUrl(""); setFeedback(""); setLovablePrompt(""); setName("");
        setSs1(""); setSs2(""); setSs3("");
        setSsCount(1); setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Feedback submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    color: "#FFFFFF",
    padding: "10px 12px",
    fontSize: 13,
    width: "100%",
    outline: "none",
  };

  return (
    <div style={{ background: "#0F1D35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24 }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-4" style={{ color: "#F59E0B", letterSpacing: "0.1em" }}>
        Suggest an Improvement
      </p>
      {success ? (
        <p className="text-[14px] text-center py-4" style={{ color: "rgba(255,255,255,0.8)" }}>Got it — thank you! 🙌</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
          <input value={pageUrl} onChange={e => setPageUrl(e.target.value)} placeholder="What website page, section, strategy, etc can be improved?" style={inputStyle} />
          <div>
            <p className="text-[11px] mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Upload screenshots to imgbb.com and paste URL here</p>
            <input value={ss1} onChange={e => setSs1(e.target.value)} placeholder="Screenshot 1 URL" style={inputStyle} />
            {ssCount >= 2 && <input value={ss2} onChange={e => setSs2(e.target.value)} placeholder="Screenshot 2 URL" style={{ ...inputStyle, marginTop: 8 }} />}
            {ssCount >= 3 && <input value={ss3} onChange={e => setSs3(e.target.value)} placeholder="Screenshot 3 URL" style={{ ...inputStyle, marginTop: 8 }} />}
            {ssCount < 3 && (
              <button type="button" onClick={() => setSsCount(c => c + 1)} className="text-[12px] font-medium mt-1.5" style={{ background: "none", border: "none", color: "#3B82F6", cursor: "pointer" }}>+ Add screenshot</button>
            )}
          </div>
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Describe the improvement in plain english — be as specific as possible." rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          <textarea value={lovablePrompt} onChange={e => setLovablePrompt(e.target.value)} placeholder="Describe it as a Lovable prompt we can test out (optional)." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>You can submit multiple times if you have more feedback.</p>
          <button
            type="submit"
            disabled={!feedback.trim() || submitting}
            className="w-full py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: !feedback.trim() ? "rgba(206,17,38,0.4)" : "#CE1126", borderRadius: 6, border: "none", cursor: !feedback.trim() ? "not-allowed" : "pointer", opacity: !feedback.trim() ? 0.6 : 1 }}
          >
            {submitting ? "Sending…" : "Send to Lee →"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Collapsible Section ──
function CollapsibleSection({ title, children, defaultOpen, sublabel, highlight }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; sublabel?: string; highlight?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <section style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, marginBottom: 8, background: "rgba(255,255,255,0.02)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full text-left group"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "20px 16px" }}
      >
        <span style={{ color: "white" }}>
          {SECTION_ICONS[title]}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[20px] font-bold text-white" style={{ letterSpacing: "0.05em" }}>
            {title}
          </span>
          {sublabel && <span className="block text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{sublabel}</span>}
        </div>
        {open ? <ChevronUp className="h-5 w-5 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronDown className="h-5 w-5 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />}
      </button>
      {open && (
        <div className={`pb-6 px-4 ${highlight ? "rounded-xl px-6 py-5 mb-4 mx-4" : ""}`} style={highlight ? { background: "#1a2d4a", border: "1px solid rgba(206,17,38,0.3)", borderRadius: 12 } : undefined}>
          {children}
        </div>
      )}
    </section>
  );
}

// ── Sub Toggle (inside mega toggle) ──
function SubSection({ label, children, defaultOpen }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-3"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <ChevronRight
          className="h-3.5 w-3.5 transition-transform duration-200 shrink-0"
          style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        <span className="text-[13px] font-semibold text-white">{label}</span>
      </button>
      <div className="overflow-hidden transition-all duration-200" style={{ maxHeight: open ? 10000 : 0, opacity: open ? 1 : 0 }}>
        <div className="pl-5 pb-4">{children}</div>
      </div>
    </div>
  );
}

// ── Main Page ──
function PreviewIndex() {
  const { data: chapters = [] } = useQuery({
    queryKey: ["preview-chapters"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code, course_name)")
        .order("chapter_number");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, { code: string; name: string; chapters: any[] }> = {};
    chapters.forEach((ch: any) => {
      const code = ch.courses?.code || "OTHER";
      if (!map[code]) map[code] = { code, name: COURSE_LABELS[code] || ch.courses?.course_name || code, chapters: [] };
      map[code].chapters.push(ch);
    });
    return Object.values(map).sort((a, b) => (COURSE_ORDER[a.code] ?? 99) - (COURSE_ORDER[b.code] ?? 99));
  }, [chapters]);

  const COURSE_ROUTES = [
    { label: "ACCY 201 · Intro 1", route: "/ole-miss/accy201" },
    { label: "ACCY 202 · Intro 2", route: "/ole-miss/accy202" },
    { label: "ACCY 303 · IA1", route: "/ole-miss/accy303" },
    { label: "ACCY 304 · IA2", route: "/ole-miss/accy304" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#14213D" }}>
      {/* Header */}
      <div className="pt-10 pb-2 text-center">
        <img src={LOGO_URL} alt="Survive Accounting" className="h-8 mx-auto mb-5 object-contain" />
        <h1 className="text-[32px] font-extrabold text-white" style={{ fontFamily: "Inter" }}>The Survive Accounting Platform</h1>
        <p className="text-[16px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>Behind the Scenes</p>
        <p className="text-[14px] mt-3 mx-auto" style={{ color: "rgba(255,255,255,0.65)", maxWidth: 480, lineHeight: 1.6 }}>
          Welcome to the team. Everything we're building is below — explore, test, and share your thoughts.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:brightness-110"
          style={{ background: "#CE1126", textDecoration: "none" }}
        >
          Login to VA Dashboard →
        </a>
        <a
          href="#feedback-form"
          className="block mt-3 text-[13px] font-medium transition-all hover:brightness-125"
          style={{ color: "#F59E0B", textDecoration: "none" }}
        >
          Suggest an Improvement ↓
        </a>
      </div>

      <div className="mx-auto max-w-[700px] px-5 py-8 space-y-0">

        {/* ── ALL STUDENT-FACING PAGES ── */}
        <CollapsibleSection title="All Student-Facing Pages" sublabel="For review, testing, and improvement" highlight>
          {/* Sub 1: Home Landing */}
          <SubSection label="Home Landing Page">
            <p className="text-[11px] font-mono mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>surviveaccounting.com</p>
            <div className="mb-2"><ComingSoonBadge /></div>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>Main entry point. Routes students to their campus and course.</p>
          </SubSection>

          {/* Sub 2: Campus Landing Pages */}
          <SubSection label="Campus Landing Pages">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ole Miss card */}
              <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-[13px] font-semibold text-white mb-1">Ole Miss</p>
                <p className="text-[11px] font-mono mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>learn.surviveaccounting.com/ole-miss</p>
                <div className="space-y-1.5 mb-3">
                  {COURSE_ROUTES.map(cr => (
                    <a key={cr.route} href={cr.route} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[12px] text-white hover:underline">
                      <span>{cr.label}</span>
                      <ComingSoonBadge />
                      <ExternalLink className="h-3 w-3 ml-auto opacity-30" />
                    </a>
                  ))}
                </div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Self-serve purchase page. Students land here from search or referral.</p>
              </div>
              {/* New Campus placeholder */}
              <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)" }}>
                <p className="text-[13px] italic mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>[New Campus Here]</p>
                <p className="text-[11px] font-mono mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>learn.surviveaccounting.com/campusname</p>
                <div className="mb-2"><ComingSoonBadge /></div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>400+ universities across the country offer rigorous accounting programs — each one a potential campus for Survive Accounting.</p>
              </div>
            </div>
          </SubSection>

          {/* Sub 3: Greek Portals */}
          <SubSection label="Greek Portals">
            <p className="text-[11px] font-mono mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>greek.surviveaccounting.com</p>
            <div className="mb-2"><ComingSoonBadge /></div>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>Bulk study pass purchasing for Greek organizations. ~20-30 orgs per campus.</p>
          </SubSection>

          {/* Sub 4: Chapter Pages */}
          <SubSection label="Chapter Pages">
            <div className="space-y-4">
              {grouped.map((group) => (
                <div key={group.code}>
                  <p className="text-[12px] font-semibold text-white mb-2">{group.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.chapters.map((ch: any) => (
                      <a
                        key={ch.id}
                        href={`/cram/${ch.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between rounded-lg px-3 py-2 text-[12px] text-white transition-all"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "2px solid transparent" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = "#CE1126"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent"; }}
                      >
                        <span>Ch {ch.chapter_number} — {ch.chapter_name}</span>
                        <ExternalLink className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          {/* Sub 5: Solutions Viewer */}
          <SubSection label="Solutions Viewer">
            <SolutionsViewerSection />
          </SubSection>
        </CollapsibleSection>

        {/* ── REVENUE POTENTIAL ── */}
        <CollapsibleSection title="Revenue Potential">
          <RevenueCalculator />
        </CollapsibleSection>

        {/* ── MARKETING ── */}
        <CollapsibleSection title="Marketing">
          <MarketingSection />
        </CollapsibleSection>

        {/* ── HOW CONTENT GETS BUILT ── */}
        <CollapsibleSection title="How Content Gets Built">
          <ContentPipeline />
        </CollapsibleSection>

        {/* ── INFRASTRUCTURE ── */}
        <CollapsibleSection title="Infrastructure">
          <InfrastructureSection />
        </CollapsibleSection>

        {/* ── Feedback Form ── */}
        <div className="mt-20 mb-4" id="feedback-form">
          <p className="text-[16px] font-bold text-white mb-1">Suggest an Improvement</p>
          <p className="text-[13px] mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>All ideas are welcome and encouraged!</p>
          <FeedbackForm />
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] pt-4 pb-8" style={{ color: "rgba(255,255,255,0.25)" }}>
          This page is for internal team use only. Do not share the URL publicly.
        </p>
      </div>
    </div>
  );
}

// ── Export with Gate ──
export default function Preview() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "true");

  if (!authed) return <PasswordGate onSuccess={() => setAuthed(true)} />;
  return <PreviewIndex />;
}
