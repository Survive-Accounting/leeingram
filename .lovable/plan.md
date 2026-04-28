# Solutions Viewer polish — Explore panel, problem text, Navigate

Four focused fixes in `src/pages/v2/SolutionsViewerV2.tsx` and one component update in `src/components/v2/SurviveExplorePanel.tsx`.

## 1. "Suggest your own idea" → 8th dashed card

In `SurviveExplorePanel.tsx`, move the suggest link out from below the grid and into the grid as the final card.

- Render it as the 8th cell in the same `grid-cols-1 sm:grid-cols-2 gap-2` grid (after the 7 EXPLORE_KEYS).
- Style: dashed border (`border-dashed`), muted text, sparkle/plus icon, same height (`h-9`), hover state that brightens border to primary. Keep the existing inline-textarea expansion behavior — when clicked, the card itself swaps in-place to the textarea + Send/Cancel row (spans both columns via `sm:col-span-2` while open).
- Copy stays "+ suggest your own idea".

## 2. Fix unreadable Problem text on dark navy panel

Root cause: the navy problem block sets `color: rgba(255,255,255,0.95)` inline, but `SmartTextRenderer` outputs children wrapped in `text-foreground` (dark) which wins over the inherited inline color.

Fix in `SolutionsViewerV2.tsx` around line 1693–1709:

- Wrap `<SmartTextRenderer>` in a div with class `[&_*]:!text-white/95` (and matching tweaks for `[&_strong]:!text-white`, `[&_th]:!text-white`, `[&_td]:!text-white/90`) so all rendered descendants are forced light on the navy background.
- Also force the highlighted key terms (currently `text-primary` red) to a softer light accent on dark: add `[&_.font-semibold]:!text-amber-300` (or keep red but bump opacity) — to be confirmed visually after the white fix.

This is scoped only to the problem-text container, so other usages of `SmartTextRenderer` on light backgrounds are unaffected.

## 3. Supercharge the "Navigate" button

Goal: turn the small icon-only button into a marketing-forward control that advertises scope.

Changes to the header CTA at line ~1579–1593:

- Replace text "Navigate" with a two-line stack:
  - Line 1 (small, uppercase, muted): the course name (e.g. `INTRO ACCOUNTING 1`)
  - Line 2 (semibold, white): `Jump anywhere in the course`
- Keep the menu icon on the left, add a small chevron-down on the right.
- Increase height to `h-11`, add subtle red accent on hover (`hover:border-[#CE1126]/40`).
- On mobile, collapse back to icon + "Jump" label.

Course name is already available via `getCourseLabel(chapter?.course)` (used at line 1874 for the explore panel).

## 4. Navigate panel — dropdown chapter selector + problem count headline

In `NavigatePanel` (lines 977–1198):

- Replace the horizontal chip strip of chapters with a single `<Select>` dropdown:
  - Trigger shows: `Ch {n} — {chapter_name}` for current selection.
  - Items list all chapters in order; current asset's chapter gets a small red dot.
- Update header copy:
  - DialogTitle: `Jump anywhere in the course`
  - DialogDescription: `{TOTAL}+ practice problems ready for you to cram — pick a chapter, type, and problem.`
  - Compute TOTAL on panel open via a single `select count` query against `teaching_assets` filtered by `course_id` (cached in component state). Round down to nearest 50 and append `+`.
- Add a one-line summary above the problem grid: `{visibleItems.length} {category label} in Ch {n}` to reduce visual noise.
- Drop the redundant "Type" label — let the three pill buttons speak for themselves.

## 5. General clutter reduction in viewer header

- Remove the standalone "Navigate" word duplication now that the new button carries the course name.
- Keep Share button as-is.

## Technical notes

- Files touched:
  - `src/pages/v2/SolutionsViewerV2.tsx` — header CTA, problem-text wrapper class, NavigatePanel rewrite (dropdown + count query + copy).
  - `src/components/v2/SurviveExplorePanel.tsx` — move suggest into grid as dashed 8th card with in-place expansion.
- New query: a single `supabase.from('teaching_assets').select('id', { count: 'exact', head: true }).eq('course_id', courseId).eq('status','approved')` inside NavigatePanel, run once when `open && courseId` first match.
- No DB migrations, no new dependencies.
- shadcn `Select` already in use elsewhere in the project.

## Out of scope

- No changes to Challenge button, vote logic, or paywall flow.
- No changes to the Explanation/Solutions content rendering or right-column accordions.
