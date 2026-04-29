## Two changes to the V2 Solutions Viewer header

### 1. Rename "Open in full screen" → "Open in new tab"

The button at `src/pages/v2/SolutionsViewerV2.tsx` lines 3086–3109 already does exactly the right thing — it calls `window.open(url, "_blank", "noopener,noreferrer")`, which opens the viewer in a fresh tab outside the iframe. The student then has the option to F11/maximize themselves, which gets them to true full screen.

Change just the labels:

- `aria-label="Open in full screen"` → `aria-label="Open in new tab"`
- `<TooltipContent>Open in full screen</TooltipContent>` → `Open in new tab`

No behavior change.

### 2. Collapse the desktop view-switcher row into the breadcrumb bar

**Today** the viewer renders three stacked horizontal strips between the header and the content:

```text
[ retro breadcrumb bar             ]
[ floating view-mode toolbar  →    ]   ← ~44px of empty real estate
[ problem | guided helper          ]
```

The middle strip is the source of the "too much space" complaint. We pull it into the breadcrumb bar so the layout becomes:

```text
[ retro breadcrumb …  /  ch 13  /  practice problem helper        👁 view ]
[ problem | guided helper                                                 ]
```

The view switcher only appears when the eye icon is clicked.

#### Implementation

**A. `src/components/study-previewer/RetroBreadcrumbs.tsx`** — add an optional `rightSlot?: React.ReactNode` prop. Render it on the right edge of the bar with `ml-auto` and `shrink-0`. Breadcrumbs keep their existing truncation behavior so a long chapter name yields to the right-slot button. No styling changes for callers that don't pass `rightSlot`.

**B. `src/pages/v2/SolutionsViewerV2.tsx`** — build a `ViewModeMenu` component (inline, same file) that wraps a shadcn `Popover`:

- **Trigger**: small phosphor-green Eye icon button styled to match the breadcrumb bar (12px font, mono, `rgba(57,255,122,0.55)` color, hover → solid green). Hidden on mobile (`hidden md:inline-flex`) — mobile already has its own Problem/Helper toggle.
- **Popover content** (anchored bottom-right of trigger, dark navy panel matching the existing toolbar):
  - Small label: "Change layout"
  - The same four layout buttons that exist today: Problem only / Split / Stacked / Helper only (icons + tooltip hints `[ \ - ]`)
  - Divider
  - "Reset split 50/50" button (disabled unless `viewMode === "split"`)
  - Divider
  - "Open in new tab" button (the renamed maximize action)
- Selecting a layout updates `viewMode` and **closes** the popover.
- Keyboard shortcuts (`[`, `\`, `-`, `]`) keep working unchanged — they're wired elsewhere.

Pass the trigger as `<RetroBreadcrumbs rightSlot={<ViewModeMenu …/>} />`.

**C. Delete the old toolbar row** at `SolutionsViewerV2.tsx` lines 3018–3112 (the `<div className="hidden md:flex justify-end mb-3">…`). Everything inside it now lives in the popover.

#### Why this UX

- **No extra vertical space** when the student isn't actively reconfiguring layout.
- **Discoverable**: the eye icon + "view" label + tooltip "Change layout" makes the affordance obvious without occupying real estate.
- **One trigger, one menu** — students no longer have to scan a row of 6 small icons to find the action they want; they open the menu, see labeled options, click one.
- **Mobile is unchanged** — it already uses the stacked Problem/Helper toggle, so the eye trigger stays hidden there.

#### Out of scope

- Mobile view-switcher behavior (already correct).
- The header above the breadcrumb bar — leaving it alone.
- The keyboard shortcut layer.

#### Open question

Want the eye trigger to also show a tiny text label ("view") next to the icon for first-time discoverability, or icon-only with tooltip? My default is **icon + "view" label** on desktop since the bar has plenty of room and it makes the feature self-explanatory; tell me if you want icon-only.
