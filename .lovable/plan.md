# Launch-Ready Beta Dashboard + Onboarding

A clean beta dashboard with required onboarding, beta-number identity, course chapter cards, and reliable LW enrollment that doesn't slow down login.

---

## What you'll see when it's done

**1. Smooth post-checkout flow**
- After paying or claiming free beta, students land on `/my-dashboard` already signed in.
- LW enrollment happens in the background — login is never blocked on it.
- A subtle "Setting up your account…" pill clears in <1s.

**2. First-time onboarding modal** (blocks dashboard for *all* logged-in students who haven't completed it — including legacy LW users)

Single modal, 3 short screens. **Only the syllabus upload is optional.** Everything else is required.

- **Screen 1 — About you**
  - Name (required)
  - Campus (prefilled from email/purchase, editable dropdown, required)
  - Upload syllabus (optional file picker — drops into `chapter-resources` bucket under `syllabi/{user_id}/`)

- **Screen 2 — Your background**
  - "Are you majoring in accounting?" → Yes / No / Definitely Not (required)
  - "Are you in a fraternity or sorority?" → Yes / No (required)
    - If **Yes**: searchable list from `greek_orgs` filtered to their campus, with "Add other" free-text fallback. One must be picked or "Add other" filled.
    - If **No**: continue.

- **Screen 3 — Confidence (required)**
  - 1–10 slider. "How confident are you for your next exam?"

On submit:
- Non-legacy users: assigns global beta number + per-campus beta number, dashboard shows celebration.
- Legacy users: stores responses, no beta number assigned, dashboard shows a quieter "Welcome back, you're all set" card.

**3. Welcome moment** (new beta users only)
> "Welcome to Survive Accounting.
> You're the **#247th** student to join the beta — and the **#12th** at **Ole Miss**."
>
> [ Invite friends · Copy share link ]

Shown once on first dashboard load after onboarding (dismissible card, persisted via `welcomed_at`).

**4. Beta dashboard layout**
```text
┌─────────────────────────────────────────────────────────┐
│  Beta · expires May 15, 2026 · 17 days left            │ ← thin top strip
├─────────────────────────────────────────────────────────┤
│  Welcome back, Jordan                                   │
│  Beta #247 · #12 at Ole Miss                            │
│                                                         │
│  ┌─ Beta Tools ──────────────────────────────────────┐  │
│  │  [Practice Problem Helper]   ← active             │  │
│  │  [Journal Entry Memorizer]   ← coming soon badge  │  │
│  │  [Help us decide!]           ← feedback form      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  Your Course — Intro Accounting 2                       │
│  ┌──┬──┬──┬──┬──┬──┬──┐                                │
│  │ 1│ 2│ 3│ 4│ 5│ 6│ 7│ ...  ← 13 chapter cards        │
│  └──┴──┴──┴──┴──┴──┴──┘   (each opens video archive)   │
└─────────────────────────────────────────────────────────┘
```

- **Top countdown strip**: navy bar, "Beta access expires May 15, 2026 · {N} days left".
- **Welcome line** with beta number badge (pill style, navy bg, red number). Legacy users see no badge — just "Welcome back, Jordan".
- **3 Beta Tool cards**:
  - **Practice Problem Helper** → routes to existing `/cram` flow (active).
  - **Journal Entry Memorizer** → "Coming soon" badge; click opens "We're building this — what would you want?" mini-form.
  - **Help us decide!** → mock tool styling (real card with empty state) → opens textarea modal posting to `chapter_questions` with `issue_type='feedback'`.
- **Chapter cards grid** for the student's enrolled course (Intro 1, Intro 2, IA1, or IA2). Each opens `/cram/:chapterId` (existing video archive section).

**5. Existing LW users (legacy)**
- Detected on first login: known LW email but no `student_onboarding` row.
- Marked `is_legacy=true` at row creation.
- **Still required to complete onboarding** — same modal, same required questions.
- Do NOT receive a beta number; do NOT count toward beta totals.
- After onboarding, dashboard shows the legacy welcome card: "Welcome back to the new app. Your course access carried over."

---

## Technical implementation

### Database (1 migration)

```sql
-- Beta onboarding capture + identity
create table student_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  campus_id uuid references campuses(id),
  course_id uuid references courses(id),
  syllabus_file_path text,                    -- the only optional field
  is_accounting_major text check (is_accounting_major in ('yes','no','definitely_not')),
  is_in_greek_life boolean,
  greek_org_id uuid references greek_orgs(id),
  greek_org_other text,
  confidence_1_10 int check (confidence_1_10 between 1 and 10),
  is_legacy boolean not null default false,
  beta_number int unique,                      -- global, sequential, null for legacy
  campus_beta_number int,                      -- per-campus, sequential, null for legacy
  welcomed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Atomic claim function (avoids race on counters)
create function claim_beta_number(p_email text, p_campus_id uuid)
returns table(beta_number int, campus_beta_number int)
language plpgsql security definer set search_path=public as $$ ... $$;

-- RLS: each user reads/writes only their own row
alter table student_onboarding enable row level security;
create policy "self read"  on student_onboarding for select using (auth.uid() = user_id);
create policy "self write" on student_onboarding for insert with check (auth.uid() = user_id);
create policy "self update" on student_onboarding for update using (auth.uid() = user_id);
```

- `beta_number` only assigned for **non-legacy** users at onboarding completion → naturally excludes them from totals.
- Storage bucket `chapter-resources` already exists (public). Add path policy so users can write to `syllabi/{auth.uid()}/...`.

### Edge functions

**New: `enroll-lw-background`**
- Fire-and-forget from `/auth/callback` and `/checkout/complete` after session is set.
- Looks up active `student_purchases` for the email; runs the same LW enroll logic `stripe-webhook` already uses (course-level, `course.slug` as LW courseId); updates `lw_enrollment_status`.
- Idempotent: skips if `lw_enrollment_status='enrolled'`.
- Returns 202 immediately via `EdgeRuntime.waitUntil` so the round trip is ~50ms.

**New: `complete-onboarding`**
- Validates payload (zod), determines `is_legacy` (true if user has a `student_purchases` row created before today AND `lw_enrollment_status='enrolled'`), upserts into `student_onboarding`.
- For non-legacy users: calls `claim_beta_number` RPC and returns `{ beta_number, campus_beta_number, campus_name }`.
- For legacy users: returns `{ legacy: true, campus_name }`.

**Modified: `claim-free-beta`** — no change. Still redirects to `/my-dashboard`; onboarding modal triggers there.

### Frontend

**Modified: `src/pages/StudentDashboard.tsx`** (the real dashboard at `/my-dashboard`)
- On mount, fetch `student_onboarding` row for the user.
- If row missing OR `completed_at IS NULL` → show `<OnboardingModal />` blocking overlay (cannot dismiss; sign-out is the only escape).
- If row exists with `welcomed_at = null` AND `beta_number IS NOT NULL` → show one-time `<WelcomeCard />` celebration. Legacy users get the quieter legacy welcome.
- Replace existing "Continue where you left off" + "Chapters" sections with the new layout (top strip, welcome, beta tools, chapter cards).
- Fire `enroll-lw-background` once per session via `supabase.functions.invoke()` without `await`.

**New components** (`src/components/dashboard/`):
- `OnboardingModal.tsx` — 3-step wizard, controlled state, posts to `complete-onboarding`. Per-step validation; "Next" disabled until required fields filled.
- `GreekOrgSearch.tsx` — debounced search against `greek_orgs` filtered by `campus_id`, with "Add other" fallback.
- `BetaCountdownStrip.tsx` — shows days until 2026-05-15.
- `WelcomeCard.tsx` — beta number reveal + "Copy share link" (uses `navigator.clipboard`, share URL `https://learn.surviveaccounting.com/?ref={beta_number}`).
- `LegacyWelcomeCard.tsx` — quieter "Welcome back" card for legacy users.
- `BetaToolCards.tsx` — 3 tool cards (Practice Helper / JE Memorizer placeholder / Help Us Decide).
- `FeedbackToolModal.tsx` — textarea, posts to `chapter_questions`.
- `ChapterCardsGrid.tsx` — chapter grid (extracted from existing dashboard styling), links to `/cram/:chapterId`.

**Modified: `src/pages/CheckoutComplete.tsx`**
- If `session_id` confirmed and Supabase session exists → redirect to `/my-dashboard?just_paid=1`. Otherwise keep magic-link fallback.

**Modified: `src/pages/AuthCallback.tsx`**
- After session is set, fire-and-forget `enroll-lw-background`, then redirect to `next` param (default `/my-dashboard`).

### LW enrollment performance pattern

- **Login is never blocked on LW.** Frontend invokes `enroll-lw-background` and immediately navigates.
- The edge function returns 202 within ~50ms (kicks off work via `EdgeRuntime.waitUntil`).
- Dashboard surfaces a small "Course access syncing…" pill if `lw_enrollment_status='pending'`, polls once after 8s, disappears when 'enrolled'.

### Out of scope tonight
- Per-chapter LW course IDs (locked: stay course-level).
- Mapping chapter cards to dedicated video archive URLs (cards link to `/cram/:chapterId` which already shows videos — same destination).
- Building the actual JE Memorizer tool (placeholder only).
- Beta referral attribution from `?ref=N` (share link works; tracking is a follow-up).

---

## Files touched

**New**: 1 migration, 2 edge functions (`enroll-lw-background`, `complete-onboarding`), 8 components.
**Modified**: `StudentDashboard.tsx`, `CheckoutComplete.tsx`, `AuthCallback.tsx`. No new routes — onboarding is a modal on the dashboard.

Approve and I'll build it straight through.