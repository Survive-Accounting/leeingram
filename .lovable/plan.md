# Add RetroBreadcrumbs above the terminal screen on `/my-dashboard`

The breadcrumbs already exist (`src/components/study-previewer/RetroBreadcrumbs.tsx`) and are wired into the v2 SolutionsViewer. Now they need to also appear **above the terminal screen on `/my-dashboard`** (the StudentDashboard page), reflecting the user's current chapter pick + active study tool.

Scope: v2 only. We will NOT touch:
- The v1 `/cram` route
- The landing page demo terminal (`StagingLandingPage` + `LandingStudyPreviewerSection`)
- The standalone Journal Entry Helper screen (it's just a placeholder INSIDE the terminal — the breadcrumb above the frame already covers it once the user picks "Journal Entry Helper")

---

## How the breadcrumb behaves on `/my-dashboard`

Renders directly above the terminal frame, full-width within the same content column.

| State | Breadcrumb |
|---|---|
| No chapter picked | `> home` (current page, no link) |
| Chapter picked, no tool open | `> home / ch 13 bonds` |
| Chapter + Practice Helper open | `> home / ch 13 bonds / practice problem helper` |
| Chapter + JE Helper open | `> home / ch 13 bonds / journal entry helper` |

Clicking `home` reloads the dashboard (clears chapter + tool, scrolls to top — same behavior as the existing reset signal). Clicking the chapter crumb closes the active tool but keeps the chapter selected (drops user back to the tool-pick state inside the terminal).

---

## Implementation

### 1. `src/components/study-previewer/StudyPreviewer.tsx`
Add two optional props so the parent (StudentDashboard) can read state and drive the breadcrumb:

```ts
onSelectionChange?: (state: {
  chapter: PreviewChapter | null;
  activeTool: ToolKey | null;
}) => void;

/** External signal to clear the active tool only (chapter stays). */
closeToolSignal?: number;
```

- `useEffect` fires `onSelectionChange({ chapter: selectedChapter, activeTool })` whenever `selectedChapterId` or `activeTool` changes.
- `useEffect` watching `closeToolSignal` runs `setActiveTool(null)` (mirrors existing `resetSignal` pattern but tool-only).

### 2. `src/pages/StudentDashboard.tsx`
- Add local state: `previewerState` (`{ chapter, activeTool }`) and `closeToolSignal` (number).
- Render `<RetroBreadcrumbs />` directly above `<StudyPreviewer />`, inside the same wrapper (after the headline block, before the previewer):
  ```tsx
  <RetroBreadcrumbs crumbs={crumbs} />
  <StudyPreviewer ... onSelectionChange={setPreviewerState} closeToolSignal={closeToolSignal} />
  ```
- Build `crumbs` from `previewerState`:
  - Always include `{ label: "home", to: previewerState.chapter || activeTool ? <click handler resets> : undefined }`
  - If chapter present, include `{ label: "ch N name", onClick: () => setCloseToolSignal(n => n+1) }`
  - If tool present, include `{ label: TOOL_LABEL[activeTool] }` as current crumb
- Reuse the existing `resetSignal` pattern already in the file (or add one) so clicking `home` resets chapter + tool.

### 3. `src/components/study-previewer/RetroBreadcrumbs.tsx`
Extend the `BreadcrumbCrumb` type to support `onClick` in addition to `to` (link), since the chapter crumb is in-page state, not a route change:
```ts
export type BreadcrumbCrumb = {
  label: string;
  to?: string;       // route link
  onClick?: () => void; // in-page action (rendered as <button>)
};
```
Render rule: `to` → `<Link>`, `onClick` → `<button>`, neither → plain `<span>` (current crumb).

---

## Files touched

- `src/components/study-previewer/RetroBreadcrumbs.tsx` — add `onClick` support.
- `src/components/study-previewer/StudyPreviewer.tsx` — add `onSelectionChange` + `closeToolSignal` props, emit + consume.
- `src/pages/StudentDashboard.tsx` — render `<RetroBreadcrumbs>` above `<StudyPreviewer>`, wire state.

No changes to landing demo, no changes to v1 cram, no changes to the JE Helper placeholder screen itself.
