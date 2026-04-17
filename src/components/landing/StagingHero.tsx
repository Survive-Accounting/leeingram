const NAVY = "#14213D";

interface Course {
  id: string;
  name: string;
  subtext?: string;
  availability: string;
  cta: string;
  status: "live" | "upcoming" | "future";
  slug: string;
}

interface StagingHeroProps {
  liveCourse: Course;
  futureCourses: Course[];
  onLiveCourseClick: () => void;
  onNotifyClick: (course: Course) => void;
}

// Note: liveCourse / futureCourses / handlers kept in props for backward compat with parent,
// but the hero is now a pure split-card brand intro. Course cards render in a separate section.
export default function StagingHero(_props: StagingHeroProps) {
  return (
    <section className="px-0 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[1100px] overflow-hidden sm:rounded-2xl shadow-lg flex flex-col md:flex-row">
        {/* LEFT — Photo */}
        <div className="w-full md:w-1/3 shrink-0">
          <img
            src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg"
            alt="Lee Ingram"
            className="w-full h-[200px] md:h-full object-cover"
            style={{ objectPosition: "center top" }}
          />
        </div>

        {/* RIGHT — Text */}
        <div
          className="flex-1 p-5 md:p-6"
          style={{ background: NAVY }}
        >
          <h1
            className="text-white leading-[1.15] tracking-tight text-[26px] sm:text-[34px] md:text-[40px]"
            style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
          >
            Your exam is coming.
            <br />
            Let's get you ready.
          </h1>

          <p
            className="mt-4 text-[14px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)", fontFamily: "Inter, sans-serif" }}
          >
            Ole Miss accounting alum, turned full-time tutor. I genuinely love helping college students understand accounting — not just survive it.
          </p>

          <p
            className="mt-3 text-[13px]"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif" }}
          >
            Study tools for serious accounting students.
          </p>
        </div>
      </div>
    </section>
  );
}
