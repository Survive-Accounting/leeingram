import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CampusChapterMeta from "@/components/CampusChapterMeta";
import SiteNavbar from "@/components/landing/SiteNavbar";

const NAVY = "#14213D";
const RED = "#CE1126";

const COURSE_SLUG_MAP: Record<string, string> = {
  "intermediate-accounting-2": "44444444-4444-4444-4444-444444444444",
  "intermediate-accounting-1": "33333333-3333-3333-3333-333333333333",
  "intro-accounting-1": "11111111-1111-1111-1111-111111111111",
  "intro-accounting-2": "22222222-2222-2222-2222-222222222222",
};

const COURSE_NAMES: Record<string, string> = {
  "intermediate-accounting-2": "Intermediate Accounting 2",
  "intermediate-accounting-1": "Intermediate Accounting 1",
  "intro-accounting-1": "Introductory Accounting 1",
  "intro-accounting-2": "Introductory Accounting 2",
};

// ── Source ref parsing for prefix bucketing ──
function parsePrefix(ref: string): "BE" | "QS" | "E" | "P" | "OTHER" {
  const m = (ref || "").toUpperCase().match(/^([A-Z]+)/);
  if (!m) return "OTHER";
  const p = m[1];
  if (p === "BE") return "BE";
  if (p === "QS") return "QS";
  if (p === "EX" || p === "E") return "E";
  if (p === "P") return "P";
  return "OTHER";
}

function parseSourceRef(ref: string): { prefix: string; num: number; sub: number } {
  const match = (ref || "").match(/^([A-Z]+)(\d+)(?:\.(\d+))?/i);
  if (!match) return { prefix: "ZZ", num: 9999, sub: 0 };
  return {
    prefix: match[1].toUpperCase(),
    num: Number.parseInt(match[2], 10),
    sub: match[3] ? Number.parseInt(match[3], 10) : 0,
  };
}

const PREFIX_ORDER: Record<string, number> = { BE: 0, QS: 1, E: 2, EX: 2, P: 3 };
function sortBySourceRef(a: { source_ref?: string | null }, b: { source_ref?: string | null }) {
  const left = parseSourceRef(a.source_ref || "");
  const right = parseSourceRef(b.source_ref || "");
  const lo = PREFIX_ORDER[left.prefix] ?? 99;
  const ro = PREFIX_ORDER[right.prefix] ?? 99;
  if (lo !== ro) return lo - ro;
  if (left.num !== right.num) return left.num - right.num;
  return left.sub - right.sub;
}

type TabKey = "practice" | "survive";
type PillKey = "be" | "ex" | "p";

export default function CampusChapterPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2", chapterNumber: chapterParam } = useParams();
  const chNum = parseInt((chapterParam || "0").replace("chapter-", ""), 10);
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";
  const isIntro = courseSlug === "intro-accounting-1" || courseSlug === "intro-accounting-2";
  const beLabel = isIntro ? "Quick Studies" : "Brief Exercises";

  const [tab, setTab] = useState<TabKey>("practice");
  const [pill, setPill] = useState<PillKey>("be");

  const { data: campus } = useQuery({
    queryKey: ["campus-chapter-campus", campusSlug],
    enabled: campusSlug !== "general",
    queryFn: async () => {
      const { data } = await supabase.from("campuses").select("id, name").eq("slug", campusSlug).maybeSingle();
      return data;
    },
  });

  const { data: chapter, isLoading: chapterLoading } = useQuery({
    queryKey: ["campus-chapter-resolve", courseId, chNum],
    enabled: chNum > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .eq("course_id", courseId)
        .eq("chapter_number", chNum)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: siblings = [] } = useQuery({
    queryKey: ["campus-chapter-siblings", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseId)
        .order("chapter_number");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["campus-chapter-assets", chapter?.id],
    enabled: !!chapter?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("teaching_assets")
        .select("id, asset_name, source_ref, asset_type, problem_title")
        .eq("chapter_id", chapter!.id)
        .not("asset_approved_at", "is", null);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        asset_name: string | null;
        source_ref: string | null;
        asset_type: string | null;
        problem_title: string | null;
      }>;
    },
  });

  // Bucket counts by source_ref prefix (asset_type is uniformly "practice_problem" in DB)
  const counts = useMemo(() => {
    let be = 0, ex = 0, p = 0;
    for (const a of assets) {
      const pr = parsePrefix(a.source_ref || "");
      if (pr === "BE" || pr === "QS") be++;
      else if (pr === "E") ex++;
      else if (pr === "P") p++;
    }
    return { be, ex, p };
  }, [assets]);

  const filtered = useMemo(() => {
    const sorted = [...assets].sort(sortBySourceRef);
    return sorted.filter((a) => {
      const pr = parsePrefix(a.source_ref || "");
      if (pill === "be") return pr === "BE" || pr === "QS";
      if (pill === "ex") return pr === "E";
      return pr === "P";
    });
  }, [assets, pill]);

  const campusName =
    campus?.name ||
    (campusSlug === "general"
      ? "Survive Accounting"
      : campusSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

  if (chapterLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">
        Chapter not found.
      </div>
    );
  }

  const cramSrc = `/cram/${chapter.id}`;

  return (
    <>
      <CampusChapterMeta
        campusName={campusName}
        campusSlug={campusSlug}
        courseName={courseName}
        courseSlug={courseSlug}
        chapterNumber={chapter.chapter_number}
        chapterName={chapter.chapter_name}
      />

      <div style={{ background: "#F8F8FA", minHeight: "100vh" }}>
        <SiteNavbar />

        <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 1200, paddingTop: 28, paddingBottom: 64 }}>
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="text-[12px] sm:text-[13px]"
            style={{ color: "#6B7280", fontFamily: "Inter, sans-serif", marginBottom: 12 }}
          >
            <Link
              to={`/campus/${campusSlug}/${courseSlug}`}
              className="hover:underline"
              style={{ color: "#6B7280" }}
            >
              {courseName}
            </Link>
            <span style={{ margin: "0 8px", color: "#CBD5E1" }}>›</span>
            <span style={{ color: NAVY, fontWeight: 600 }}>
              Ch {chapter.chapter_number} — {chapter.chapter_name}
            </span>
          </nav>

          {/* Title + subtitle */}
          <header style={{ marginBottom: 24 }}>
            <h1
              className="text-[26px] sm:text-[32px] leading-tight"
              style={{ color: NAVY, fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
            >
              Ch {chapter.chapter_number} — {chapter.chapter_name}
            </h1>
            <p
              className="text-[13px] sm:text-[14px]"
              style={{ color: "#6B7280", fontFamily: "Inter, sans-serif", marginTop: 6 }}
            >
              Exam prep by Lee Ingram · Tutor since 2015
            </p>
          </header>

          {/* Layout: content + sidebar */}
          <div className="campus-chapter-layout">
            <style>{`
              .campus-chapter-layout { display: block; }
              @media (min-width: 1024px) {
                .campus-chapter-layout { display: grid; grid-template-columns: 1fr 220px; gap: 32px; align-items: start; }
                .campus-chapter-sidebar { position: sticky; top: 96px; }
              }
            `}</style>

            <div>
              {/* Tabs */}
              <div
                role="tablist"
                aria-label="Chapter content"
                className="flex gap-2 sm:gap-3"
                style={{ marginBottom: 20 }}
              >
                {([
                  ["practice", "Practice Problems"],
                  ["survive", "Survive This Chapter"],
                ] as const).map(([key, label]) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(key)}
                      className="rounded-lg text-[13px] sm:text-[14px] font-semibold transition-all"
                      style={{
                        padding: "10px 18px",
                        background: active ? NAVY : "#FFFFFF",
                        color: active ? "#FFFFFF" : NAVY,
                        border: `1px solid ${active ? NAVY : "#E5E7EB"}`,
                        boxShadow: active ? "0 4px 12px rgba(20,33,61,0.18)" : "0 1px 2px rgba(0,0,0,0.04)",
                        fontFamily: "Inter, sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Practice Problems tab */}
              {tab === "practice" && (
                <section
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* Pills */}
                  <div className="flex flex-wrap gap-2 sm:gap-3" style={{ marginBottom: 16 }}>
                    {(
                      [
                        ["be", `${beLabel} (${counts.be})`],
                        ["ex", `Exercises (${counts.ex})`],
                        ["p", `Problems (${counts.p})`],
                      ] as Array<[PillKey, string]>
                    ).map(([key, label]) => {
                      const active = pill === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setPill(key)}
                          className="text-[12px] sm:text-[13px] font-semibold transition-all"
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            background: active ? NAVY : "#F3F4F6",
                            color: active ? "#FFFFFF" : NAVY,
                            border: `1px solid ${active ? NAVY : "transparent"}`,
                            fontFamily: "Inter, sans-serif",
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {assetsLoading ? (
                    <div className="flex items-center gap-2 py-6 text-[13px]" style={{ color: "#6B7280" }}>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading problems…
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-[13px]" style={{ color: "#6B7280", padding: "16px 4px" }}>
                      No problems in this category yet.
                    </p>
                  ) : (
                    <div style={{ borderTop: "1px solid #F1F5F9" }}>
                      {filtered.map((a, i) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 py-3 text-[13px]"
                          style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F1F5F9" : "none" }}
                        >
                          <span
                            className="font-mono shrink-0 text-[11px]"
                            style={{ color: NAVY, minWidth: 64 }}
                          >
                            {a.source_ref || "—"}
                          </span>
                          <span className="flex-1 min-w-0 truncate" style={{ color: "#374151" }}>
                            {a.problem_title || "Untitled problem"}
                          </span>
                          {a.asset_name && (
                            <a
                              href={`/solutions/${a.asset_name}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[12px] font-semibold hover:underline"
                              style={{ color: "#2563EB" }}
                            >
                              View →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Survive This Chapter tab — inline cram tool via iframe */}
              {tab === "survive" && (
                <section
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                >
                  <CramFrame src={cramSrc} title={`Survive Ch ${chapter.chapter_number}`} />
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="campus-chapter-sidebar" style={{ display: "block" }}>
              <div
                className="hidden lg:block"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: 12,
                  padding: "14px 12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <p
                  className="text-[11px] uppercase font-semibold"
                  style={{ color: "#6B7280", letterSpacing: "0.08em", marginBottom: 8, paddingLeft: 4 }}
                >
                  Other Chapters
                </p>
                <div className="space-y-0.5">
                  {siblings.map((ch) => {
                    const isCurrent = ch.id === chapter.id;
                    const truncName =
                      ch.chapter_name.length > 22 ? ch.chapter_name.slice(0, 22) + "…" : ch.chapter_name;
                    return isCurrent ? (
                      <div
                        key={ch.id}
                        className="text-[12px] font-bold"
                        style={{
                          color: NAVY,
                          background: "rgba(20,33,61,0.06)",
                          borderLeft: `2px solid ${RED}`,
                          padding: "5px 8px",
                          borderRadius: 4,
                        }}
                      >
                        Ch {ch.chapter_number} · {truncName}
                      </div>
                    ) : (
                      <Link
                        key={ch.id}
                        to={`/campus/${campusSlug}/${courseSlug}/${ch.chapter_number}`}
                        className="block text-[12px] transition-all hover:bg-gray-50"
                        style={{
                          color: NAVY,
                          padding: "5px 8px",
                          borderLeft: "2px solid transparent",
                          borderRadius: 4,
                        }}
                      >
                        Ch {ch.chapter_number} · {truncName}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}

/** Iframe wrapper that auto-resizes to its content height. */
function CramFrame({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(1400);

  return (
    <div style={{ position: "relative", minHeight: 600 }}>
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 text-[13px]"
          style={{ color: "#6B7280", background: "#FFFFFF", zIndex: 1 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" /> Loading chapter content…
        </div>
      )}
      <iframe
        src={src}
        title={title}
        loading="lazy"
        onLoad={(e) => {
          setLoaded(true);
          // Best-effort autosize for same-origin iframe
          try {
            const doc = (e.target as HTMLIFrameElement).contentDocument;
            if (doc) {
              const update = () => {
                const h = Math.max(doc.body?.scrollHeight || 0, doc.documentElement?.scrollHeight || 0);
                if (h > 0) setHeight(h + 20);
              };
              update();
              const ro = new ResizeObserver(update);
              ro.observe(doc.body);
            }
          } catch {
            // cross-origin or other failure — fallback height stays
          }
        }}
        style={{
          width: "100%",
          height,
          border: "none",
          display: "block",
          background: "#FFFFFF",
        }}
      />
    </div>
  );
}
