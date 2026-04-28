## Goal

Retire the legacy `/login` page experience. Sign-out and unauthenticated `/my-dashboard` access should both land on `/`, and unauthenticated `/my-dashboard` should auto-open the existing magic-link login modal (`MagicLinkModal`) already used in `StagingNavbar`.

## Changes

### 1. `src/components/landing/StagingNavbar.tsx`
Make the navbar's existing `loginOpen` state controllable via a URL query param so external redirects can open it.

- On mount, read `useSearchParams()`. If `?login=1` is present, set `loginOpen=true` and strip the param from the URL via `setSearchParams({}, { replace: true })`.
- Optional: also support `?login=no_purchase` to show a small inline note in the modal ("We couldn't find a purchase tied to that email"). If we keep this, pass a `message` prop into `MagicLinkModal`. If `MagicLinkModal` doesn't accept one, just open the modal and skip the note for now (we can wire copy later).

### 2. `src/pages/StudentDashboard.tsx`
Replace all three `/login` navigations with `/?login=1` (and drop the page entirely on sign-out).

- Line ~260: `navigate("/login", { replace: true })` → `navigate("/?login=1", { replace: true })` (no session)
- Line ~275: `navigate("/login?message=no_purchase", ...)` → `navigate("/?login=1&reason=no_purchase", { replace: true })`
- Line ~352 (`handleSignOut`): after `supabase.auth.signOut()`, navigate to `/` (no modal — user just signed out, they don't want a login prompt immediately).

### 3. `src/App.tsx`
Redirect the legacy `/login` route to `/` so any stale links/bookmarks don't dead-end on the old page.

- Replace `<Route path="/login" element={<Login />} />` with `<Route path="/login" element={<Navigate to="/?login=1" replace />} />`.
- Remove the now-unused `const Login = lazy(() => import("./pages/Login"))` import.

### 4. `src/pages/Login.tsx`
Leave the file in place for now (not deleted) since it's small and harmless, but it will no longer be reachable through routing. We can delete in a follow-up cleanup if you want.

## Out of scope

- No changes to `MagicLinkModal` itself — it already sends magic links via `sendMagicLink`, which is exactly the desired behavior.
- No changes to other places that link to `/login` from inside admin/VA flows (none found in student-facing code beyond StudentDashboard).

## Result

- Sign out from `/my-dashboard` → lands on `/` (clean home, no modal).
- Visit `/my-dashboard` while signed out → lands on `/` with the magic-link login modal open automatically.
- Old `/login` URL → redirects to `/` with the modal open.
