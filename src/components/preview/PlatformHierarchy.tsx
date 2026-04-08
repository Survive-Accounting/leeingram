import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ExternalLink, Home, BookOpen, Monitor, Film, FileText, BarChart3 } from "lucide-react";

const COURSE_ORDER: Record<string, number> = { INTRO1: 0, INTRO2: 1, IA1: 2, IA2: 3 };
const COURSE_LABELS: Record<string, { label: string; code: string }> = {
  INTRO1: { label: "Intro Accounting 1", code: "ACCY 201" },
  INTRO2: { label: "Intro Accounting 2", code: "ACCY 202" },
  IA1: { label: "Intermediate Accounting 1", code: "ACCY 303" },
  IA2: { label: "Intermediate Accounting 2", code: "ACCY 304" },
};

function classifyAsset(sourceRef: string): "qs" | "ex" | "p" {
  if (!sourceRef) return "p";
  const s = sourceRef.toUpperCase();
  if (s.startsWith("BE") || s.startsWith("QS")) return "qs";
  if (s.startsWith("E") || s.startsWith("EX")) return "ex";
  return "p";
}

function SubToggle({ label, icon, children, defaultOpen }: { label: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-2.5 px-1"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <ChevronRight
          className="h-3 w-3 transition-transform duration-200"
          style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{icon}</span>
        <span className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? 2000 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="pl-6 pb-3">{children}</div>
      </div>
    </div>
  );
}

// ── Chapter Detail Panel ──
function ChapterDetail({ chapter }: { chapter: any }) {
  const [activeTab, setActiveTab] = useState<"qs" | "ex" | "p" | null>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ["preview-ch-assets", chapter.id],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, problem_title, lw_activity_url, asset_approved_at")
        .eq("chapter_id", chapter.id)
        .not("asset_approved_at", "is", null)
        .order("asset_name");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { qs: [], ex: [], p: [] };
    assets.forEach((a: any) => {
      g[classifyAsset(a.source_ref)].push(a);
    });
    return g;
  }, [assets]);

  const tabs = [
    { key: "qs" as const, label: "Quick Studies", count: grouped.qs.length },
    { key: "ex" as const, label: "Exercises", count: grouped.ex.length },
    { key: "p" as const, label: "Problems", count: grouped.p.length },
  ];

  const lwUrl = assets.find((a: any) => a.lw_activity_url)?.lw_activity_url;

  return (
    <div className="space-y-0">
      {/* Sub-toggle 1: Chapter Homepage */}
      <SubToggle label="Chapter Homepage" icon={<Home className="h-3.5 w-3.5" />}>
        <a
          href={`/cram/${chapter.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-md px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-white/5"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <span>Ch {chapter.chapter_number} — {chapter.chapter_name}</span>
          <ExternalLink className="h-3 w-3 opacity-40" />
        </a>
      </SubToggle>

      {/* Sub-toggle 2: Practice Problems */}
      <SubToggle label="Practice Problems" icon={<BookOpen className="h-3.5 w-3.5" />}>
        <div className="flex gap-2 mb-3 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(activeTab === t.key ? null : t.key)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all"
              style={{
                background: activeTab === t.key ? "#14213D" : "rgba(255,255,255,0.05)",
                border: `1px solid ${activeTab === t.key ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
                color: activeTab === t.key ? "#FFFFFF" : "rgba(255,255,255,0.6)",
              }}
            >
              {t.label}
              <span
                className="rounded-full px-1.5 py-0 text-[10px] font-bold"
                style={{ background: "#CE1126", color: "#FFFFFF", minWidth: 18, textAlign: "center" }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
        {activeTab && (
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {grouped[activeTab].map((a: any, i: number) => (
              <a
                key={a.id}
                href={`/solutions/${a.asset_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded px-3 py-2 text-[11px] transition-colors hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="flex items-center gap-2 text-white truncate" style={{ maxWidth: "70%" }}>
                  <span className="font-mono opacity-60">{a.asset_name}</span>
                  {a.problem_title && (
                    <span className="opacity-40 truncate">— {a.problem_title.slice(0, 40)}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                    style={{
                      background: i < 3 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                      color: i < 3 ? "#22C55E" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {i < 3 ? "Free" : "Paid"}
                  </span>
                  <span style={{ color: "#CE1126", fontSize: 11, fontWeight: 600 }}>View →</span>
                </span>
              </a>
            ))}
            {grouped[activeTab].length === 0 && (
              <p className="text-[11px] py-2 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>None yet</p>
            )}
          </div>
        )}
      </SubToggle>

      {/* Sub-toggle 3: LearnWorlds Player */}
      <SubToggle label="LearnWorlds Player" icon={<Monitor className="h-3.5 w-3.5" />}>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          {lwUrl || `player.surviveaccounting.com/...`}
        </p>
        <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold mt-1" style={{ background: "#F59E0B", color: "#14213D" }}>
          🚧 Coming Soon
        </span>
      </SubToggle>

      {/* Sub-toggle 4: Coming Soon */}
      <SubToggle label="Coming Soon" icon={<BarChart3 className="h-3.5 w-3.5" />}>
        <div className="space-y-2">
          {[
            { emoji: "🎬", label: "Video Links" },
            { emoji: "📝", label: "Quiz Links" },
            { emoji: "📊", label: "Analytics & Conversion %" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span>{item.emoji}</span>
              <span>{item.label}</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold ml-1" style={{ background: "#F59E0B", color: "#14213D" }}>
                🚧 Coming Soon
              </span>
            </div>
          ))}
        </div>
      </SubToggle>
    </div>
  );
}

// ── Tree Node ──
function TreeNode({ label, subtitle, badge, depth, children, expandable, defaultOpen, redBorder }: {
  label: string; subtitle?: string; badge?: string; depth: number;
  children?: React.ReactNode; expandable?: boolean; defaultOpen?: boolean; redBorder?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      {depth > 0 && (
        <div style={{ position: "relative", marginLeft: -8 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: "50%", width: 1, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ position: "absolute", left: 0, top: "50%", width: 12, height: 1, background: "rgba(255,255,255,0.12)" }} />
        </div>
      )}
      <div
        className="rounded-lg my-1.5 transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderLeft: open && redBorder !== false ? "2px solid #CE1126" : "1px solid rgba(255,255,255,0.08)",
          padding: "10px 14px",
        }}
      >
        <button
          onClick={expandable ? () => setOpen(!open) : undefined}
          className="flex items-center gap-2 w-full text-left"
          style={{ background: "none", border: "none", cursor: expandable ? "pointer" : "default", padding: 0 }}
        >
          {expandable && (
            <ChevronRight
              className="h-3.5 w-3.5 transition-transform duration-200"
              style={{ color: "rgba(255,255,255,0.4)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          )}
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-white">{label}</span>
            {subtitle && <span className="block text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{subtitle}</span>}
          </div>
          {badge && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0" style={{ background: "#F59E0B", color: "#14213D" }}>
              🚧 {badge}
            </span>
          )}
        </button>
        <div
          className="overflow-hidden transition-all duration-200"
          style={{ maxHeight: open ? 10000 : 0, opacity: open ? 1 : 0 }}
        >
          {open && children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
export default function PlatformHierarchy() {
  const { data: chapters = [] } = useQuery({
    queryKey: ["hierarchy-chapters"],
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

  const courseGroups = useMemo(() => {
    const map: Record<string, { code: string; chapters: any[] }> = {};
    chapters.forEach((ch: any) => {
      const code = ch.courses?.code || "OTHER";
      if (!map[code]) map[code] = { code, chapters: [] };
      map[code].chapters.push(ch);
    });
    return Object.values(map).sort((a, b) => (COURSE_ORDER[a.code] ?? 99) - (COURSE_ORDER[b.code] ?? 99));
  }, [chapters]);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Choose Your Campus */}
      <TreeNode
        label="Choose Your Campus"
        subtitle="surviveaccounting.com"
        badge="Coming Soon"
        depth={0}
        expandable
        defaultOpen
      >
        <p className="text-[11px] mb-3 px-1" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
          Landing page where students select their university. Each campus gets its own branded experience with course-specific content and pricing.
        </p>
        <p className="text-[11px] px-1" style={{ color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
          400+ universities across the country offer rigorous accounting programs — each one a potential campus for Survive Accounting.
        </p>
      </TreeNode>

      {/* Campus Page */}
      <div className="mt-2">
        <TreeNode
          label="Campus Page"
          subtitle="learn.surviveaccounting.com"
          depth={0}
          expandable
        >
          <p className="text-[11px] mb-3 px-1" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
            The main student hub for a campus. Hosts all 4 course pages, chapter content, practice problems, and study tools. Currently live for Ole Miss.
          </p>
          {courseGroups.map((cg) => {
            const info = COURSE_LABELS[cg.code];
            return (
              <TreeNode
                key={cg.code}
                label={info?.label || cg.code}
                subtitle={info?.code}
                depth={1}
                expandable
              >
                {cg.chapters.map((ch: any) => (
                  <TreeNode
                    key={ch.id}
                    label={`Ch ${ch.chapter_number} — ${ch.chapter_name}`}
                    depth={2}
                    expandable
                  >
                    <ChapterDetail chapter={ch} />
                  </TreeNode>
                ))}
              </TreeNode>
            );
          })}
        </TreeNode>
      </div>

      {/* Greek Org Page */}
      <div className="mt-2">
        <TreeNode
          label="Greek Org Page"
          subtitle="greek.surviveaccounting.com"
          badge="Coming Soon"
          depth={0}
          expandable
        >
          <p className="text-[11px] mb-3 px-1" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
            Group licensing portal for fraternities and sororities. Chapter presidents purchase bulk access for members at a discounted rate. ~20-30 orgs per campus.
          </p>
        </TreeNode>
      </div>
    </div>
  );
}
