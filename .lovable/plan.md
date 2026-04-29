## Beta System Emails — Audit & Plan

Read-only audit complete. Below is what to reuse, what to add, and the proposed dashboard surface.

---

### 1. Existing code to reuse

**Resend integration (already wired).** Multiple edge functions hit `https://api.resend.com/emails` directly with `RESEND_API_KEY` (already in secrets). Canonical pattern in `supabase/functions/send-fix-email/index.ts`:
- From: `Lee <lee@mail.surviveaccounting.com>` (we will switch to `Survive Accounting <lee@mail.surviveaccounting.com>` per spec)
- Reply-to: `lee@surviveaccounting.com`
- `isTest` flag overrides recipient to `lee@surviveaccounting.com` and prefixes `[TEST]` — reuse this exact pattern.

**Magic link flow.** `supabase/functions/resend-login-link/index.ts` already issues device-bound magic links via Resend (`/auth/callback` + nonce + 15 min expiry). `src/lib/sendMagicLink.ts` is the client wrapper. The "Signup / magic link email" requirement is **already shipped** — for the beta dashboard we only need a **preview** of its template + a **test-send** button (no logic change).

**Beta dashboard shell.** `src/pages/BetaSpring2026Dashboard.tsx` is wrapped in `<AccessRestrictedGuard>`. `RESTRICTED_PATHS` in `src/components/AccessRestrictedGuard.tsx` already includes `/beta-spring2026` and `LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com"]`. No new guard needed.

**Activity signal source.** `student_events` (email, event_type, created_at, campus_id, course_slug) is already what `beta-dashboard-query` uses to derive funnel stages. Reuse for "inactive user" detection. `student_onboarding` gives signup time + display_name + campus. `students` gives the canonical email/name.

---

### 2. New tables

**`beta_email_templates`** — canonical content for each system email so Lee can edit copy without redeploying.
- `id uuid pk`, `slug text unique` (e.g. `magic_link`, `welcome_day0`, `study_tips_day2`, `feedback_day4`, `inactive_reminder`, `finals_close`)
- `subject text`, `preheader text`, `html_body text`, `text_body text`
- `from_name text default 'Survive Accounting'`, `from_email text default 'lee@mail.surviveaccounting.com'`, `reply_to text default 'lee@surviveaccounting.com'`
- `enabled boolean default false` (master kill-switch per template)
- `updated_at`, `updated_by_user_id`
- RLS: only Lee emails can select/update.

**`beta_email_sends`** — append-only audit log (also doubles as idempotency / dedupe).
- `id`, `template_slug`, `recipient_email`, `student_id?`, `subject`, `status` (`queued|sent|failed|skipped`), `is_test boolean`, `resend_id text`, `error text`, `triggered_by` (`manual|cron`), `sent_by_user_id?`, `created_at`
- Unique partial index on `(template_slug, recipient_email)` WHERE `is_test = false AND status = 'sent'` to enforce "send each email once per user" for nurture emails.

**`beta_email_schedule`** (optional, for automation phase) — config row per template:
- `template_slug pk`, `trigger_type` (`days_after_signup|days_after_inactive|manual_only`), `trigger_value int`, `enabled boolean`, `last_run_at`.

No changes to `students`, `student_events`, or `student_onboarding`.

---

### 3. New Edge Functions

All admin-gated by validating the caller's JWT email against `LEE_EMAILS` server-side before doing anything (mirror the `beta-dashboard-query` pattern).

1. **`beta-emails-list`** — returns all templates + recent send counts per template (for dashboard list view).
2. **`beta-emails-render`** — input `{ slug, sample_recipient_email? }`, returns rendered `{ subject, html, text }` with sample variables substituted (name, magic link placeholder, course, beta_number). Pure render, no send. Used for preview iframe.
3. **`beta-emails-send-test`** — input `{ slug, to? }`. Always sends to `to ?? lee@surviveaccounting.com`, prefixes `[TEST]`, logs to `beta_email_sends` with `is_test=true`. Reuses Resend POST snippet from `send-fix-email`.
4. **`beta-emails-send-real`** — input `{ slug, recipient_emails: string[], dry_run?: boolean }`. For each recipient: dedupe via `beta_email_sends` unique index, render with that user's variables, send, log. Hard cap (e.g. 500/call) + per-call `dry_run` that returns the recipient list without sending.
5. **`beta-emails-cron`** (Phase 2, scheduled via pg_cron at e.g. hourly) — reads `beta_email_schedule`, computes eligible recipients per rule:
   - `welcome_day0`: signed up < 24h ago, never sent.
   - `study_tips_day2`: signed up 1.5–3 days ago.
   - `feedback_day4`: signed up 3.5–5 days ago AND has ≥1 helper open event.
   - `inactive_reminder`: signed up ≥3 days ago AND no `student_events` ever.
   - `finals_close`: manual-only initially.
   Calls `beta-emails-send-real` internally with `dry_run=true` first day, then enable.

Magic link email is **not** re-implemented — `resend-login-link` stays the source of truth. The dashboard preview for it just renders the same HTML the function produces (we factor the template string into `_shared/beta-email-templates.ts` so both the function and the renderer use it).

---

### 4. Dashboard UI sections

New section in `BetaSpring2026Dashboard.tsx` titled **"System Emails"**, placed between AI Themes and Problem Reports. Two new components:

**`BetaSystemEmailsSection.tsx`** — list view:
- Table of 6 templates (slug, subject, enabled toggle, sent count last 7d, last sent at).
- Row actions: **Preview**, **Send Test**, **Send to selected users**, **Edit copy**.

**`BetaEmailDetailDrawer.tsx`** — opened per template:
- Tabs: **Preview** (rendered iframe via `beta-emails-render`), **Edit** (subject/preheader/html/text textareas + save), **Send** (test-send to Lee, plus optional real-send to a recipient picker fed by `student_onboarding`/`student_events`), **History** (last 50 rows from `beta_email_sends`).

Recipient picker pulls from existing `beta-dashboard-query` results (signups, inactive list) so Lee can target e.g. "all inactive signups" with one click — then **dry_run** previews the list before send.

Empty/loading/error states match the rest of the dashboard.

---

### 5. Email preview behavior

- Preview always renders via `beta-emails-render` (server-side) so frontend never touches the real Resend key or sees the raw API.
- Sample variables: `{{first_name}}`, `{{magic_link_url}}` (replaced with `https://learn.surviveaccounting.com/auth/callback?preview=1`), `{{beta_number}}`, `{{course_name}}`, `{{campus_name}}`, `{{dashboard_url}}`.
- HTML rendered into a sandboxed `<iframe srcDoc={html}>` so styles don't leak into the dashboard.
- Plain-text preview shown side-by-side in a `<pre>`.

---

### 6. Test-send behavior

- One button: **"Send test to lee@surviveaccounting.com"** (default) with optional override field.
- Subject prefixed `[TEST]`; recipient forced to test address regardless of input.
- Always logged to `beta_email_sends` with `is_test=true` and `triggered_by='manual'`.
- Toast shows Resend message id on success; failure toast shows the error string returned by Resend.

---

### 7. Automation / scheduling approach

**Phase 1 (this build):** manual-only. No cron. Lee sends each batch from the dashboard. Every template has `enabled=false` until Lee opts in.

**Phase 2 (separate request):** enable `beta-emails-cron` via pg_cron (`SELECT cron.schedule('beta-emails-cron', '0 * * * *', ...)`). Each template's `beta_email_schedule.enabled` flag gates whether cron actually sends. Dedupe via the partial unique index on `beta_email_sends` guarantees no double-sends even if cron runs twice or Lee manually sends the same template.

---

### 8. Safety rules

- `RESEND_API_KEY` only read inside edge functions — never returned to the client, never logged.
- All 5 new edge functions validate `auth.uid()` → email ∈ `LEE_EMAILS` before any Resend call. Non-admin requests get 403.
- Real-send hard cap: 500 recipients per invocation; UI shows a confirmation modal with exact count.
- Suppression: skip any recipient where `student_events` shows `event_type='unsubscribed_beta'` (we'll add a 1-line insert path later if Lee wants an unsubscribe link).
- Dedupe via DB unique index — not just app code — so even concurrent sends can't double-fire.
- `is_test` sends ignore the dedupe index (different partial filter) so Lee can re-test freely.
- Template HTML is stored as-is; it's only ever rendered into an `iframe srcDoc` (sandboxed) and into Resend — never `dangerouslySetInnerHTML` into the dashboard chrome.

---

### 9. Acceptance criteria

- /beta-spring2026 has a "System Emails" section listing all 6 templates.
- Lee can preview each template (HTML + text) with sample variables filled in.
- Lee can send a `[TEST]` copy to himself for any template, and the send is logged.
- Lee can edit subject + body of any template and the change is persisted (`beta_email_templates`).
- Lee can run a real send against a chosen recipient set with a dry-run preview first; dedupe prevents double-sends.
- Magic link email shown in the list reflects the same HTML that `resend-login-link` actually sends.
- All sends are visible in a per-template History tab pulling from `beta_email_sends`.
- Non-Lee users hitting any of the 5 new edge functions get 403; `RESEND_API_KEY` is never in the bundle.
- No cron is enabled in Phase 1; templates ship with `enabled=false`.

---

### 10. What I will build when you approve

1. Migration: `beta_email_templates`, `beta_email_sends` (+ partial unique index), `beta_email_schedule`, RLS for Lee-only.
2. Seed the 6 templates with starter HTML matching Survive Accounting brand (navy/red, Inter).
3. `_shared/beta-email-templates.ts` with the render helper + variable substitution; refactor `resend-login-link` to consume it for the magic link template.
4. Edge functions: `beta-emails-list`, `beta-emails-render`, `beta-emails-send-test`, `beta-emails-send-real` (cron deferred to Phase 2).
5. UI: `BetaSystemEmailsSection.tsx` + `BetaEmailDetailDrawer.tsx`, wired into `BetaSpring2026Dashboard.tsx`.
6. Toasts, empty/loading/error states, confirmation modal on real-send.
