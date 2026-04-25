# Redesign Landing Demo Section

Refactor `src/components/landing/StagingCoursesSection.tsx` so the demo feels like a real product preview, not a file picker.

## 1. New Layout (top → bottom)

1. **Section heading** (keep existing copy: "Built for how students actually study" / "Pick a problem. Get a quick explanation when you're stuck.")
2. **Course tab row** — the existing 4 pills, kept centered above the laptop:
   `[ Intro 1 ] [ Intro 2 ] [ Intermediate 1 ] [ Intermediate 2 ]`
3. **Chapter chip row** — secondary horizontal scroll row of `Ch. 1 · Ch. 2 · …` chips (active chip = navy filled). Lives directly under the course tabs, still **outside** the laptop. Default to Ch. 1 of the active course.
4. **Laptop** — significantly larger (max-width ~1100px, ~65% of section width on desktop, full width on mobile). Centered with no side nav card.

Remove the entire left `NavigationCard` column and the empty "Pick a problem to preview" state.

## 2. Inside the Laptop

Two-column screen layout (`grid-cols-2` on screen ≥ md, stacked on mobile):

**Left pane — Problem**
- Top strip: red `source_ref` badge + problem title.
- `survive_problem_text`.
- "Required" list of `instruction_1..5`.
- Subtle scroll if overflows.

**Right pane — Explanation panel**
- Initial state: a clean centered card with:
  - small label "Stuck?"
  - headline "Get a guided walkthrough"
  - **Primary CTA button (red gradient, soft shadow, slightly rounded):**
    `Show me how to think through this →`
- After click: the button fades out and the explanation content fades/slides in (use existing `demoFadeUp` keyframe). Content = first ~6 lines of `survive_solution_text`, followed by a muted "Open full solution →" link to `/solutions/:asset_name`.
- Use local `revealed` state (resets when problem changes).

## 3. Auto-Pick a Real Example Problem

To avoid an empty/placeholder feel, when the active course + active chapter change, auto-load the **first BE/QS problem** of that chapter (using the existing `sectionsFor` first prefix group) and select it as `selectedProblem`. No user action required to see content.

Reuse the existing chapter fetch + items fetch + detail fetch effects — just simplify so they always target chapter 1 (or the chip-selected chapter) and the first section.

## 4. Interaction & Animation

- Course tab change → swap chapter chips, auto-select Ch. 1, auto-load first problem. No reload, content cross-fades via `demoFadeUp`.
- Chapter chip change → auto-load first problem of that chapter, cross-fade.
- Explain CTA click → reveal explanation with `demoFadeUp`.
- Keep `prefers-reduced-motion` guard.

## 5. Visual Polish

- Laptop: keep current MacBook-style lid/bezel/hinge but scale up — `maxWidth: 1100`, screen `minHeight: 460`, `aspectRatio: 16 / 10`.
- Right-pane CTA button:
  - background: `linear-gradient(135deg, #CE1126 0%, #A30D1F 100%)`
  - text: white, 14px semibold
  - padding: `12px 22px`, `border-radius: 10px`
  - shadow: `0 8px 20px -6px rgba(206,17,38,0.45)`
  - hover: brightness 1.05 + translateY(-1px).
- Right-pane background: very soft navy/blue tint (`#F8FAFF`) to differentiate from problem pane.

## 6. Removed / Cleaned Up

- `NavigationCard` component and all its props (delete entirely).
- Empty state ("Pick a problem to preview").
- `pendingAutoSelect` plumbing (no longer needed since we auto-select).
- The `Unlock full solution` amber pill inside the screen (replaced by the new red CTA + post-reveal "Open full solution" link).

## Files Changed

- `src/components/landing/StagingCoursesSection.tsx` — full restructure of JSX + state; remove `NavigationCard`; rewrite `LaptopViewer` / `ViewerContent` for two-pane layout with reveal interaction; add chapter chip row.

No DB or schema changes. No new dependencies.
