import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ChevronRight } from "lucide-react";

const COURSE_ORDER: Record<string, number> = { INTRO1: 0, INTRO2: 1, IA1: 2, IA2: 3 };
const COURSE_LABELS: Record<string, string> = {
  INTRO1: "Intro Accounting 1",
  INTRO2: "Intro Accounting 2",
  IA1: "Intermediate Accounting 1",
  IA2: "Intermediate Accounting 2",
};

function classifyAsset(sourceRef: string): "qs" | "ex" | "p" {
  if (!sourceRef) return "p";
  const s = sourceRef.toUpperCase();
  if (s.startsWith("BE") || s.startsWith("QS")) return "qs";
  if (s.startsWith("E") || s.startsWith("EX")) return "ex";
  return "p";
}

const TYPE_LABELS: Record<string, string> = { qs: "Quick Studies", ex: "Exercises", p: "Problems" };
const TYPE_ORDER = ["qs", "ex", "p"] as const;

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  color: "#FFFFFF",
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  flex: 1,
  minWidth: 0,
};

export default function SolutionsViewerSection() {
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [chapterFilter, setChapterFilter] = useState<string>("");
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const { data: chapters = [] } = useQuery({
    queryKey: ["sv-chapters"],
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

  const courseOptions = useMemo(() => {
    const map: Record<string, string> = {};
    chapters.forEach((ch: any) => {
      const code = ch.courses?.code;
      if (code && !map[code]) map[code] = COURSE_LABELS[code] || code;
    });
    return Object.entries(map).sort(([a], [b]) => (COURSE_ORDER[a] ?? 99) - (COURSE_ORDER[b] ?? 99));
  }, [chapters]);

  const filteredChapters = useMemo(() => {
    if (!courseFilter) return [];
    return chapters.filter((ch: any) => ch.courses?.code === courseFilter);
  }, [chapters, courseFilter]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["sv-assets", chapterFilter],
    enabled: !!chapterFilter,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_title")
        .eq("chapter_id", chapterFilter)
        .not("asset_approved_at", "is", null)
        .order("source_ref");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { qs: [], ex: [], p: [] };
    assets.forEach((a: any) => g[classifyAsset(a.source_ref)].push(a));
    return g;
  }, [assets]);

  const toggleType = (t: string) => setExpandedTypes((prev) => ({ ...prev, [t]: !prev[t] }));

  const hasChapter = !!chapterFilter;

  return (
    <div>
      {/* Filter row */}
      <div className="flex gap-2 mb-4">
        <select
          value={courseFilter}
          onChange={(e) => { setCourseFilter(e.target.value); setChapterFilter(""); setExpandedTypes({}); }}
          style={selectStyle}
        >
          <option value="">All Courses</option>
          {courseOptions.map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
        <select
          value={chapterFilter}
          onChange={(e) => { setChapterFilter(e.target.value); setExpandedTypes({}); }}
          style={selectStyle}
          disabled={!courseFilter}
        >
          <option value="">All Chapters</option>
          {filteredChapters.map((ch: any) => (
            <option key={ch.id} value={ch.id}>Ch {ch.chapter_number} — {ch.chapter_name}</option>
          ))}
        </select>
      </div>

      {!hasChapter ? (
        <p className="text-[13px] text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
          Select a course and chapter to browse problems
        </p>
      ) : isLoading ? (
        <p className="text-[13px] text-center py-6" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>
      ) : (
        <div className="space-y-3">
          {TYPE_ORDER.map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const isOpen = !!expandedTypes[type];
            return (
              <div key={type}>
                <button
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition-all"
                  style={{
                    background: isOpen ? "#14213D" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
                    color: isOpen ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight
                    className="h-3 w-3 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                  {TYPE_LABELS[type]}
                  <span
                    className="rounded-full px-1.5 py-0 text-[10px] font-bold"
                    style={{ background: "#CE1126", color: "#FFFFFF", minWidth: 18, textAlign: "center" }}
                  >
                    {items.length}
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{ maxHeight: isOpen ? 10000 : 0, opacity: isOpen ? 1 : 0 }}
                >
                  <div className="mt-2 space-y-0.5">
                    {items.map((a: any) => (
                      <a
                        key={a.id}
                        href={`/solutions/${a.asset_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded px-3 py-2 text-[12px] transition-all hover:border-l-2"
                        style={{ borderLeft: "2px solid transparent" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = "#CE1126"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent"; }}
                      >
                        <span className="font-mono text-[11px] shrink-0 w-[60px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {a.source_ref || "—"}
                        </span>
                        <span className="flex-1 truncate text-white" style={{ maxWidth: "calc(100% - 100px)" }}>
                          {a.problem_title ? a.problem_title.slice(0, 60) : ""}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" style={{ color: "#FFFFFF" }} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <a href="/solutions-qa" target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-[12px] font-semibold" style={{ color: "#3B82F6" }}>
        Browse all →
      </a>
    </div>
  );
}
