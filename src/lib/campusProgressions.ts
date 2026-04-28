/**
 * Campus-specific course progressions.
 *
 * Each campus defines the ordered list of courses it offers, plus the
 * local course code students recognize (e.g. "ACCY 201" at Ole Miss).
 *
 * To add a new campus later:
 *   1. Add a new entry to CAMPUS_PROGRESSIONS keyed by campus slug.
 *   2. List the courses in the order students take them.
 *   3. Provide the campus-specific `code` for each course.
 *
 * If a campus is unknown OR resolves to "general", the GENERIC progression
 * is used (Intro 1 → Intro 2 → Intermediate 1 → Intermediate 2).
 */

export type CourseSlug =
  | "intro-accounting-1"
  | "intro-accounting-2"
  | "intermediate-accounting-1"
  | "intermediate-accounting-2";

export interface ProgressionCourse {
  slug: CourseSlug;
  /** Generic display name (used as fallback). */
  name: string;
  /** Campus-local course code. `null` → render the generic name only. */
  code: string | null;
  /** URL aliases that should resolve to this slug. */
  aliases: string[];
}

export interface CampusProgression {
  campusSlug: string;
  campusName: string;
  courses: ProgressionCourse[];
}

const GENERIC_COURSES: ProgressionCourse[] = [
  {
    slug: "intro-accounting-1",
    name: "Introductory Accounting 1",
    code: null,
    aliases: ["intro-1", "intro1"],
  },
  {
    slug: "intro-accounting-2",
    name: "Introductory Accounting 2",
    code: null,
    aliases: ["intro-2", "intro2"],
  },
  {
    slug: "intermediate-accounting-1",
    name: "Intermediate Accounting 1",
    code: null,
    aliases: ["ia1", "intermediate-1"],
  },
  {
    slug: "intermediate-accounting-2",
    name: "Intermediate Accounting 2",
    code: null,
    aliases: ["ia2", "intermediate-2"],
  },
];

export const GENERIC_PROGRESSION: CampusProgression = {
  campusSlug: "general",
  campusName: "All Campuses",
  courses: GENERIC_COURSES,
};

const OLE_MISS_PROGRESSION: CampusProgression = {
  campusSlug: "ole-miss",
  campusName: "Ole Miss",
  courses: [
    {
      slug: "intro-accounting-1",
      name: "Introductory Accounting 1",
      code: "ACCY 201",
      aliases: ["intro-1", "intro1", "accy-201", "accy201"],
    },
    {
      slug: "intro-accounting-2",
      name: "Introductory Accounting 2",
      code: "ACCY 202",
      aliases: ["intro-2", "intro2", "accy-202", "accy202"],
    },
    {
      slug: "intermediate-accounting-1",
      name: "Intermediate Accounting 1",
      code: "ACCY 303",
      aliases: ["ia1", "intermediate-1", "accy-303", "accy303"],
    },
    {
      slug: "intermediate-accounting-2",
      name: "Intermediate Accounting 2",
      code: "ACCY 304",
      aliases: ["ia2", "intermediate-2", "accy-304", "accy304"],
    },
  ],
};

export const CAMPUS_PROGRESSIONS: Record<string, CampusProgression> = {
  "ole-miss": OLE_MISS_PROGRESSION,
};

/** Return the progression for a campus, falling back to GENERIC. */
export function getCampusProgression(campusSlug: string | null | undefined): CampusProgression {
  if (!campusSlug) return GENERIC_PROGRESSION;
  return CAMPUS_PROGRESSIONS[campusSlug.toLowerCase()] ?? GENERIC_PROGRESSION;
}

/**
 * Build the label shown to students for a course within a campus context.
 * Per the global rule: campus code alone when present (e.g. "ACCY 201"),
 * otherwise the generic course name.
 */
export function formatCourseLabel(course: ProgressionCourse): string {
  return course.code ? course.code : course.name;
}

/** Resolve a course slug from a URL param against a progression. */
export function resolveCourseSlug(
  progression: CampusProgression,
  param: string | null | undefined,
): CourseSlug {
  if (!param) return progression.courses[0].slug;
  const lower = param.toLowerCase();
  const match = progression.courses.find(
    (c) => c.slug === lower || c.aliases.includes(lower),
  );
  return match?.slug ?? progression.courses[0].slug;
}
