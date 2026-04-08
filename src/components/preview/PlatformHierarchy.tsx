import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ExternalLink } from "lucide-react";

const COURSE_ORDER: Record<string, number> = { INTRO1: 0, INTRO2: 1, IA1: 2, IA2: 3 };
const COURSE_META: Record<string, { label: string; code: string }> = {
  INTRO1: { label: "Intro Accounting 1", code: "ACCY 201" },
  INTRO2: { label: "Intro Accounting 2", code: "ACCY 202" },
  IA1: { label: "Intermediate Accounting 1", code: "ACCY 303" },
  IA2: { label: "Intermediate Accounting 2", code: "ACCY 304" },
};

const nodeBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "12px 16px",
  cursor: "pointer",
  transition: "all 200ms ease",
};

const activeBorder = "2px solid #CE1126";
const pill: React.CSSProperties = { background: "#F59E0B", color: "#000", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700 };
const muted: React.CSSProperties = { color: "rgba(255,255,255,0.4)", fontSize: 11 };
const connector: React.CSSProperties = { borderLeft: "1px solid rgba(255,255,255,0.2)", marginLeft: 18, paddingLeft: 20 };
const dashedConnector: React.CSSProperties = { borderLeft: "1px dashed rgba(255,255,255,0.15)", marginLeft: 18, paddingLeft: 20 };

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", color: "rgba(255,255,255,0.4)" }}
    />
  );
}

function ChapterNode({ ch }: { ch: { id: string; chapter_number: number; chapter_name: string } }) {
  return (
    <a
      href={`/cram/${ch.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 py-1.5 px-3 rounded-md text-[12px] text-white transition-all duration-150"
      style={{ background: "transparent" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, minWidth: 28 }}>
        Ch {ch.chapter_number}
      </span>
      <span className="truncate">{ch.chapter_name}</span>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ml-auto shrink-0" />
    </a>
  );
}

function CourseNode({ code, chapters }: { code: string; chapters: any[] }) {
  const [open, setOpen] = useState(false);
  const meta = COURSE_META[code] || { label: code, code: "" };

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3"
        style={{ ...nodeBase, borderLeft: open ? activeBorder : nodeBase.border }}
      >
        <Chevron open={open} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white">{meta.label}</p>
          <p style={muted}>{meta.code} · {chapters.length} chapters</p>
        </div>
      </div>
      {open && (
        <div style={connector} className="py-2 space-y-0.5">
          {chapters.map(ch => <ChapterNode key={ch.id} ch={ch} />)}
        </div>
      )}
    </div>
  );
}

export default function PlatformHierarchy() {
  const [campusOpen, setCampusOpen] = useState(false);

  const { data: courseData = [] } = useQuery({
    queryKey: ["hierarchy-chapters"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, courses!chapters_course_id_fkey(code)")
        .order("chapter_number");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    courseData.forEach((ch: any) => {
      const code = ch.courses?.code || "OTHER";
      if (!map[code]) map[code] = [];
      map[code].push(ch);
    });
    return Object.entries(map)
      .filter(([code]) => COURSE_META[code])
      .sort(([a], [b]) => (COURSE_ORDER[a] ?? 99) - (COURSE_ORDER[b] ?? 99));
  }, [courseData]);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "24px 20px", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Root node */}
      <div style={{ ...nodeBase, background: "#14213D", cursor: "default", textAlign: "center", borderColor: "rgba(255,255,255,0.2)" }}>
        <p className="text-[16px] font-bold text-white">Choose Your Campus</p>
        <p style={{ ...muted, marginTop: 2 }}>surviveaccounting.com</p>
        <span style={{ ...pill, display: "inline-block", marginTop: 6 }}>Coming Soon</span>
      </div>

      {/* Vertical connector from root */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)", margin: "0 auto" }} />

      {/* Level 1 row: Ole Miss + Greek branch */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Ole Miss branch */}
        <div className="flex-1 min-w-0">
          <div
            onClick={() => setCampusOpen(!campusOpen)}
            className="flex items-center gap-3"
            style={{ ...nodeBase, borderLeft: campusOpen ? activeBorder : nodeBase.border }}
          >
            <Chevron open={campusOpen} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white">Ole Miss</p>
              <p style={muted}>learn.surviveaccounting.com</p>
            </div>
          </div>

          {campusOpen && (
            <div style={connector} className="py-3 space-y-2">
              {grouped.map(([code, chapters]) => (
                <CourseNode key={code} code={code} chapters={chapters} />
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)", maxWidth: 420 }}>
            400+ universities across the country offer rigorous accounting programs — each one a potential campus for Survive Accounting. Campus database coming soon.
          </p>
        </div>

        {/* Greek Org side branch */}
        <div className="md:w-[220px] shrink-0">
          {/* Dashed horizontal connector on desktop */}
          <div className="hidden md:block" style={{ borderTop: "1px dashed rgba(255,255,255,0.15)", width: "100%", marginBottom: 12, marginTop: 24 }} />

          <div style={{ ...nodeBase, cursor: "default" }}>
            <p className="text-[13px] font-semibold text-white">Greek Organizations</p>
            <p style={muted}>greek.surviveaccounting.com</p>
            <span style={{ ...pill, display: "inline-block", marginTop: 6 }}>Coming Soon</span>
            <p className="mt-2" style={{ ...muted, fontSize: 10 }}>~20-30 orgs per campus</p>
          </div>
          <p className="mt-2 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            Connected to each campus's 4 courses
          </p>
        </div>
      </div>
    </div>
  );
}
