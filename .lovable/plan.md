# Resizable Split-View Controls — Solutions Viewer V2

## What this changes

Add a subtle floating control bar + draggable divider to the **problem viewer page** (`/v2/solutions/:assetCode` — `src/pages/v2/SolutionsViewerV2.tsx`). This is the page rendered inside the iframe in the screenshot — left = Problem + Your Tasks, right = Walk me through / Hint / Setup / Full solution / Challenge me / Vote.

Today that layout is a fixed `grid lg:grid-cols-2 gap-6`. We'll replace that with a controlled split so users can:

- Drag a vertical divider to resize left vs right
- Snap to one of three modes via icon-only toolbar: **Problem only · Split · Helper only**
- Reset to 50/50 with a fourth icon (and via double-clicking the divider)
- On mobile, swap the split for a simple **Problem / Helper** tab toggle

Nothing else on the page changes — same problem card, same `InlineExplanation` + `SurviveExplorePanel`, same sticky bottom nav.

## Desktop UX

```text
┌── max-w-6xl main ───────────────────────────────────────────┐
│  ┌─ floating control bar (top-right, sticky-ish) ───┐      │
│  │  [▮▯ Problem]  [▮▮ Split]  [▯▮ Helper]  │ [↺]    │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌────── Problem (resizable) ──┃─── Helper (resizable) ──┐ │
│  │  Course chip · Ch chip       ┃   Walk me through it    │ │
│  │  Problem text                ┃   Hint  /  Setup        │ │
│  │  Your Tasks                  ┃   Full solution         │ │
│  │                              ┃   Challenge me          │ │
│  │                              ┃   Vote on new ideas     │ │
│  └──────────────────────────────┴──────────────────────────┘│
│                                  ↑ draggable divider         │
└─────────────────────────────────────────────────────────────┘
```

- Default split: 50/50
- Min widths: each panel ≥ 320px (the helper buttons + the problem card both need this)
- Drag handle: 8px hit-target with a 1px visible rule, `GripVertical` icon centered, `cursor-col-resize`, hover/active states tinted with brand red
- Double-click the handle → reset to 50/50
- Last drag ratio persists for the session via `sessionStorage` (key per asset is overkill — one global key `sa.viewer.splitRatio` is enough)

## View-mode toolbar

A small pill, top-right of the main area, sits just above the cards. Icons only, with `Tooltip` from shadcn and `aria-label` on each button:

- `PanelLeftClose` → **Problem only** (helper hidden, problem 100%)
- `Columns2` → **Split view** (restores last custom ratio, fallback 50/50)
- `PanelRightClose` → **Helper only** (problem hidden, helper 100%)
- `RotateCcw` → **Reset split** (forces 50/50, only enabled in Split mode; subtle/secondary)

Active mode = filled navy background `#14213D` + white icon. Inactive = transparent + `text-muted-foreground`, hover lifts to `bg-white/5`. Keep total height ~36px so it doesn't dominate.

Keyboard: `[`, `]`, `\` shortcuts (problem-only / split / helper-only) — nice-to-have, included.

## Mobile UX (< `lg` breakpoint)

No drag, no split. Replace the toolbar with a 2-segment toggle pinned at the top of the cards:

```text
┌──────────────────────────────┐
│  [ Problem ] [ Helper ]      │   ← segmented control
└──────────────────────────────┘
```

- Default: **Problem** selected
- Tap to switch — only the active panel renders
- Sticky bottom problem-nav (Previous / N of M / Next) stays unchanged

## Technical changes

**Single file edit:** `src/pages/v2/SolutionsViewerV2.tsx`

1. **State**
   ```ts
   type ViewMode = "split" | "problem" | "helper";
   const [viewMode, setViewMode] = useState<ViewMode>("split");
   const [splitRatio, setSplitRatio] = useState<number>(() => {
     const v = Number(sessionStorage.getItem("sa.viewer.splitRatio"));
     return v >= 0.25 && v <= 0.75 ? v : 0.5;
   });
   const isMobile = useIsMobile(); // existing hook
   const [mobileTab, setMobileTab] = useState<"problem" | "helper">("problem");
   ```

2. **Replace the wrapper** at line ~1774
   - Desktop: container becomes `relative flex` with two children sized via inline `style={{ flexBasis: \`${ratio*100}%\` }}` (and `flexBasis: 100%` when in problem-only / helper-only modes), each with `minWidth: 320`.
   - The drag handle is a sibling `<div>` between them with mouse + touch handlers.
   - Mobile: render just one branch based on `mobileTab`.

3. **Drag logic** — inline, no new dep needed
   - `onMouseDown` / `onTouchStart` on the handle captures pointer, attaches `mousemove` / `mouseup` listeners to `window`, computes `(clientX - container.left) / container.width`, clamps to `[0.25, 0.75]`, calls `setSplitRatio` and writes to `sessionStorage` on release.
   - `onDoubleClick` → `setSplitRatio(0.5)`.
   - Use `useRef` for the container to read its bounding rect; add `userSelect: 'none'` + `cursor: 'col-resize'` on `<body>` while dragging via a small effect.
   - No external lib (avoids `react-resizable-panels` since the file is already heavy and we only need one divider).

4. **Toolbar**
   - New small component inside the file, `ViewModeToolbar`, rendered just above the split (still inside `<main>`, after the `notFound` check). Hidden on mobile.
   - Uses the existing `Tooltip`/`TooltipProvider` from shadcn (already imported elsewhere — verify; if not, add the standard import).
   - Reset button is greyed out unless `viewMode === "split"`.

5. **Mobile segmented control**
   - Renders only on `< lg` (use `useIsMobile` or a CSS-only `lg:hidden` wrapper). Two buttons, equal width, navy fill on active.

6. **Behavioral guards**
   - When `viewMode === "problem"`, don't render the helper subtree at all (saves the `SurviveExplorePanel` re-mount cost on toggle? — actually, re-mounting `InlineExplanation` would lose its internal state. **Mitigation:** keep both panels mounted and use `display: none` + `aria-hidden` for the hidden one. This preserves prefetched walkthrough content and simplified text.)
   - The right panel keeps `lg:sticky lg:top-20` only when in split mode; in helper-only mode it should be a normal block (sticky on a 100%-wide column looks odd).

## Out of scope

- No persistence across sessions (session-only is enough; the user explicitly said "preserve … during the session if possible")
- No changes to `StudyPreviewer.tsx` or any other page — this lives entirely on the v2 viewer that the iframe loads
- No changes to copy, no new content, no new modals

## QA checklist before shipping

- Drag clamps at 25% / 75%; no overlap with course chip or buttons
- Double-click resets cleanly
- Switching modes doesn't lose: simplified text state, prefetched walkthrough, checked tasks
- Mobile tab toggle defaults to Problem and switches without scroll jump
- Sticky bottom nav still works; floating "Stuck? Ask Lee" still works
- Toolbar invisible on `< lg`; tab toggle invisible on `≥ lg`
- Tooltips appear on hover; `aria-label`s present on every icon button
