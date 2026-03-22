# Email Delivery — Resend Integration

## Overview

All transactional emails are sent via Resend using a verified sending domain.

**Sending domain**: `mail.surviveaccounting.com` (verified)
**From address**: `lee@mail.surviveaccounting.com`
**Reply-To**: `lee@surviveaccounting.com`
**API key**: Stored in Supabase secrets as `RESEND_API_KEY`

---

## Shared Across Projects

Since both the main app and the Greek portal share the same Supabase instance, both projects can use the same `RESEND_API_KEY` secret. No additional Resend setup needed for the Greek portal.

---

## Current Edge Functions Using Resend

### `send-bulk-fix-summary`
- Triggered after each operation in the Bulk Fix Queue
- Sends per-operation completion email to Lee
- Also sends a final queue-complete summary when all operations finish
- To: `lee@surviveaccounting.com`

---

## Planned Emails (Not Yet Built)

### Preview Delivery Email
- Triggered: When Lee or a VA sends a free preview asset to a student lead
- Subject: "Lee sent you a free solution — [Problem Title]"
- Flow: Pick-one-send-one from ACCY304 landing page
- Contains: Dynamic asset count, discount nudge
- Expiry reminder: Deferred — needs LW coupon URL format confirmed

### Greek Portal Emails (to build)
- Purchase confirmation email to org admin
- Magic link invite email for new org admins
- Seat cap alert to exec (email + SMS)
- Rollover notification at semester end

---

## Email Templates — Style Guide

- Clean, minimal HTML
- Survive Accounting branding (navy `#14213D`, accent red `#CE1126`)
- Lee's voice — direct, friendly, not corporate
- Mobile-responsive
- Always include reply-to so recipients can respond directly to Lee

---

## Supabase Secret Reference

All edge functions access the key via:
```typescript
const resendApiKey = Deno.env.get('RESEND_API_KEY');
```
