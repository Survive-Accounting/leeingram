const NAVY = "#14213D";
const BLUE = "#4A90D9";
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
                <span
                  className="self-start inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white mb-3"
                  style={{ background: accent }}
                >
                  Live at Ole Miss
                </span>

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
          Expanding to new campuses August 2026.{" "}
          <button
            type="button"
            onClick={onExpansionClick}
            className="underline-offset-2 hover:underline"
            style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
          >
            Is your school next? →
          </button>
        </p>
      </div>
    </section>
  );
}
