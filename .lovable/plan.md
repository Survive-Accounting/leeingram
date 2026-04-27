# Live Preview Polish — 3 Updates

## 1. Move "Live Preview · Free Beta" badge to top-center

In `src/components/landing/StagingCoursesSection.tsx` (`ScreenContent`), the red badge is currently `absolute left-3 bottom-3`, which overlaps the V2 viewer's "Previous" pagination button.

Move it to top-center: `absolute top-3 left-1/2 -translate-x-1/2`. Keep the same red pill styling, click behavior, and z-index so it still triggers the paywall when clicked.

## 2. Admin bypass — full preview on home page

Add admin-aware behavior so logged-in admins (Lee, etc.) can fully interact with the embedded V2 viewer instead of hitting the beta paywall.

- Import `useIsStaff` from `@/hooks/useIsStaff` in `StagingCoursesSection.tsx`
- When `isStaff === true`:
  - Load the iframe **without** `?embed=1` (so click-interception is disabled in the viewer)
  - Skip the `sa-embed-paywall` postMessage handler / never open `BetaPaywallModal`
  - Replace the red "Live Preview · Free Beta" badge with a subtle slate "Admin Preview" badge (still navigates nowhere; just a label so you know which mode you're in)
- Pass `isStaff` down through `LaptopViewer` → `ScreenContent` so the iframe `src` and badge both react to it

This uses the same `useIsStaff` hook already used elsewhere (whitelisted emails + va_accounts row), so no new auth logic needed.

## 3. Branded loading screen

Currently the loading state is a tiny gray spinner on white with "Loading problem..." / "Loading preview...". Replace it with a clean, branded card matching the hero section.

New loading screen (used for both initial load and iframe swap):

```text
┌──────────────────────────────────────────┐
│                                          │
│         [ navy → red gradient bg ]       │
│                                          │
│           ◯  ← Lee headshot (72px)       │
│              white ring + soft shadow    │
│                                          │
│    Survive Accounting                    │
│    DM Serif Display, white               │
│                                          │
│    Loading your preview…                 │
│    Inter, 13px, white/70                 │
│                                          │
│         · · ·  (subtle pulse dots)       │
│                                          │
└──────────────────────────────────────────┘
```

Specifics:
- Background: `linear-gradient(135deg, #14213D 0%, #1a2d5a 50%, #CE1126 140%)` (same family as hero)
- Headshot: round, 72px, 2px white border, soft shadow, gentle float animation
- Wordmark: "Survive" in red `#CE1126` weight 800, "Accounting" in white weight 400, DM Serif Display 20px
- Sub-line: "Loading your preview…" in Inter 13px, `rgba(255,255,255,0.7)`
- Three pulsing dots below in white/40 (CSS keyframes, staggered)
- Respects `prefers-reduced-motion`

Apply in the same `ScreenContent` component in both branches (initial load AND iframe-swap overlay) so the experience is consistent.

## Files touched

- `src/components/landing/StagingCoursesSection.tsx` (only file)

No new files, no DB changes, no new dependencies.
