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
  onExpansionClick?: () => void;
}

const DISPLAY_ORDER = [
  "intro-accounting-1",
  "intro-accounting-2",
  "intermediate-accounting-1",
  "intermediate-accounting-2",
];

export default function StagingCoursesSection({
  courses,
  onCardClick,
}: StagingCoursesSectionProps) {
  const ordered = DISPLAY_ORDER
    .map((slug) => courses.find((c) => c.slug === slug))
    .filter(Boolean) as Course[];

  return (
    <section className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: "#F8F8FA" }}>
      <div className="mx-auto max-w-[860px]">
        <p
          className="text-center text-[13px] sm:text-[14px] font-semibold uppercase tracking-[0.15em] mb-8"
          style={{ color: "#6B7280", fontFamily: "Inter, sans-serif" }}
        >
          Which course are you studying?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {ordered.map((course) => (
            <div
              key={course.id}
              className="rounded-2xl p-6 flex flex-col"
              style={{
                background: "#fff",
                borderLeft: `4px solid ${NAVY}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
              }}
            >
              <h3
                className="text-[18px] sm:text-[20px] font-bold leading-tight flex-1"
                style={{ color: NAVY, fontFamily: "Inter, sans-serif" }}
              >
                {course.name}
              </h3>

              <button
                onClick={() => onCardClick(course)}
                className="w-full rounded-xl px-5 py-3 text-[14px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] mt-5"
                style={{ background: RED, fontFamily: "Inter, sans-serif" }}
              >
                Preview Free →
              </button>
            </div>
          ))}
        </div>

        <p
          className="mt-8 text-center text-[14px]"
          style={{ color: "#4A5568", fontFamily: "Inter, sans-serif" }}
        >
          Started at Ole Miss. Built for accounting students anywhere.
        </p>
      </div>
    </section>
  );
}
