import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Lock, Search } from "lucide-react";

const LOGO_URL = "https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf161ac35937c4d438ca.png";
const PASSWORD = "survive2026";
const SESSION_KEY = "sa_preview_auth";

const COURSE_ORDER: Record<string, number> = { INTRO1: 0, INTRO2: 1, IA1: 2, IA2: 3 };
const COURSE_LABELS: Record<string, string> = {
  INTRO1: "Intro Accounting 1",
  INTRO2: "Intro Accounting 2",
  IA1: "Intermediate Accounting 1",
  IA2: "Intermediate Accounting 2",
};

const LANDING_CARDS = [
  { label: "Intro 1", route: "/ole-miss/accy201", ready: false },
  { label: "Intro 2", route: "/ole-miss/accy202", ready: false },
  { label: "IA1", route: "/ole-miss/accy303", ready: false },
  { label: "IA2", route: "/ole-miss/accy304", ready: false },
];

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
        <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>Team Access</p>
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

// ── Section Label ──
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
      {children}
    </p>
  );
}

// ── Link Card ──
function LinkCard({ href, label, badge, badgeColor, newTab }: { href: string; label: string; badge?: string; badgeColor?: string; newTab?: boolean }) {
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="group flex items-center justify-between rounded-lg px-4 py-3 text-[13px] font-medium text-white transition-all duration-150"
      style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#CE1126"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
    >
      <span className="flex items-center gap-2">
        {label}
        {badge && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: badgeColor || "#F59E0B", color: "#000" }}>
            {badge}
          </span>
        )}
      </span>
      <ExternalLink className="h-3.5 w-3.5 opacity-30 group-hover:opacity-70 transition-opacity" />
    </a>
  );
}

// ── Main Page ──
function PreviewIndex() {
  const [search, setSearch] = useState("");

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

  const { data: assets = [] } = useQuery({
    queryKey: ["preview-assets", search],
    enabled: true,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_title")
        .not("asset_approved_at", "is", null)
        .order("asset_name")
        .limit(10);
      if (search.trim()) {
        q = q.or(`asset_name.ilike.%${search.trim()}%,problem_title.ilike.%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Group chapters by course
  const grouped = useMemo(() => {
    const map: Record<string, { code: string; name: string; chapters: any[] }> = {};
    chapters.forEach((ch: any) => {
      const code = ch.courses?.code || "OTHER";
      if (!map[code]) map[code] = { code, name: COURSE_LABELS[code] || ch.courses?.course_name || code, chapters: [] };
      map[code].chapters.push(ch);
    });
    return Object.values(map).sort((a, b) => (COURSE_ORDER[a.code] ?? 99) - (COURSE_ORDER[b.code] ?? 99));
  }, [chapters]);

  return (
    <div className="min-h-screen" style={{ background: "#14213D" }}>
      {/* Header */}
      <div className="pt-10 pb-2 text-center">
        <img src={LOGO_URL} alt="Survive Accounting" className="h-8 mx-auto mb-3 object-contain" />
        <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Internal Preview — For Team Use Only
        </p>
        <h1 className="mt-4 text-[28px] font-bold text-white">Staging Index</h1>
      </div>

      <div className="mx-auto max-w-[700px] px-5 py-8 space-y-12">
        {/* ── Chapter Pages ── */}
        <section>
          <SectionLabel>Chapter Pages</SectionLabel>
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.code}>
                <p className="text-[13px] font-semibold text-white mb-2">{group.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.chapters.map((ch: any) => (
                    <LinkCard
                      key={ch.id}
                      href={`/cram/${ch.id}`}
                      label={`Ch ${ch.chapter_number} — ${ch.chapter_name}`}
                      newTab
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Solutions Viewer ── */}
        <section>
          <SectionLabel>Solutions Viewer</SectionLabel>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by asset code or problem description"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-[13px] outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF" }}
            />
          </div>
          <div className="space-y-1">
            {assets.map((a: any) => (
              <LinkCard
                key={a.id}
                href={`/solutions/${a.asset_name}`}
                label={`${a.asset_name}${a.problem_title ? ` — ${a.problem_title.slice(0, 50)}` : ""}`}
                newTab
              />
            ))}
            {assets.length === 0 && (
              <p className="text-[12px] py-3 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>No results</p>
            )}
          </div>
          <a href="/solutions-qa" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-[12px] font-semibold" style={{ color: "#3B82F6" }}>
            Browse all →
          </a>
        </section>

        {/* ── Landing Pages ── */}
        <section>
          <SectionLabel>Landing Pages</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LANDING_CARDS.map((lp) => (
              <LinkCard
                key={lp.route}
                href={lp.route}
                label={lp.label}
                badge={lp.ready ? undefined : "Coming Soon"}
                badgeColor="#F59E0B"
                newTab
              />
            ))}
          </div>
        </section>

        {/* ── Greek Portal ── */}
        <section>
          <SectionLabel>Greek Portal</SectionLabel>
          <LinkCard
            href="https://greek.surviveaccounting.com"
            label="Greek Portal"
            badge="In Progress"
            badgeColor="#F59E0B"
            newTab
          />
        </section>

        {/* ── Home Landing Page ── */}
        <section>
          <SectionLabel>Home Landing Page</SectionLabel>
          <LinkCard
            href="/"
            label="Home Page"
            badge="Coming Soon"
            badgeColor="#F59E0B"
            newTab
          />
        </section>

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
