import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";

const NAVY = "#14213D";
const BLUE = "#4A90D9";
const RED = "#CE1126";
const GREEN = "#16A34A";

// ─── Price Ladder (Mock Data) ──────────────────────────────────────────────
const PRICE_TIERS = [
  { price: 25, threshold: 1 },
  { price: 50, threshold: 2 },
  { price: 75, threshold: 6 },
  { price: 100, threshold: 11 },
  { price: 125, threshold: 26 },
  { price: 150, threshold: 51 },
  { price: 175, threshold: 101 },
  { price: 250, threshold: 201 },
];
const MOCK_ENROLLED = 5;

function getTierIndex(enrolled: number): number {
  let idx = 0;
  for (let i = 0; i < PRICE_TIERS.length; i++) {
    if (enrolled >= PRICE_TIERS[i].threshold) idx = i;
  }
  return idx;
}

function PriceLadder() {
  const enrolled: number = MOCK_ENROLLED;
  const activeIdx = getTierIndex(enrolled);
  const currentPrice = PRICE_TIERS[activeIdx].price;
  const nextTier = PRICE_TIERS[activeIdx + 1];
  const foundingLeft = Math.max(0, 10 - enrolled);

  return (
    <div className="mx-auto max-w-[700px] mb-10 px-2">
      <p
        className="text-center text-[14px] font-medium mb-5"
        style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
      >
        Price increases as more students join. Lock in your rate today.
      </p>

      {/* Number line */}
      <div className="relative px-3 py-6">
        {/* Track */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 rounded-full" style={{ background: "#E5E7EB" }} />
        {/* Filled portion up to active */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all"
          style={{
            background: GREEN,
            width: `calc((100% - 24px) * ${activeIdx / (PRICE_TIERS.length - 1)})`,
          }}
        />
        {/* Dots */}
        <div className="relative flex justify-between items-center">
          {PRICE_TIERS.map((t, i) => {
            const isActive = i === activeIdx;
            const isPast = i < activeIdx;
            const dotColor = isActive ? GREEN : isPast ? "#9CA3AF" : "#D1D5DB";
            const size = isActive ? 18 : 10;
            return (
              <div key={t.price} className="flex flex-col items-center" style={{ width: 1 }}>
                <div
                  className={isActive ? "rounded-full ring-4 ring-green-200 animate-pulse" : "rounded-full"}
                  style={{
                    width: size,
                    height: size,
                    background: dotColor,
                  }}
                />
                <span
                  className="absolute mt-6 text-[11px] font-semibold whitespace-nowrap"
                  style={{
                    color: isActive ? GREEN : isPast ? "#6B7280" : "#9CA3AF",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ${t.price}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status line */}
      <p
        className="text-center text-[13px] mt-6"
        style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
      >
        <span className="font-semibold" style={{ color: NAVY }}>{enrolled} students enrolled</span>
        <span style={{ color: "#9CA3AF" }}> · </span>
        <span>Current price: <span className="font-semibold" style={{ color: GREEN }}>${currentPrice}</span></span>
        {nextTier && (
          <>
            <span style={{ color: "#9CA3AF" }}> · </span>
            <span>Next price increase at <span className="font-semibold">{nextTier.threshold} students</span></span>
          </>
        )}
      </p>

      {/* Founding spots counter */}
      {enrolled < 10 && (
        <p
          className="text-center text-[14px] font-bold mt-3 animate-fade-in"
          style={{ color: RED, fontFamily: "Inter, sans-serif" }}
        >
          {enrolled} founding spot{enrolled === 1 ? "" : "s"} claimed · {foundingLeft} left at this price
        </p>
      )}
    </div>
  );
}

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
  onExpansionClick?: () => void;
}

// Display order + color group + subtitle override per spec
const DISPLAY_ORDER: Array<{ slug: string; group: "intro" | "intermediate"; subtitle?: string }> = [
  { slug: "intro-accounting-1", group: "intro", subtitle: "Financial Principles" },
  { slug: "intro-accounting-2", group: "intro", subtitle: "Managerial Principles" },
  { slug: "intermediate-accounting-1", group: "intermediate" },
  { slug: "intermediate-accounting-2", group: "intermediate" },
];

export default function StagingCoursesSection({
  courses,
  onCardClick,
  onExpansionClick,
}: StagingCoursesSectionProps) {
  const ordered = DISPLAY_ORDER
    .map((d) => {
      const c = courses.find((x) => x.slug === d.slug);
      return c ? { course: c, group: d.group, subtitle: d.subtitle } : null;
    })
    .filter(Boolean) as Array<{ course: Course; group: "intro" | "intermediate"; subtitle?: string }>;

  return (
    <TooltipProvider delayDuration={150}>
    <section className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[860px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {ordered.map(({ course, group, subtitle }) => {
            const accent = group === "intro" ? BLUE : NAVY;
            return (
              <div
                key={course.id}
                className="rounded-2xl p-5 flex flex-col"
                style={{
                  background: "#fff",
                  borderLeft: `4px solid ${accent}`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="self-start inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white mb-3 cursor-help"
                      style={{ background: GREEN }}
                    >
                      Live across the SEC<span aria-hidden>*</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-[12px]">
                    Currently live at Ole Miss. Expanding to additional SEC schools August 2026.
                  </TooltipContent>
                </Tooltip>

                <h3
                  className="text-[18px] sm:text-[20px] font-bold leading-tight"
                  style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
                >
                  {course.name}
                </h3>
                {subtitle && (
                  <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
                    {subtitle}
                  </p>
                )}

                <button
                  onClick={() => onCardClick(course)}
                  className="w-full rounded-xl px-5 py-3 text-[14px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] mt-5"
                  style={{ background: RED, fontFamily: "Inter, sans-serif" }}
                >
                  Start Studying →
                </button>
              </div>
            );
          })}
        </div>

        <p
          className="mt-8 text-center text-[14px]"
          style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
        >
          Expanding across the SEC — August 2026.{" "}
          <Link
            to="/lees-story"
            className="font-medium underline underline-offset-2 hover:opacity-80"
            style={{ color: RED, fontFamily: "Inter, sans-serif" }}
          >
            Is your school next? →
          </Link>
        </p>
      </div>
    </section>
    </TooltipProvider>
  );
}
