## Top section refinements — `/my-dashboard`

Replace the "Your beta · two quick things" eyebrow with a personal welcome header, soften the expiration line under the previewer, and update the share card eyebrow.

---

### 1. Share card eyebrow copy
**File:** `src/components/dashboard/ShareWithFriendsBand.tsx`

- Change eyebrow from `Help us launch loud` → `Help us, help you`
- Keep the same pill styling (red text, sparkle icon, uppercase, letter-spacing).

Everything else on the card (headline, body, buttons, link line) stays as-is.

---

### 2. Replace "two quick things" eyebrow with a personal welcome header
**File:** `src/pages/StudentDashboard.tsx`

Above the Share + Note-from-Lee row, replace the current small grey eyebrow:

```
• YOUR BETA · TWO QUICK THINGS
```

with a warmer two-line greeting:

- Line 1 (display, DM Serif Display, navy, ~22–26px):
  `Welcome back, [firstName].`
  (falls back to `Welcome back.` when no name is available)
- Line 2 (Inter, slate, ~13–14px):
  `Let's Survive [Course] at [Campus].`
  - `[Course]` = existing `courseLabel` (already resolved)
  - `[Campus]` = existing `campusName`
  - If campus is missing, render `Let's Survive [Course].`
  - If course is missing too, render `Let's get you ready for finals.`
- Small secondary action on the right (desktop) / below (mobile):
  `Go to study tools →` — text/ghost button styled subtly (navy text, underline on hover, small arrow). On click, smooth-scrolls to the `StudyPreviewer` section.

Layout: header sits in a flex row (`justify-between`, `items-end`) above the existing 12-col grid. On mobile it stacks (text first, button below).

Implementation detail: add a `ref` on the previewer wrapper `<div>` and call `ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })` from the button handler.

---

### 3. Soften the expiration line under the previewer headline
**File:** `src/pages/StudentDashboard.tsx`

In the previewer-entry block, the current paragraph reads:
```
Free Beta Access through May 16, 2026
```

Replace it with:
```
Free access expires May 31st
```

- Keep position (centered, directly under the `Free accounting study tools for finals.` headline).
- De-emphasize: `text-[11px]`, color `#94A3B8` (or lighter, e.g. `#A3AEC2`), normal weight, slight top margin (`mt-2`), Inter.
- Remove dependency on `purchase.expires_at` for this line — copy is hardcoded per the request.

Note: the date string is hard-coded as requested ("May 31st"), independent of the per-purchase `expires_at` value.

---

### Files touched
- `src/components/dashboard/ShareWithFriendsBand.tsx` — eyebrow text only
- `src/pages/StudentDashboard.tsx` — replace section eyebrow with welcome header + scroll button; update expiration fine-print copy and styling

### Out of scope (unchanged)
- Retro monitor / `StudyPreviewer` internals (welcome inside the monitor stays as-is)
- Note From Lee card
- Grid proportions (Share = col-span-7, Note = col-span-5)
- Navbar, feedback modal, onboarding, video modal
