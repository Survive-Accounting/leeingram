## Four changes to the V2 viewer + previewer experience

### 1. Bring back the "Survive Accounting Beta · Spring '26" brand line

Add a small wordmark to the V2 viewer's sticky top bar in `src/pages/v2/SolutionsViewerV2.tsx` (around line 2856–2878, the LEFT cell that currently holds "Built by Lee Ingram"). Two-line stacked layout in the same cell:

```text
Survive Accounting · Beta              ← display font, white 80%
Built by Lee Ingram · Spring '26       ← inter, white 45%
```

- Display line uses `'DM Serif Display'`, 13px, `rgba(255,255,255,0.85)`
- Sub-line keeps the existing "Built by Lee Ingram" link styling (12px, dim white) and appends "· Spring '26"
- Stays a clickable link to `/my-dashboard`
- Hidden on mobile (matches current `hidden sm:flex`) — mobile already hides this cell to keep the Switch Problem button centered

This restores the brand identity without occupying any new vertical space.

### 2. Shorten breadcrumb chapter crumb to "ch #" only

In `SolutionsViewerV2.tsx` around line 2941–2945 the chapter crumb is currently:

```tsx
label: `ch ${chapter.chapter_number} ${chapter.chapter_name}`,
```

Change to:

```tsx
label: `ch ${chapter.chapter_number}`,
```

Result on mobile and desktop:

```text
> home  /  ch 13  /  practice problem helper        👁 view
```

Much less horizontal pressure on small screens. The full chapter name is still visible in the Switch Problem button's `title` attribute and via the chapter tooltip.

### 3. Make breadcrumb home/chapter actually return to the previewer "home"

Today the V2 viewer renders inside an iframe on both `/` (landing demo) and `/my-dashboard`. The breadcrumb crumbs use plain `to` links, so clicking them navigates **inside the iframe** to `/` or `/cram/:chapterId` — neither of which lands the student back on the retro terminal "Choose your course / Choose your chapter" screen.

Use the existing `postMessage` channel (already wired for `sa-embed-paywall` at lines 1577 and 2439) to bubble navigation intent up to the parent.

**A. In `SolutionsViewerV2.tsx`** — replace the two crumb objects with `onClick` handlers that detect iframe context and post messages, falling back to direct navigation when standalone:

```tsx
const inIframe = typeof window !== "undefined" && window.top !== window.self;

const goHome = () => {
  if (inIframe) {
    window.parent?.postMessage({ type: "sa-viewer-go-home" }, "*");
  } else {
    navigate("/");
  }
};

const goChapter = () => {
  if (inIframe) {
    window.parent?.postMessage({ type: "sa-viewer-go-chapter" }, "*");
  } else if (chapter) {
    navigate(`/cram/${chapter.id}`);
  }
};
```

Crumbs become:

```tsx
{ label: "home", onClick: goHome },
{ label: `ch ${chapter.chapter_number}`, onClick: goChapter },
{ label: "practice problem helper" },
```

(`RetroBreadcrumbs` already supports both `to` and `onClick`.)

**B. In `src/components/study-previewer/StudyPreviewer.tsx`** — add a parent-side listener that handles those two messages:

- `sa-viewer-go-home` → call the existing reset path: `setActiveTool(null); setSelectedChapterId(null); setViewerAssetCode(null);` and clear `persistChapterKey` from localStorage. This lands on the bare "Choose course / Choose chapter" terminal.
- `sa-viewer-go-chapter` → only reset the active tool (`setActiveTool(null)`), keeping the chapter selected. This lands on the tool-selection state for the same chapter (Practice / JE Helper / Help shape what's next).

Course selection is already persisted, so the prefilled-course requirement is satisfied automatically — we just don't touch `selectedCourseId`.

**C. Listener cleanup** — register inside a `useEffect` with `window.addEventListener("message", …)` and a cleanup that removes it. Validate `event.data?.type` before acting.

This gives students two redundant paths home (Switch Problem button + breadcrumb) without ever leaving the parent page.

### 4. Better loading screen — "Built by Lee Ingram" branded spinner

Today, three loading states overlap awkwardly inside the laptop chassis:

- The previewer iframe wrapper shows a white skeleton with placeholder bars.
- The V2 viewer (or Entry Builder tool) renders its own dark loading screen with raw text like "Loading Entry Builder…".
- A "Preparing tool…" status floats at the bottom after 2s.

Build one shared component `src/components/study-previewer/BrandedLoader.tsx` and use it in three places.

**Component design:**
- Centered in the available area, dark navy background (`#0F1A2E`) so it looks intentional whether the iframe has painted yet or not
- Wordmark: "Survive Accounting" in DM Serif Display (24px, white 90%)
- Sub-line: "Built by Lee Ingram" in Inter (11px, white 45%, letter-spacing 0.1em uppercase)
- Spinner: a custom phosphor-green ring rotating around the wordmark — uses two concentric SVG arcs, the outer arc rotating at 1.4s, the inner arc counter-rotating at 2.2s. Color matches the existing terminal phosphor `#39FF7A` with a subtle glow filter. Fades in over 200ms so quick loads don't flash.
- Optional `subtitle` prop for context like "Loading Entry Builder…" or "Preparing tool…"

**Wire into:**
1. `StudyPreviewer.tsx` — replace the white-bar skeleton block (lines ~718–731 for Practice and ~798–814 for JE) with `<BrandedLoader subtitle="Preparing tool…" />`. Drop the now-unused `showSkeleton` / `showSlowStatus` text — the loader is its own polished default and doesn't need a separate "slow" variant. Keep the 12s timeout that flips to `iframeError`.
2. `EntryBuilderTool.tsx` — replace the line-213 `<div className="text-white/60 text-sm animate-pulse">Loading Entry Builder...</div>` with `<BrandedLoader subtitle="Loading Entry Builder…" />` so the embedded view matches.
3. `SolutionsViewerV2.tsx` — at the top-level `loading` block (~lines 2956–2964) currently rendering generic shadcn `<Skeleton>` strips, swap in `<BrandedLoader subtitle="Loading problem…" />`. (Keep skeletons elsewhere if any cell-level loading remains.)

This removes the duplicated raw "Loading…" text, eliminates the white-flash skeleton, and gives every loading state the same branded identity. Image 3's "two stacked Admin Tools badges" is the Lovable Visual Edit overlay — not real UI — so it'll disappear in the published build regardless.

### Out of scope

- Mobile viewer header (already minimal — Switch Problem stays centered).
- The keyboard shortcut layer for view modes.
- Changing the V1 standalone `/tools/entry-builder` page outside the embed.
- Course-prefill UI for the home reset — already handled by existing `selectedCourseId` persistence in the parent components; no extra work needed.

### Open question

For the spinner, do you want **phosphor green** (matches the retro terminal aesthetic the previewer already uses) or **brand red `#CE1126`** (matches the rest of the V2 viewer chrome)? My default is phosphor green because the loader is most visible inside the laptop chassis where the breadcrumb bar is already green — it'll feel like one cohesive system. Tell me if you'd rather it be red.
