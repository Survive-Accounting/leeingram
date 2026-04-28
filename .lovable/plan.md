## Goal

Rebuild the `/my-dashboard` experience around three tool cards (with #3 being a "tell us what to build" prompt), an in-dashboard workspace pane, a course-level chapter selector with a satisfying loading sequence, an early-bird opt-in only when not already opted in at checkout, a header CTA that opens the feedback modal, and a strong "share with friends" moment.

Also fix the small login-panel issue: remove "Use a different email" from `CheckEmailPanel` so users can only resend the magic link to the email they signed up with.

---

## Scope of changes

### 1. `src/components/landing/CheckEmailPanel.tsx`
Remove the `onChangeEmail` button block and the prop. Simpler state — only "Resend login link" remains.

### 2. `src/pages/StudentDashboard.tsx` — full restructure

**Header (DashNavbar)**
- Logo (Survive Accounting) on the left → click goes to `/` (home), not `/my-dashboard`. Match landing logo treatment (red "Survive" / navy "Accounting") on the dashboard's light background.
- Top-right CTA: change "Submit Feedback" button to clearly say **"Submit Feedback"** and open `FeedbackToolModal`. (Already open — keep this, just make it the only primary action and make sure it's obviously a feedback CTA.)
- Keep "Sign out" as a quiet secondary link (it already redirects to `/` after the previous change).

**Greeting headline**
- First login (welcomed_at is null): `Thanks for joining, {firstName}`
- Returning visit (welcomed_at set): `Welcome back, {firstName}`
- Subtitle: `Free Beta Access through May 16, 2026`
- Below subtitle, render `EarlyBirdOptInRow` (see #4) only if the student has NOT already opted in at checkout.

**Course + chapter selector strip (above tool cards)**
- Left: course label rendered as `{campusName} · {courseName}` (e.g. "University of Mississippi · ACCY 202"). Pull `campusName` from existing onboarding load; fetch the course name from `courses` by `purchase.course_id`.
- Right: chapter dropdown labelled `Choose chapter…`. On change:
  1. Set `chapterLoading=true` — each tool card shows a shimmer/pulse overlay for ~700–1000 ms.
  2. Resolve the first asset for that chapter (existing query) and a JE list placeholder.
  3. Set `selectedChapterId` and `chapterLoading=false`, then fire `toast.success("Ch {N} study tools are loaded!")`.
- Persist `selectedChapterId` in `localStorage` so it survives reload.

**Tool cards section (replaces `BetaToolCards` for this layout)**
- Three cards in a row (1 col on mobile):
  1. **Practice Problem Helper** — Active. Click sets `activeTool='practice'` and scrolls/smooth-anchors the workspace pane below into view.
  2. **Journal Entry Helper** — Placeholder. Click sets `activeTool='je'` (workspace shows a friendly "coming soon — tell us what you want from this" panel with a CTA to open feedback). No real iframe yet.
  3. **Tell us what you want built** — Dashed border, muted styling. Click opens `FeedbackToolModal`. Doesn't change `activeTool`.
- Active card gets a solid navy ring; inactive get hover lift. While `chapterLoading`, all three render a subtle shimmer and are disabled.
- If no chapter is selected, clicking a tool card shows a toast `"Pick a chapter first"` and gently flashes the dropdown.

**Workspace pane (in-dashboard, replaces existing iframe section)**
- Single large pane below tool cards, full width within the `max-w-6xl` container, min-height ~`min(85vh, 980px)`.
- `activeTool === 'practice'` and `viewerAssetCode` exists → render `<iframe src={/v2/solutions/{code}}>` exactly as today, with a small toolbar: chapter name on the left, "Open in new tab" link on the right, and a chapter "Next problem" hook for later (placeholder noop ok).
- `activeTool === 'je'` → render placeholder card: "Journal Entry Helper is being built. Tell us exactly how you'd want this to work →" with a button that opens `FeedbackToolModal`.
- No tool selected → empty-state inside the pane: "Pick a tool above to start studying."

**Share-with-friends section (new, prominent)**
- Below the workspace pane, before the support footer.
- Bold band styled like `WelcomeCard` (navy gradient, red accent) with a big serif headline: `Help us make this beta epic — share with a friend`.
- Body copy: short reason ("Every friend who joins makes the tools sharper for your class."), then two big buttons: **Copy share link** (uses existing `?ref={betaNumber}` pattern) and **Text a friend** (opens `sms:?&body=...` with prefilled message). Include a third small link: "Share to Instagram story" (opens a copy-to-clipboard + IG app deep link, fallback toast).
- Render only when `onboarding.beta_number` is available (returning + first-time users both get this; remove the share affordance from `WelcomeCard` itself to avoid duplication, OR keep but downplay there — implementer's call, default: keep `WelcomeCard` only on first visit and rely on this band thereafter).

**Cleanup**
- Remove `ChapterPickerModal` (replaced by inline dropdown).
- Remove `LegacyWelcomeCard` from default flow if redundant; keep its file in case it's used elsewhere (verify with rg before deleting).
- Keep `WelcomeVideoCard` placement near the greeting unchanged.

### 3. `src/components/dashboard/EarlyBirdOptInRow.tsx` — new component
- Single-line checkbox styled inline (matches `GetAccess.tsx` copy): `Send me early-bird discounts for Summer/Fall '26 access`.
- On toggle, upsert into `student_onboarding.early_bird_opt_in` (boolean column, see #5) for current `user_id` and show a tiny toast `"You're on the early-bird list ✓"`.
- Self-hides once `early_bird_opt_in === true`.

### 4. `src/components/dashboard/FeedbackToolModal.tsx`
Already exists. Verify the modal accepts an optional `prefillContext` so the third tool card can prefill a label like "Idea for a new tool:". Tiny edit; no behaviour change otherwise.

### 5. Database migration
Add `early_bird_opt_in boolean not null default false` to `public.student_onboarding`. Backfill from `auth.users.raw_user_meta_data->>'early_bird_opt_in'` so checkout opt-ins already on file are respected. Update `claim-free-beta` edge function to also write this column on first insert (additive — keep `user_metadata` for compatibility).

The dashboard reads this column to decide whether to render `EarlyBirdOptInRow`.

### 6. Logo route
In `DashNavbar`, change the logo `onClick` from `navigate("/my-dashboard")` to `navigate("/")`. (Matches the user's request.)

---

## Loading-animation details

- `chapterLoading` triggers a shimmer overlay on each `ToolCard`: a `before:` pseudo-element with a left-to-right gradient sweep (200ms → 1000ms ease-out, repeating once). Cards are pointer-events: none during loading.
- After resolution: `toast.success(\`Ch ${chapterNumber} study tools are loaded!\`)` using sonner.

---

## Out of scope

- Real Journal Entry Helper functionality.
- Per-chapter telemetry for opt-in events.
- Refactoring `WelcomeCard` styling (keep as-is, just gate display to first visit).
- Changing the Onboarding modal flow.

---

## Files touched

- `src/pages/StudentDashboard.tsx` (large edit)
- `src/components/dashboard/BetaToolCards.tsx` (replaced by inline implementation; file can stay if used elsewhere — verify with rg, otherwise delete)
- `src/components/dashboard/EarlyBirdOptInRow.tsx` (new)
- `src/components/dashboard/FeedbackToolModal.tsx` (small prop addition)
- `src/components/landing/CheckEmailPanel.tsx` (remove "Use a different email")
- `supabase/functions/claim-free-beta/index.ts` (also write new column)
- 1 new SQL migration adding `early_bird_opt_in`

Approve and I'll switch to build mode and implement.
