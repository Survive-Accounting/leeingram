# Global Course Label Rule

## The rule (one source of truth)

Whenever we display a course name to a student anywhere in the app:

1. If we know the user's campus AND it's NOT "Catch-All University" (slug `general`) AND that campus has a `local_course_code` for the course → show **`local_course_code`** (e.g. `ACCY 201`).
2. Otherwise → show **`courses.course_name`** (e.g. `Intro Accounting 1`).

Never combine "code · long name" anymore. Code alone, or name alone.

## Step 1 — Create shared helper

New file: `src/lib/courseLabel.ts`

```ts
export const CATCH_ALL_CAMPUS_SLUG = "general";

export interface CourseLabelInput {
  courseName: string | null | undefined;     // courses.course_name
  campusSlug?: string | null;                // user's resolved campus slug
  localCourseCode?: string | null;           // campus_courses.local_course_code for this user's campus + course
}

export function getCourseLabel(input: CourseLabelInput): string {
  const { courseName, campusSlug, localCourseCode } = input;
  const code = (localCourseCode || "").trim();
  const knowsCampus = !!campusSlug && campusSlug.toLowerCase() !== CATCH_ALL_CAMPUS_SLUG;
  if (knowsCampus && code) return code;
  return (courseName || "").trim();
}
```

This is the only function any component should call to render a course label.

## Step 2 — Get campus context where needed

Most call sites already have `useAccessControl` / purchase context returning the user's campus slug. For surfaces that load chapter+course via Supabase, we'll add a join to fetch `local_course_code` for the active campus when one is known:

```ts
// when loading chapter/course for a logged-in or campus-resolved student:
const { data: cc } = await supabase
  .from("campus_courses")
  .select("local_course_code")
  .eq("course_id", courseId)
  .eq("campus_id", activeCampusId)
  .maybeSingle();
```

We'll cache this on the chapter/course object passed to children (e.g. extend `ChapterMeta` with `localCourseCode?: string | null`).

## Step 3 — Replace existing label logic

Delete the local `getCourseLabel` + `FRIENDLY_COURSE_NAMES` map in `src/pages/v2/SolutionsViewerV2.tsx` and import the shared helper. Same for any other file currently formatting "code · name" strings:

- `src/pages/v2/SolutionsViewerV2.tsx` (header pill, Jump dialog title, share/PDF metadata)
- `src/lib/campusProgressions.ts` `formatCourseLabel` (update to follow same rule — code-only when present)
- Any campus landing / dashboard / chapter page that today renders "ACCY 201 — Intro Accounting 1" or "INTRO1 · Intro Accounting 1"

After this pass, "Jump anywhere in [course]" reads:
- Ole Miss student → "Jump anywhere in ACCY 201"
- Catch-All / unknown campus → "Jump anywhere in Intro Accounting 1"

## Step 4 — Remove now-unused code paths

- `FRIENDLY_COURSE_NAMES` map in SolutionsViewerV2 (the `INTRO1 → Intro Accounting 1` lookup) is dead once we rely on `courses.course_name` directly. Delete it.
- Any "code · name" string concatenation across the app.

## Out of scope

- No DB migration. `campus_courses.local_course_code` already exists.
- No change to admin/staff views — they keep showing internal slugs for clarity.

## Files touched

- **new** `src/lib/courseLabel.ts`
- `src/pages/v2/SolutionsViewerV2.tsx`
- `src/lib/campusProgressions.ts`
- Any other student-facing component currently formatting course names (will sweep with `rg` during build)
