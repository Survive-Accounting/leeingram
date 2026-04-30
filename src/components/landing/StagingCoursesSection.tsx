import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BetaPaywallModal from "./BetaPaywallModal";
import { useIsStaff } from "@/hooks/useIsStaff";
import leeHeadshot from "@/assets/lee-headshot-original.png";

const NAVY = "#14213D";
const RED = "#CE1126";

interface Course {
  id: string;
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  status: "live" | "upcoming" | "future";
  slug: string;
}

interface StagingCoursesSectionProps {
  courses: Course[];
  onCardClick: (course: Course) => void;
  onChapterClick?: (course: Course, chapterNumber: number, chapterName?: string) => void;
  onExpansionClick?: () => void;
  onGetStartedClick?: (preselectedSlug: string | null) => void;
}

const DISPLAY_ORDER = [
  "intro-accounting-1",
  "intro-accounting-2",
  "intermediate-accounting-1",
  "intermediate-accounting-2",
];

const SHORT_NAME: Record<string, string> = {
  "intro-accounting-1": "Intro 1",
  "intro-accounting-2": "Intro 2",
  "intermediate-accounting-1": "Intermediate 1",
  "intermediate-accounting-2": "Intermediate 2",
};

/** Pick first section prefix group by course family. */
function firstSectionPrefixes(slug: string): string[] {
  const isIntro = slug.startsWith("intro-");
  return isIntro ? ["QS", "BE"] : ["BE"];
}

interface Chapter {
  id: string;
  chapter_number: number;
  chapter_name: string;
}

interface ProblemDetail {
  id: string;
  source_ref: string;
  problem_title: string | null;
  asset_name: string | null;
  survive_problem_text: string | null;
  instruction_1: string | null;
  instruction_2: string | null;
  instruction_3: string | null;
  instruction_4: string | null;
  instruction_5: string | null;
  survive_solution_text: string | null;
}

export default function StagingCoursesSection({
  courses,
  onCardClick,
  onGetStartedClick,
}: StagingCoursesSectionProps) {
  const ordered = useMemo(
    () =>
      DISPLAY_ORDER.map((slug) => courses.find((c) => c.slug === slug)).filter(
        Boolean,
      ) as Course[],
    [courses],
  );

  const [selectedSlug, setSelectedSlug] = useState<string>(ordered[0]?.slug ?? "");
  const selected = ordered.find((c) => c.slug === selectedSlug) ?? ordered[0];

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const isStaff = useIsStaff();

  // Listen for paywall trigger from the embedded V2 viewer iframe (skipped for staff)
  useEffect(() => {
    if (isStaff) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data && typeof data === "object" && data.type === "sa-embed-paywall") {
        setPaywallOpen(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isStaff]);

  // Load chapters when course changes
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", selected.id)
        .order("chapter_number", { ascending: true });
      if (cancelled) return;
      const chs = (data ?? []) as Chapter[];
      setChapters(chs);
      setSelectedChapterId(chs[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  // Load first problem of selected chapter
  useEffect(() => {
    if (!selectedChapterId || !selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    const minDelay = new Promise((r) => setTimeout(r, 250));
    (async () => {
      const prefixes = firstSectionPrefixes(selected.slug);
      const orFilter = prefixes.map((p) => `source_ref.ilike.${p}%`).join(",");
      const [{ data }] = await Promise.all([
        (supabase as any)
          .from("teaching_assets")
          .select(
            "id, source_ref, problem_title, asset_name, survive_problem_text, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, survive_solution_text",
          )
          .eq("chapter_id", selectedChapterId)
          .or(orFilter)
          .order("source_ref", { ascending: true })
          .limit(1),
        minDelay,
      ]);
      if (cancelled) return;
      const first = (data ?? [])[0] ?? null;
      setDetail(first as ProblemDetail | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChapterId, selected?.slug]);

  const handleJoinBeta = () => {
    if (selected) onCardClick(selected);
  };

  return (
    <section
      id="courses-section"
      className="relative px-4 sm:px-6 scroll-mt-0 overflow-hidden"
      style={{
        background: "#F3F4F6",
        borderTop: "1px solid #E5E7EB",
        paddingTop: 80,
        paddingBottom: 80,
      }}
    >
      <style>{`
        .demo-card-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .demo-card-scroll::-webkit-scrollbar-track { background: transparent; }
        .demo-card-scroll::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        .demo-card-scroll::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

        @keyframes demoFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoSpin { to { transform: rotate(360deg); } }
        .demo-spin {
          width: 36px; height: 36px;
          border: 3px solid rgba(206,17,38,0.18);
          border-top-color: ${RED};
          border-radius: 50%;
          animation: demoSpin 800ms linear infinite;
        }
        .demo-fade-up { animation: demoFadeUp 320ms ease-out forwards; }

        .demo-cta {
          background: linear-gradient(135deg, #CE1126 0%, #A30D1F 100%);
          box-shadow: 0 8px 20px -6px rgba(206,17,38,0.45);
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
        }
        .demo-cta:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow: 0 12px 26px -6px rgba(206,17,38,0.55);
        }
        .demo-cta:active { transform: translateY(0); }

        .demo-chip {
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
        }

        @media (prefers-reduced-motion: reduce) {
          .demo-fade-up { animation: none; }
          .demo-cta { transition: none; }
          .demo-cta:hover { transform: none; }
        }
      `}</style>

      {/* Section heading */}
      <div className="mx-auto text-center mb-8" style={{ maxWidth: 640 }}>
        <p
          className="mb-2 text-[11px] sm:text-[12px] font-semibold tracking-[0.14em] uppercase"
          style={{ color: RED, fontFamily: "Inter, sans-serif" }}
        >
          Explore what you’ll get below
        </p>
        <h2
          className="text-[28px] sm:text-[36px] leading-tight"
          style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: NAVY }}
        >
          Built for last-minute accounting studying.
        </h2>
        <p
          className="mt-3 sm:mt-4 text-[15px] sm:text-[16px]"
          style={{ fontFamily: "Inter, sans-serif", color: "#6B7280", lineHeight: 1.55 }}
        >
          Pick a course, choose a chapter, start cramming — just in time for finals.
        </p>
      </div>

      {/* Course tabs (above laptop) */}
      <div id="explore-demo" className="mx-auto max-w-[1100px] mb-3 scroll-mt-20">
        <div className="flex flex-wrap justify-center gap-2">
          {ordered.map((c) => {
            const isActive = c.slug === selectedSlug;
            return (
              <button
                key={c.slug}
                onClick={() => setSelectedSlug(c.slug)}
                className="demo-chip rounded-full px-4 py-2 text-[13px] font-semibold inline-flex items-center gap-1.5"
                style={{
                  fontFamily: "Inter, sans-serif",
                  background: isActive ? NAVY : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#374151",
                  border: `1px solid ${isActive ? NAVY : "#E5E7EB"}`,
                  boxShadow: isActive
                    ? "0 2px 8px rgba(20,33,61,0.18)"
                    : "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {SHORT_NAME[c.slug] ?? c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapter dropdown (above laptop) */}
      <div className="mx-auto max-w-[1100px] mb-6 flex justify-center">
        {chapters.length === 0 ? (
          <div style={{ height: 40 }} />
        ) : (
          <div className="relative inline-block">
            <select
              value={selectedChapterId ?? ""}
              onChange={(e) => setSelectedChapterId(e.target.value)}
              className="appearance-none rounded-lg pl-4 pr-10 py-2.5 text-[13px] font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{
                fontFamily: "Inter, sans-serif",
                background: "#FFFFFF",
                color: NAVY,
                border: "1px solid #D1D5DB",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                minWidth: 280,
              }}
            >
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Ch. {ch.chapter_number} — {ch.chapter_name}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
              style={{ color: "#6B7280" }}
            >
              ▼
            </span>
          </div>
        )}
      </div>

      {/* Laptop */}
      <LaptopViewer
        detail={detail}
        loading={loading}
        onPaywall={() => setPaywallOpen(true)}
        isStaff={isStaff}
      />

      <BetaPaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onJoinBeta={handleJoinBeta}
      />

      {/* Benefit cards */}
      <div className="mx-auto mt-12 sm:mt-16" style={{ maxWidth: 1100 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {[
            {
              title: "Practice by chapter",
              body: "Jump straight to the topics showing up on your exam.",
            },
            {
              title: "Ask when you’re stuck",
              body: "Get hints, setups, walkthroughs, and simple explanations.",
            },
            {
              title: "Shape the tool",
              body: "Your questions help us decide what videos, examples, and features to build next.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl p-5 sm:p-6 transition-transform hover:-translate-y-0.5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 2px rgba(20,33,61,0.04)",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 28,
                  height: 3,
                  borderRadius: 2,
                  background: RED,
                  marginBottom: 12,
                }}
              />
              <h3
                className="text-[16px] sm:text-[17px] font-bold mb-1.5"
                style={{ color: NAVY, letterSpacing: "-0.005em" }}
              >
                {c.title}
              </h3>
              <p
                className="text-[14px]"
                style={{ color: "#6B7280", lineHeight: 1.55 }}
              >
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Laptop viewer                                              */
/* ────────────────────────────────────────────────────────── */

interface LaptopViewerProps {
  detail: ProblemDetail | null;
  loading: boolean;
  onPaywall: () => void;
  isStaff?: boolean;
}

function LaptopViewer({ detail, loading, onPaywall, isStaff }: LaptopViewerProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1100 }}>
      {/* Lid */}
      <div
        className="relative mx-auto"
        style={{
          background: "linear-gradient(180deg, #d8dadd 0%, #c2c4c8 100%)",
          borderRadius: "18px 18px 6px 6px",
          padding: "14px 14px 18px 14px",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.6)",
          border: "1px solid #a8aaae",
        }}
      >
        {/* Bezel */}
        <div
          style={{
            background: "#0a0a0a",
            borderRadius: 6,
            padding: 10,
            border: "1px solid #1a1a1a",
          }}
        >
          {/* Camera dot */}
          <div className="flex justify-center mb-1.5">
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#222",
              }}
            />
          </div>
          {/* Screen */}
          <div
            className="relative w-full"
            style={{
              aspectRatio: "16 / 10",
              minHeight: 460,
              overflow: "hidden",
              background: "#FFFFFF",
              borderRadius: 3,
            }}
          >
            <ScreenContent detail={detail} loading={loading} onPaywall={onPaywall} isStaff={isStaff} />
          </div>
        </div>
      </div>
      {/* Hinge */}
      <div
        className="mx-auto"
        style={{
          width: "100%",
          height: 14,
          background: "linear-gradient(180deg, #b8babe 0%, #8e9094 100%)",
          borderRadius: "0 0 14px 14px",
          boxShadow: "0 6px 12px rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );
}

function BrandedLoader({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #14213D 0%, #1a2d5a 55%, #CE1126 145%)",
      }}
    >
      <style>{`
        @keyframes saLoaderFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes saLoaderDot {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40%           { opacity: 1;    transform: translateY(-3px); }
        }
        .sa-loader-headshot { animation: saLoaderFloat 4s ease-in-out infinite; }
        .sa-loader-dot      { animation: saLoaderDot 1.4s ease-in-out infinite; }
        .sa-loader-dot:nth-child(2) { animation-delay: 0.18s; }
        .sa-loader-dot:nth-child(3) { animation-delay: 0.36s; }
        @media (prefers-reduced-motion: reduce) {
          .sa-loader-headshot, .sa-loader-dot { animation: none !important; }
        }
      `}</style>

      {/* Headshot */}
      <div
        className="sa-loader-headshot rounded-full overflow-hidden"
        style={{
          width: 72,
          height: 72,
          border: "2px solid #FFFFFF",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          background: "linear-gradient(135deg, #DDE7F5 0%, #C8D6EC 100%)",
        }}
      >
        <img
          src={leeHeadshot}
          alt="Lee Ingram"
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 15%" }}
          loading="eager"
          decoding="async"
        />
      </div>

      {/* Wordmark */}
      <div
        className="mt-4 tracking-tight"
        style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}
      >
        <span style={{ color: RED, fontWeight: 800 }}>Survive</span>
        <span style={{ color: "#FFFFFF", fontWeight: 400 }}> Accounting</span>
      </div>

      {/* Sub-line */}
      <div
        className="mt-1.5 text-[13px]"
        style={{
          fontFamily: "Inter, sans-serif",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {label}
      </div>

      {/* Pulsing dots */}
      <div className="mt-4 flex items-center gap-1.5">
        <span
          className="sa-loader-dot block rounded-full"
          style={{ width: 5, height: 5, background: "rgba(255,255,255,0.55)" }}
        />
        <span
          className="sa-loader-dot block rounded-full"
          style={{ width: 5, height: 5, background: "rgba(255,255,255,0.55)" }}
        />
        <span
          className="sa-loader-dot block rounded-full"
          style={{ width: 5, height: 5, background: "rgba(255,255,255,0.55)" }}
        />
      </div>
    </div>
  );
}

function ScreenContent({ detail, loading, onPaywall, isStaff }: LaptopViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Reset ready state whenever the asset changes so the loader shows on swap.
  useEffect(() => {
    setIframeReady(false);
  }, [detail?.asset_name]);

  if (loading || !detail) {
    return <BrandedLoader label="Loading your preview…" />;
  }

  // Admins get the full, unrestricted viewer (no embed click-interception).
  const src = isStaff
    ? `/v2/solutions/${detail.asset_name}`
    : `/v2/solutions/${detail.asset_name}?embed=1`;

  return (
    <div className="absolute inset-0">
      {!iframeReady && <BrandedLoader label="Loading your preview…" />}
      <iframe
        key={detail.asset_name}
        ref={iframeRef}
        src={src}
        title={`Live preview — ${detail.source_ref ?? detail.asset_name}`}
        onLoad={() => setIframeReady(true)}
        className="absolute inset-0 w-full h-full"
        style={{ border: 0, background: "#FFFFFF" }}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      {/* Staff-only neutral badge — students see no top-center indicator. */}
      {isStaff && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white shadow-lg pointer-events-none"
          style={{
            background: "rgba(15,23,42,0.85)",
            letterSpacing: "0.06em",
            fontFamily: "Inter, sans-serif",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
          aria-label="Admin preview mode"
        >
          Admin Preview
        </div>
      )}
    </div>
  );
}
