/**
 * Global course-label rule.
 *
 * - If we know the user's campus AND it isn't the Catch-All campus AND that
 *   campus has a `local_course_code` for this course → show the code alone
 *   (e.g. "ACCY 201").
 * - Otherwise → show `courses.course_name` alone (e.g. "Intro Accounting 1").
 *
 * Never combine "code · long name". Code alone, or name alone.
 */

export const CATCH_ALL_CAMPUS_SLUG = "general";

export interface CourseLabelInput {
  /** courses.course_name */
  courseName: string | null | undefined;
  /** Active user's resolved campus slug (e.g. "ole-miss"). */
  campusSlug?: string | null;
  /** campus_courses.local_course_code for the active campus + course pair. */
  localCourseCode?: string | null;
}

export function getCourseLabel(input: CourseLabelInput): string {
  const code = (input.localCourseCode || "").trim();
  const slug = (input.campusSlug || "").toLowerCase();
  const knowsCampus = !!slug && slug !== CATCH_ALL_CAMPUS_SLUG;
  if (knowsCampus && code) return code;
  return (input.courseName || "").trim();
}
