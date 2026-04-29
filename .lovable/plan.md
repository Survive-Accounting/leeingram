# Guided Helper — Reorder + AI icon with tooltip

Two small, scoped tweaks inside the right-column "Guided Helper" panel in `src/pages/v2/SolutionsViewerV2.tsx`.

## 1. Move "Help responses" above "Try new beta tools"

Today the panel renders in this order:

```text
[ Header: Guided Helper · Beta ]
[ Walk me through it (red CTA) ]
[ Full solution (secondary CTA) ]
[ BetaToolsDisclosure — "Try new beta tools" ]
[ Response window — "Help responses appear here" ]
```

Change the order so the response window sits directly under the two primary CTAs and the Beta Lab disclosure drops to the bottom of the panel:

```text
[ Header: Guided Helper · Beta ]
[ Walk me through it (red CTA) ]
[ Full solution (secondary CTA) ]
[ Response window — "Help responses appear here" ]
[ BetaToolsDisclosure — "Try new beta tools" ]
```

Implementation: in the JSX block around lines 1979–2037, render the response window (`<div className="relative px-4 py-4 flex-1 ...">` block, currently ~lines 2055–end of response area) before `<BetaToolsDisclosure />`. The "Try new beta tools" disclosure becomes the last item in the panel.

No styling changes — keep the existing radial gradient, dot-matrix texture, blinking cursor empty state, and the response container's `flex-1 min-h-[200px]` so it still fills available space.

## 2. Add AI icon + tooltip on "Guided Helper" header

In the header row (~lines 1957–1977), prepend an AI-style icon to the left of the "Guided Helper" label and wrap the icon+label in a tooltip.

- Icon: `Sparkles` from lucide-react (already imported), 14px, brand-red tint (`rgba(206,17,38,0.85)`) to match the existing accent.
- Tooltip uses the existing shadcn `Tooltip` / `TooltipProvider` / `TooltipContent` components (already imported at line 5).
- Tooltip copy: **"All help buttons are AI-assisted and designed to mimic Lee's real tutoring sessions."**
- Trigger area: the icon + "Guided Helper" text (cursor: help). The "Beta" badge stays as-is, outside the tooltip trigger.

## Files touched

- `src/pages/v2/SolutionsViewerV2.tsx` — header markup + JSX reorder inside the Guided Helper panel only. No logic, state, or API changes.

## Out of scope

- No copy changes to the CTAs or Beta Lab disclosure.
- No layout changes to the left column (problem text).
- No new dependencies.
