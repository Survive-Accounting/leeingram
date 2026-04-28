# Solutions Viewer — Split View Fix + First-Load Onboarding

## 1. Diagnosis: why split view does nothing

Three things are working against you, all rooted in **viewport width inside the iframe** (not the browser window):

The Solutions Viewer is rendered inside an `<iframe>` embedded in the StudyPreviewer's 90s window frame on both `/` and `/my-dashboard`. The iframe's internal width is roughly **~900–1000px**, even on a wide laptop, because it sits inside:

- the navy hero band's 1080px max
- the navy console's padding
- the 90s window frame's chrome and inset margins

The viewer's split-view code uses Tailwind's `lg` breakpoint (≥1024px) for both:

- the toolbar visibility (`hidden lg:flex`) — so the **toggle buttons aren't even rendered** below 1024px iframe width
- the side-by-side layout (`lg:flex-row`) — so even if you toggled, the panels would still stack

That's why clicking does nothing visible: on the embedded view, the buttons don't exist, and the layout isn't capable of going side-by-side. The keyboard shortcut (`\`) does flip state but the layout doesn't react.

Default is already `"split"` in code — but it's invisible at sub-`lg` widths.

## 2. Fixes

### A. Make split view actually work in the embedded iframe

Lower the breakpoint from `lg` (1024px) → `md` (768px) for the split-view UI, since the iframe's effective width crosses 768 long before 1024. Specifically, in `src/pages/v2/SolutionsViewerV2.tsx`:

- toolbar wrapper: `hidden lg:flex` → `hidden md:flex`
- split container: `lg:flex-row lg:items-stretch` → `md:flex-row md:items-stretch`
- the two panels' `lg:` style guards → `md:`
- divider visibility check: keep `!isMobileViewport` (the `useIsMobile` hook already uses 768)

This aligns the layout breakpoint with the mobile detection breakpoint, so the toolbar appears exactly when the layout supports it.

### B. Default to split (already correct, just verify)

`useState<ViewMode>("split")` is already the default. After fix A this will visibly take effect on first paint.

### C. Add an "Open full screen" affordance

In the desktop toolbar (next to the existing reset button), add a small icon button that opens the current asset in a new top-level tab (`/v2/solutions/:assetCode`). This is the cleanest way to escape the iframe constraints when a student wants the most room. Tooltip: "Open in full screen".

The existing "Open in new tab" button in the 90s window toolbar already does this — we'll keep both so it's discoverable from inside the viewer chrome too.

## 3. First-load onboarding modal

A one-time, easily skippable modal shown on the **first load of the Solutions Viewer per session** (sessionStorage flag, not localStorage — so it can re-suggest in a new session if useful).

### Desktop (≥768px)

- Title: "Best in full screen"
- Body: "The split view works best when the viewer has more room. Open it full screen for a smoother cram session."
- Primary button: **Open full screen** → opens `/v2/solutions/:assetCode` in a new tab
- Secondary: **Continue here** (dismiss)
- "Don't show again" checkbox → writes a localStorage flag

### Mobile (<768px)

- Title: "Cram better on a laptop"
- Body: "Solutions Viewer is built for a bigger screen. Send yourself a link and pick it up on your laptop."
- Email input (prefilled if user is logged in)
- Primary button: **Send link to my email**
- Secondary: **Continue on phone**

The email is sent via a new edge function `send-viewer-link` using Resend (already configured). The email contains a deep link back to the same asset.

## 4. Viral share — "Share 2 free passes with friends"

Sits **subtly underneath** the onboarding modal CTAs, and also as a small persistent strip under the viewer toolbar on desktop.

### Behavior

- Copy: "Share 2 free passes with friends"
- One-click **Copy link** button
- The link is `https://learn.surviveaccounting.com/?ref=:userCode` (or `/get-access?ref=:userCode` if signed-out flow lives there)
- `:userCode` is a short opaque code per user (8–10 chars, base32) generated on first share
- On copy: toast "Link copied — your friend gets 2 free passes when they join"

### Attribution data model

New table `referral_codes`:

```text
id              uuid pk
user_id         uuid fk → auth.users
code            text unique (8-char base32)
created_at      timestamptz default now()
```

New table `referral_attributions`:

```text
id              uuid pk
referrer_user_id uuid fk
referred_email   text
referred_user_id uuid nullable (filled when they sign up)
landing_at      timestamptz
signup_at       timestamptz nullable
status          text ('landed' | 'signed_up' | 'rewarded')
```

When someone hits `/?ref=CODE`:
- store `ref` in localStorage as `sa.referral_ref`
- record a row in `referral_attributions` (status = `landed`) via an edge function
- on signup completion, look up that ref and write `referred_user_id` + `signup_at` + status `signed_up`
- a follow-up step (out of scope for this pass) credits the referrer with 2 free pass redemptions

RLS:
- `referral_codes`: user can `select` their own code; `insert` their own
- `referral_attributions`: insert via service-role edge function only; user can `select` rows where `referrer_user_id = auth.uid()`

## 5. Files to change

- `src/pages/v2/SolutionsViewerV2.tsx` — breakpoint swap (lg → md), add full-screen icon button
- `src/pages/v2/ViewerOnboardingModal.tsx` — **new**, desktop + mobile variants, session flag
- `src/components/share/ReferralShareStrip.tsx` — **new**, copy-link CTA
- `src/hooks/useReferralCode.ts` — **new**, ensures the user has a code, returns it
- `supabase/functions/send-viewer-link/index.ts` — **new**, Resend email
- `supabase/functions/track-referral-landing/index.ts` — **new**, records landing
- migration: create `referral_codes` and `referral_attributions` tables + RLS

## 6. What this does NOT touch

- The 90s window frame / retro shell (kept exactly as-is)
- The Practice Helper iframe wiring in StudyPreviewer (unchanged)
- The reward redemption flow for the 2 free passes (separate sprint — this lays the attribution foundation)

## 7. Open questions before I build

1. For the **mobile email-myself** flow, do you want to require a logged-in user, or accept any email (anonymous send)?
2. For the **referral reward**, should "2 free passes" mean the friend gets the pass free, or the referrer gets credit toward something? I'll wire the attribution either way — just need to know what the toast/CTA copy should promise.
3. Should the onboarding modal also show when the viewer is opened in a top-level tab (not just inside the dashboard iframe), or suppress it there?
