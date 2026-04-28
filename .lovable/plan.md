# Returning-user "Check your email" + device-bound magic links

Tonight's launch goal: when a known student enters their email, the modal should clearly say "you already have an account, we just sent a login link", let them resend, and the link itself should be tied to the device that requested it so a forwarded link doesn't grant access on someone else's phone.

## 1. Reframe the "sent" screen (QuickEmailGateModal + SmartEmailModal)

Replace the current generic "Check your email / secure access link" copy with a returning-user message:

```text
Welcome back!
We sent a login link to {email}.
It expires in 15 minutes — open it on this device to sign in.

[ Open my email app ]                  ← optional helper button
[ Resend login link ]                  ← 30s cooldown, shows "Sent ✓" on success
[ Use a different email ]              ← goes back to the email step
```

- Keep navy + red brand styling, DM Serif heading.
- Show the email address back to the user (lowercased, masked-friendly).
- Resend calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <callback w/ fp+nonce> } })` again, with a 30-second client-side cooldown and a small inline "Login link resent ✓" confirmation.
- Apply the same reframe to `SmartEmailModal`'s `magic-link-sent` step (it already says "Welcome back!" — extend with the same expiry + resend pattern) and to `StudentLoginModal` / `MagicLinkModal` / `StagingEmailPromptModal` for consistency.

Only the `QuickEmailGateModal` flow already knows the user is returning vs new (the `SmartEmailModal` checks `students` table). For modals that fire OTP unconditionally, we still show the same "we sent your login link" copy — the wording works for both new and returning since the action is identical.

## 2. Device-bound magic links (prevent link sharing)

We already have `student_devices` with a stable browser fingerprint via `getStoredFingerprint()`. We'll bind each magic link to the requesting device using a short-lived nonce stored server-side.

### New table: `magic_link_nonces`
```text
id uuid pk
email text not null
nonce text not null unique           -- random 32-byte url-safe string
device_fingerprint text not null     -- captured at request time
user_agent text
ip text
created_at timestamptz default now()
expires_at timestamptz not null      -- now() + 15 min
consumed_at timestamptz
```
RLS: no client access; only edge functions (service role) read/write.

### New edge function: `request-magic-link`
- Input: `{ email, fingerprint, deviceName, userAgent }`
- Generates a nonce, inserts a row, then calls `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: '<site>/auth/callback?n=<nonce>' } })`
- Sends the email via the existing auth email path (the link returned by `generateLink` is what gets emailed; we just intercept the `redirectTo` to carry our nonce).
- Returns `{ ok: true }` so the modal can show the "sent" screen.

All modals (`QuickEmailGateModal`, `SmartEmailModal`, `MagicLinkModal`, `StudentLoginModal`, `Login.tsx`, `StagingEmailPromptModal`, `JoinOrg.tsx`) switch from `supabase.auth.signInWithOtp` to invoking `request-magic-link` with the current `getStoredFingerprint()`.

### `AuthCallback.tsx` — verify device binding
After `getSession()` succeeds, before navigating:
1. Read `?n=<nonce>` from the URL.
2. If missing → treat as legacy/manual login, allow through (back-compat).
3. If present, call new edge function `verify-magic-link` with `{ nonce, fingerprint: getStoredFingerprint() }`.
4. The function looks up the nonce row, checks: not consumed, not expired, and `device_fingerprint === submitted fingerprint`.
5. Outcomes:
   - **Match** → mark `consumed_at`, return `ok`. Continue normal flow (LW enrollment, dashboard redirect).
   - **Foreign device** → `supabase.auth.signOut()`, automatically call `request-magic-link` again for the original email and the *new* device's fingerprint, then redirect to `/login?message=device_mismatch&resent=1`.
   - **Expired / consumed** → sign out, redirect to `/login?message=link_expired`.

### `/login` messaging
Add handling for the new query messages:
- `device_mismatch` → "Looks like that link was opened on a different device. We just sent a fresh link to your email — open it on this device to sign in."
- `link_expired` → "That login link expired. Enter your email to get a new one (links last 15 minutes)."

## 3. Small supporting changes
- 15-minute expiry is enforced by our nonce row (Supabase OTP itself defaults to 1h; our nonce is the gate).
- Add a tiny `lastSentAt` state in the modals so the Resend button shows a 30s countdown (`Resend in 24s…`) to discourage spam.
- Telemetry: log `magic_link_requested`, `magic_link_consumed`, `magic_link_device_mismatch` rows in an existing `auth_events` style table if available, otherwise console-only for tonight (low priority — can add post-launch).

## Technical detail summary

**New files**
- `supabase/functions/request-magic-link/index.ts`
- `supabase/functions/verify-magic-link/index.ts`
- Migration: `magic_link_nonces` table + RLS (deny-all) + index on `(nonce)` and `(email, created_at desc)`.

**Edited files**
- `src/components/landing/QuickEmailGateModal.tsx` — new `sent` screen copy, resend button, fingerprint-aware request.
- `src/components/landing/SmartEmailModal.tsx` — same treatment for `magic-link-sent` step.
- `src/components/landing/MagicLinkModal.tsx`, `StudentLoginModal.tsx`, `StagingEmailPromptModal.tsx`, `src/pages/Login.tsx`, `src/pages/JoinOrg.tsx` — swap `signInWithOtp` for `request-magic-link` invoke; add resend + 15-min copy.
- `src/pages/AuthCallback.tsx` — nonce verification step before redirect; auto re-issue on mismatch.
- `src/pages/Login.tsx` — render `device_mismatch` / `link_expired` toast/banner.

**Out of scope tonight**
- Geo/IP heuristics — fingerprint mismatch is sufficient for v1.
- Limiting how many active nonces a single email can have (we'll just always honor the latest; old ones still expire on their own).
- Touching the existing `student_devices` 5-device flagging logic.
