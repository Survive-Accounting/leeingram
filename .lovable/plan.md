## Goal

Three small but consistent polish items across the study previewer + V2 viewer:

1. Add a persistent **top-left label** inside the retro CRT screen: `Accounting Study Tools (Spring '26 Beta)`.
2. Simplify the V2 viewer top-bar wordmark — replace the two-line "Survive Accounting · Beta / Built by Lee Ingram · Spring '26" with just `Spring '26 Beta`.
3. Rework the `BrandedLoader` so it looks like the **same retro CRT screen** (phosphor green on near-black, scanlines, monospace) and shows only Lee's circular headshot + `Built by Lee Ingram` + the spinner. Drop the "Survive Accounting" wordmark from the loader. Color-saturated (navy/red) UI only appears once the tool itself paints.

---

## Files to edit

### 1. `src/components/study-previewer/RetroTerminalFrame.tsx`

Add a small phosphor header label at the very top of the CRT terminal content (above the welcome line / course picker). Renders on every state — chapter not chosen, chapter chosen, tool active.

Insert just before the existing `{welcomeName && (...)}` block around line 381:

```tsx
<div
  style={{
    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
    color: PHOSPHOR_DIM,
    fontSize: "0.78em",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    marginBottom: "1.1em",
    textShadow: `0 0 4px ${PHOSPHOR_GLOW}`,
  }}
>
  Accounting Study Tools <span style={{ opacity: 0.7 }}>(Spring '26 Beta)</span>
</div>
```

This sits at the top-left of the green tube (matches the user's first screenshot).

### 2. `src/pages/v2/SolutionsViewerV2.tsx` (lines ~2872-2906)

Replace the two-line Brand wordmark block with a single compact `Spring '26 Beta` chip. Keeps the same `<Link to="/my-dashboard">` behavior so it still navigates back when clicked.

```tsx
<Link
  to="/my-dashboard"
  className="group inline-flex items-center min-w-0 max-w-full"
  data-embed-allow="true"
  aria-label="Spring '26 Beta — back to dashboard"
  title="Spring '26 Beta"
>
  <span
    className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors group-hover:text-white"
    style={{ color: "rgba(255,255,255,0.55)" }}
  >
    Spring '26 <span style={{ color: "#FF8A95" }}>Beta</span>
  </span>
</Link>
```

### 3. `src/components/study-previewer/BrandedLoader.tsx`

Rebuild as a CRT-themed loader. Keep the component API (`subtitle`, `surface`, `absolute`) but in practice we only use the dark surface now (the embedded white-screen iframe wrapper will pass `surface="navy"` so the loader keeps the dark/CRT feel until the colored UI paints).

Layout (top → bottom, centered):
- Lee's circular headshot (`@/assets/lee-headshot-original.png`), 56px, ringed in phosphor (matches the small headshot in `RetroTerminalFrame` lines 703-724).
- Phosphor dual-arc spinner (kept from current implementation, retuned to sit *around* the headshot as a thin orbit ring instead of being separate).
- Caption: `BUILT BY LEE INGRAM` in JetBrains Mono uppercase, phosphor-dim.
- Optional `subtitle` (e.g. "Loading problem…") in monospace below.
- Background: same radial dark-green gradient as the CRT screen (`#052810 → #03130A → #010904`).
- Add scanlines overlay + faint vignette so it reads as the same hardware.
- Remove the "Survive Accounting" `DM Serif Display` wordmark entirely.

Pseudostructure:

```tsx
<div role="status" style={{ background: CRT_RADIAL, fontFamily: MONO, color: PHOSPHOR }}>
  <ScanlinesOverlay />
  <Vignette />
  <div className="relative" style={{ width: 96, height: 96 }}>
    <SpinnerArcs />          {/* orbits the headshot */}
    <HeadshotCircle src={leeHeadshot} className="absolute inset-2 rounded-full" />
  </div>
  <div className="mt-4 text-[10px] tracking-[0.18em] uppercase">Built by Lee Ingram</div>
  {subtitle && <div className="mt-3 text-[11px] opacity-70">{subtitle}</div>}
</div>
```

The `surface="white"` branch can stay for safety (used by `EntryBuilderTool.tsx`) but should also drop the wordmark — only headshot + spinner + "Built by Lee Ingram" + subtitle. We will keep both surfaces but route the previewer's overlay loader to `surface="navy"` so it visually continues the CRT.

No call-site changes are required in `StudyPreviewer.tsx` or `EntryBuilderTool.tsx` — the prop API stays the same.

---

## Visual outcome

- **Home screen (retro):** top-left of the CRT now reads `ACCOUNTING STUDY TOOLS (SPRING '26 BETA)` in dim phosphor monospace.
- **Loading state when launching a tool:** screen looks like the same green CRT — Lee's headshot in the center with the spinner orbiting it and `BUILT BY LEE INGRAM` underneath. No "Survive Accounting" wordmark, no navy/red.
- **Tool loaded (V2 viewer):** top-left now just shows a compact `SPRING '26 BETA` chip instead of the two-line wordmark, matching the user's request to declutter.

No data, route, or behavior changes — purely presentational.
