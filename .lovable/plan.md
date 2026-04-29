## Goal

Send **one** email to `lee@survivestudios.com` that contains a rendered preview of every system email Survive Accounting sends, plus the metadata you need (subject line, trigger, purpose, from/to, reply-to). You reply with new HTML for any of them, and we batch-update the live templates in one pass.

This is faster than firing 8 separate test emails, and it puts everything in one inbox thread so nothing gets lost.

## Inventory — emails included in the digest

Found by scanning every edge function that hits the Resend API.

**Student-facing (4):**
1. **Welcome after purchase** — `stripe-webhook` — fires after Stripe checkout completes; delivers magic login link.
2. **Login magic link** — `resend-login-link` — fires when a student requests a login link from `/login`.
3. **Viewer link** — `send-viewer-link` — mobile→laptop handoff button on Solutions Viewer.
4. **Fix confirmation** — `send-fix-email` — sent when an issue a student reported is marked fixed.

**Internal notifications to you (4):**
5. **Issue report** — `send-issue-report` — student "Suggest Fix" submissions.
6. **Chapter question** — `send-chapter-question` — "Ask Lee" from chapter hub.
7. **Contact form** — `send-contact-notification` — public landing page contact form.
8. **Bulk fix summary** — `send-bulk-fix-summary` — overnight queue results.

(I did not find any other Resend-backed sends. Auth-system emails like Supabase signup are not customized in code.)

## Digest structure (what arrives in your inbox)

- **Header**: title + timestamp.
- **Table of contents**: jump links to each email.
- **One section per email**, each containing:
  - Subject line
  - Edge function name
  - From / To / Reply-to
  - When it triggers
  - Its purpose
  - Notes (test-mode behavior, special routing, etc.)
  - **Rendered HTML preview** in a dashed box with sample data
- Sample data: `student@example.edu`, `IA2_CH13_BE001_A`, `Jordan`, fake magic link.

## What I'll build

**1. New edge function** `supabase/functions/send-email-audit-digest/index.ts`
- No params. POST → renders catalog → sends to `lee@survivestudios.com` via Resend.
- Mirrors each live template's HTML (so what you see is what students see).
- Returns `{ ok, recipient, count }`.

**2. Trigger button** in the Beta Spring 2026 Dashboard → **Slack & Email** section: a small "Send email audit digest" button that invokes the function. (You can also call it any time from the dashboard.)

**3. Run it once** so the email lands in your inbox today.

## Your reply workflow

You reply to that one email with: "Update the welcome-after-purchase to this HTML: <paste>". I'll batch all the requested changes into one edit pass across the source templates (each template lives in its respective edge function file).

## Out of scope (for now)

- Auth emails sent by Supabase directly (signup confirmation, password reset). None are customized — they use Supabase defaults. If you want those branded too, we'd scaffold the auth-email-hook separately.
- Marketing/newsletter emails (the platform doesn't send any).

## Files touched

- create `supabase/functions/send-email-audit-digest/index.ts`
- edit `src/pages/BetaSpring2026Dashboard.tsx` (add the trigger button)
