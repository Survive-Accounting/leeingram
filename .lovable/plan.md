## Goal

When a student clicks **Sign out** from the dashboard menu, instead of immediately navigating to `/` (which shows the login screen and feels abrupt), keep them on the dashboard with the page dimmed behind a friendly goodbye modal. Closing the modal sends them home.

## What the modal looks like

A small centered card on a dark backdrop:

- **Title:** "Thanks for trying our free study tools."
- **Body:** One short line: "Tell a friend so they can survive finals too — or send Lee feedback to help shape what comes next."
- **Primary button:** `Share with a friend` — copies `https://learn.surviveaccounting.com/?ref={betaNumber}` to clipboard (label flips to `Link copied` for ~2s). Uses the same share URL pattern as the existing `SecondaryActionsRow`.
- **Secondary button:** `Share feedback` — opens the existing `FeedbackToolModal` (which already handles unauthenticated submissions via email).
- **Close (X)** in top-right and clicking the backdrop both dismiss the modal and navigate to `/`.

Styling matches the existing dashboard modals (`OnboardingModal`, `WelcomeVideoModal`): white card, rounded-2xl, navy primary button (`#14213D`), Inter font. No new dependencies.

## Implementation

All changes in `src/pages/StudentDashboard.tsx`.

1. **State.** Add `signedOut: boolean` and `signOutCopied: boolean` to the `StudentDashboard` component.

2. **Sign-out handler.** Replace the current `handleSignOut`:
   - Call `supabase.auth.signOut()`
   - Set `signedOut = true` (do **not** navigate)

3. **Modal dismiss.** A `dismissSignOut` helper sets `signedOut = false` and calls `navigate("/", { replace: true })`. Triggered by the X button and backdrop click.

4. **Share button.** Reuses the existing `betaNumber` state to build the share URL (same logic as `SecondaryActionsRow`). On success, set `signOutCopied = true` and reset after 2s. Error path shows a toast.

5. **Feedback button.** Calls `setFeedbackOpen(true)`. The `FeedbackToolModal` already mounts at the root of the page and works while `signedOut` is true.

6. **Render.** Add a new `<SignOutModal>` block (inline JSX, no new file) right next to the existing modals near the bottom of the return. It only renders when `signedOut` is true.

7. **Auth re-init guard.** The current `useEffect` that reads the session runs only on mount, so signing out won't re-trigger the "no session → redirect to /?login=1" path. No change needed there. The `FeedbackToolModal` continues to work because it accepts `email` (we pass the cached `email` state, which is still in memory after sign-out).

## Files changed

- `src/pages/StudentDashboard.tsx` — add state, replace `handleSignOut`, add `<SignOutModal>` JSX. No other files touched.

## Out of scope

- Triggering the same modal when sign-out happens from any other page (only `/my-dashboard` has a sign-out affordance today).
- Persisting any "you signed out" state across reloads — closing the modal is final.
- Changes to the login screen itself.
