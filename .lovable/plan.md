# Magic Link Modal — Post-Send Cleanup

## Goal

Once the user submits their email, the modal should feel calm and helpful — no leftover heading/subhead from the entry step, plus quick links to open their inbox and a clear way to resend or get help.

## Scope

Single file: `src/components/landing/MagicLinkModal.tsx`.

## Changes

### 1. Hide the entry-step header after sending

Currently the title "Log in to Survive Accounting" and subtitle "Enter your email and we'll send you a secure login link." render above the success state too. Move both inside the `!sent` branch so the success view starts clean at the top of the card (just the close button in the corner).

### 2. New success-state layout

Replace the current success block with:

- 📬 mailbox icon (larger, centered)
- Heading: **Check your email** (DM Serif Display, navy)
- Body copy: *"We sent a secure login link to **{email}**. Click it to open your study tools."* (uses the email the user just entered for confirmation)
- **Quick-open inbox row** — three small buttons side-by-side, auto-selected based on the email domain but all three always shown:
  - **Open Gmail** → `https://mail.google.com/mail/u/{email}/#search/from%3A%40surviveaccounting.com+newer_than%3A1h`
  - **Open Outlook** → `https://outlook.live.com/mail/0/inbox`
  - **Open Apple Mail** → `https://www.icloud.com/mail`
  - Each opens in a new tab. Styled as outlined chips (navy border, white bg, navy text, small icon).
  - The button matching the user's email domain (gmail.com → Gmail, outlook/hotmail/live → Outlook, icloud/me/mac → Apple Mail) is visually emphasized (filled navy) and listed first.
- Primary **Got it** button (unchanged style) closes the modal.
- Footer line replacing "Didn't see it? Check spam…":
  > Didn't see it? **Resend email** or **contact Lee**.
  - "Resend email" is a text link → re-runs `signInWithOtp` with the same email, shows a sonner toast: *"New login link sent."* (or error toast on failure). Disabled / shows spinner while in flight.
  - "Contact Lee" is a text link → opens a lightweight inline support modal.

### 3. Inline support modal

Add a small second modal layer (rendered above the magic link modal when `supportOpen` is true) with:

- Heading: **Need help logging in?**
- Pre-filled subject: "Login help"
- Fields: Name, Email (pre-filled with the email they just tried), Message
- Submit writes to `contact_messages` table and fires `send-contact-notification` edge function (same pattern as `ContactForm.tsx`)
- Success toast: *"Message sent — Lee will reach out shortly."*
- Cancel / X to close, returns user to the success state of the magic link modal

This keeps the support flow consistent with the existing `ContactForm` component without introducing a new backend path.

### 4. Toast wiring

Import `toast` from `sonner` (already used elsewhere in the project) for:
- Resend success / failure
- Support message success / failure

## Out of scope

- No copy changes to the entry step (email input + Send login link button stay as-is).
- No changes to auth callback or Supabase config.
- No new tables or edge functions.

## Technical notes

- Track new state: `resending: boolean`, `supportOpen: boolean`.
- Keep `email` in state after `setSent(true)` so we can show it in the confirmation copy and pre-fill the support form (currently the email is preserved — good).
- Mail provider detection helper: simple switch on the part after `@`.
- Support modal can be a small inline component in the same file to avoid a new file for ~40 lines of JSX.
