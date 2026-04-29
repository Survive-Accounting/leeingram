# Mobile UX overhaul — Practice Problem Helper (SolutionsViewerV2)

The screenshot is `src/pages/v2/SolutionsViewerV2.tsx`. The mobile state (`mobileTab: "problem" | "helper"`) already exists, but its toggle UI was removed — that's why the Guided Helper is currently unreachable on mobile. We'll bring it back as the primary mobile control, strip everything else off the top bar on mobile, and add a unified breadcrumb strip (mobile + desktop) styled like the retro terminal.

---

## 1. Top bar — mobile vs desktop

**Mobile (< 768px)** — keep ONLY:
- `Switch Problem` button (centered, primary)
- Hamburger / overflow menu on the right with: Share Feedback, Open in full screen
- "Built by Lee Ingram" attribution → moved to footer area only on mobile (too noisy up top)

**Desktop** — unchanged: Built by Lee | Switch Problem | Share Feedback.

The desktop view-mode toolbar (Problem / Split / Stacked / Helper / Reset / Fullscreen) stays as-is — already hidden on mobile via `hidden md:flex`. ✅

---

## 2. Mobile Problem ↔ Helper toggle (the main fix)

Re-introduce a stacked, two-button switcher right under the breadcrumbs on mobile. Replaces the deleted toggle at line 2960.

```text
┌───────────────────────────────────────────┐
│  [ 📄 Problem Instructions ]  ← active    │
│  [ 🧠 Guided Helper        ]              │
└───────────────────────────────────────────┘
```

Behavior:
- Tapping a button sets `mobileTab` to that pane.
- **Tapping the already-active button toggles it off** → shows the OTHER pane (i.e. "click twice to minimize" as requested). Implemented by: `if (mobileTab === clicked) setMobileTab(other)`.
- Buttons are full-width, stacked vertically, ~44px tall, using existing dark/red palette (`#14213D` bg, `#CE1126` accent for active state).
- Sticky directly under the breadcrumb strip so it's always reachable while scrolling long Helper output.

No more split / stacked / 4-mode toolbar on mobile — too complex on a 400px screen.

---

## 3. Retro breadcrumb strip (mobile + desktop)

New component placed between the top header and the main content. Styled to match the retro terminal (dark bg, neon green `#00FF66` text, monospace font, `>` prompt prefix).

```text
> home  /  ch 13 bonds  /  practice problem helper
   ^link    ^link            ^current (no link, dim phosphor)
```

Rules:
- Each crumb is a real `<Link>`.
- **home** → `/` (lands on the retro Study Console / landing).
- **ch 13 bonds** → chapter hub. Use `/cram/:chapterId` (Survive This Chapter) since that's the existing chapter landing per `docs/chapter-cram-tool.md`.
- **practice problem helper** → current page, rendered as dim phosphor text, not a link.
- Truncate middle crumbs on narrow screens; never wrap to two lines (use `truncate` with min-width `0`).
- Same component used on every study tool page (Practice Helper, Flashcards, Formula Recall, Entry Builder, Problem Dissector) so navigation feels consistent.

File: `src/components/study-previewer/RetroBreadcrumbs.tsx` (new). Props: `chapter?: { id, number, name }`, `toolName: string`.

---

## 4. Quick mobile wins (low-effort, high-impact)

1. **Larger tap targets**: the `←` / `→` problem nav buttons in the screenshot are tiny relative to the red `→`. Make both 44×44 minimum and equal weight.
2. **Sticky problem nav**: pin the `← 1 / 46 →` bar to the bottom of the viewport on mobile so users never scroll back up to advance.
3. **Reduce body font on mobile** from current ~18px to ~16px so problems with PV factor tables don't overflow horizontally.
4. **Remove the inner card border-radius double-stacking** on mobile (the current "card-inside-card" look in the screenshot wastes ~24px of horizontal space). Card sits flush to viewport edges with `mx-0 sm:mx-auto`.
5. **Hide "Built by Lee Ingram"** on mobile (move to bottom of page only) — the screenshot truncates it to "Built by Lee I…" anyway.
6. **Footer attribution** on mobile: small line `Built by Lee Ingram · surviveaccounting.com` once at bottom of page, links to dashboard.

---

## Files to edit

- `src/pages/v2/SolutionsViewerV2.tsx` — top bar conditional rendering, restore mobile toggle, integrate breadcrumbs, sticky bottom nav, font sizes, remove inner card padding on mobile.
- `src/components/study-previewer/RetroBreadcrumbs.tsx` — **new** shared breadcrumb component.
- `src/pages/StudyToolsFlashcards.tsx`, `StudyToolsFormulaRecall.tsx`, `StudyToolsEntryBuilder.tsx`, `StudyToolsProblemDissector.tsx` — drop the breadcrumb component at the top of each.

## Out of scope (per user instructions)

- No navbar/brand redesign.
- Don't touch the retro terminal landing visual style itself.
- No new onboarding copy.
- Desktop split-view toolbar stays exactly as-is.

---

## Open question

The breadcrumb middle crumb says "ch 13 bonds" — I'm planning to link it to **Survive This Chapter** (`/cram/:chapterId`). If you'd rather it go to a different chapter landing (e.g. a chapter index or the campus chapter page), tell me and I'll swap the target. Otherwise I'll proceed with `/cram/:chapterId`.
