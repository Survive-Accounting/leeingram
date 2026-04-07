# Survive Accounting — Codebase Context for Claude
*Inject into Lovable so Claude always knows what's being built*
*Last updated: April 7, 2026*

---

## What This Is

Survive Accounting is an accounting exam prep platform built for Ole Miss students by Lee Ingram, tutor since 2015. Built on React + TypeScript + Vite + shadcn/ui via Lovable.dev. Backend is Supabase. Course delivery via LearnWorlds at player.surviveaccounting.com.

**Live app:** learn.surviveaccounting.com
**Admin panel:** learn.surviveaccounting.com/admin
**Greek portal:** greek.surviveaccounting.com

---

## Critical Rules — Always Follow

### AI / API
- Always call Anthropic API **directly** at `api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-20250514`
- Auth: `x-api-key` header + `anthropic-version: 2023-06-01`
- Response text: `data.content[0].text`
- **NEVER use Lovable AI gateway or LOVABLE_API_KEY** — 6-10x more expensive
- API key stored in Supabase secret: `ANTHROPIC_API_KEY`

### Design System
- Navy: `#14213D` (primary background, headers)
- Red: `#CE1126` (accent, CTAs, calculation lines)
- Body font: Inter
- Display/formula font: DM Serif Display
- Component library: shadcn/ui + Tailwind
- Never introduce new color values without checking against these

### Naming Conventions
- "Explanation" not "Solution" — everywhere in UI labels
- "Refresher Quizzes" not "Quizzes" in LW context
- "Survive Company A" not "ABC Corp" in problem text
- Asset type order: BE/QS → EX → P
- Tab labels: IA1/IA2 = "Brief Exercises", Intro1/2 = "Quick Studies"

### Access Control
- Lee-level admin: full access to all pages
- VA admin: access to Content section only
- Restricted pages show popup modal — never hide nav items
- Popup: "Access Restricted — Message Lee on Slack if you'd like access."

---

## Data Model — Key Tables

### Core Content
```
teaching_assets          — 2,531 practice problems
  asset_code             — e.g. IA2_CH13_BE001_A
  chapter_id             — FK to chapters
  problem_text           — student-facing problem
  instructions           — lettered parts (a)(b)(c)
  solution_text          — explanation/calculation steps
  je_data                — jsonb array of JE lines
  important_formulas     — legacy, being replaced
  status                 — 'approved' | 'pending' | etc
  reviewed_clean         — boolean, QA pass
  reviewed_issues        — boolean, QA flag
  fix_notes              — text, audit trail for fixes

chapters                 — 47 chapters across 4 courses
  chapter_id, chapter_number, chapter_name, course_id
  topics_locked          — boolean

courses                  — 4 courses
  ACCY 201 (Intro 1), ACCY 202 (Intro 2)
  ACCY 303 (IA1), ACCY 304 (IA2)
```

### Chapter-Wide Content (new as of Session 7)
```
chapter_formulas         — curated formula set per chapter
  formula_name, formula_expression, formula_explanation
  image_url              — generated via htmlcsstoimage.com
  is_approved, is_rejected, sort_order

chapter_je_categories    — category groups for chapter JEs
  category_name, sort_order, chapter_id

chapter_journal_entries  — master JE list per chapter
  transaction_label, je_lines (jsonb), category_id
  source                 — 'extracted' | 'suggested'
  is_approved, is_rejected, sort_order

chapter_accounts         — accounts used in chapter
  account_name, account_type, normal_balance
  account_description, sort_order
  source                 — 'extracted' | 'suggested'
  is_approved, is_rejected

chapter_key_terms        — 6-10 terms per chapter
  term, definition, sort_order, is_approved

chapter_exam_mistakes    — top 3 ranked mistakes
  mistake, explanation, sort_order (1=dangerous, 2=common, 3=subtle)
  is_approved

chapter_purpose          — why this chapter matters
  purpose_bullets        — jsonb array, max 3
  consequence_bullets    — jsonb array, max 2
  is_approved
```

### Student & QA
```
chapter_questions        — student reports + feedback
  issue_type             — 'issue' | 'feedback' | 'question' | 'quiz_feedback'
  question_text, email
  responded, responded_at, respond_by_at

students                 — student accounts (auth sprint pending)
student_purchases        — access records

sms_discount_log         — Twilio rate limiting (24hr)
```

---

## Edge Functions (Supabase)

| Function | Purpose |
|---|---|
| generate-chapter-formulas | Generate formulas per chapter via Claude |
| generate-chapter-journal-entries | Extract JEs from assets, Claude enriches |
| generate-chapter-content-suite | All content types in one batch call |
| generate-formula-images | htmlcsstoimage.com at 2x DPR |
| send-fix-email | Resend — notify student their issue was fixed |
| send-discount-sms | Twilio — $125 link via SMS (pending) |

---

## Routes

### Student-Facing
```
/solutions/:assetCode    — Solutions Viewer
/cram/:chapterId         — Survive This Chapter hub
/quiz-question/:id       — Quiz iframe
/quiz-choice/:id/:n      — Quiz choice iframe
/quiz-explanation/:id    — Deep Explanation iframe
/quiz-start/:topicId     — Quiz start iframe
/quiz-end/:topicId       — Quiz end iframe
/quiz-rating/:topicId    — Feedback iframe
/login                   — Magic link login (pending)
/auth/callback           — Auth callback (pending)
/dashboard               — Student dashboard (pending)
/ole-miss/:courseCode    — Course landing page (pending)
```

### Admin
```
/admin                   — Admin dashboard
/admin/chapter-qa        — Chapter content QA (Lee only)
/admin/analytics/launch  — Launch analytics placeholder
/admin/analytics/content — Content analytics placeholder
/admin/landing-pages     — Placeholder (auth sprint)
/admin/auth              — Placeholder (auth sprint)
/admin/greek             — Placeholder (Greek portal)
/admin/legacy-links      — Legacy nav links
/solutions-qa            — Individual asset QA tool
```

---

## Solutions Viewer — Right Column Order

1. Explanation (was "Solution")
2. Journal Entries (if present on asset)
3. Ch [N] — Journal Entries (chapter master list)
4. Ch [N] — Important Formulas (image flashcards)
5. Ch [N] — Accounts
6. Ch [N] — Key Terms
7. Key Concepts
8. Exam Traps

All chapter-wide accordions: visible to ALL visitors (free + paid).
Solution/JE content: paywalled.

---

## Survive This Chapter — Section Order

1. Header
2. What's the Point? (chapter_purpose bullets)
3. Chapter Tools cards
4. Topic accordion (if topics_locked + lw_quiz_url)
5. Accounts in This Chapter (chapter_accounts)
6. Key Terms (chapter_key_terms)
7. Formulas (chapter_formulas image flashcards)
8. Journal Entries — Ch [N] (chapter_journal_entries)
9. Solutions Library (tabs: BE/QS | EX | P)
10. Journal Entries to Memorize (per-asset flashcards)
11. Common Exam Mistakes (chapter_exam_mistakes)
12. How to Solve (flowchart accordion)
13. Ask Lee
14. About Lee

---

## Image Generation — Formula Cards

- Service: htmlcsstoimage.com
- Size: 800×400px, device_pixel_ratio: 2 (outputs 1600×800)
- Background: #14213D
- Formula name font: DM Serif Display, 28px, white
- Expression font: Inter monospace, 22px, #CE1126
- Explanation font: Inter, 14px, rgba(255,255,255,0.65)
- Logo footer: lwfiles CDN URL, bottom-right, opacity 0.7

---

## Chapter JE + Accounts Generation Rules

**Always extract from real data first:**
1. Query teaching_assets where chapter_id matches AND je_data IS NOT NULL AND status = 'approved'
2. Extract unique JE structures (account names + debit/credit sides)
3. Send to Claude for enrichment only — Claude categorizes, labels, writes tooltips
4. Claude must use EXACT account names from extracted data — never rename
5. Claude may suggest missing entries — these get source = 'suggested'

**Fallback:** If 0 approved assets found, full AI generation with warning banner

**Contra account detection:**
- Flag as contra: Discount on Bonds Payable, Discount on Notes Payable, Allowance for Doubtful Accounts, Accumulated Depreciation, Accumulated Amortization, Treasury Stock, Sales Returns and Allowances, Sales Discounts
- NEVER flag as contra: Unearned Revenue, Unearned Sales Revenue, Premium on Bonds Payable, any account starting with "Unearned" or "Deferred"

---

## Admin Sidebar Structure

```
LAUNCH (Lee only)
  Campus Landing Pages → /admin/landing-pages
  Auth & Payments      → /admin/auth
  Greek Portal         → /admin/greek
  Launch Analytics     → /admin/analytics/launch

CONTENT
  Problem Library      → Teaching Assets
  Content Analytics    → /admin/analytics/content
  ▾ Quality Control
      Asset QA         → /solutions-qa
      Fix Assets       → Asset Page Fixer + Bulk Fix
      QA Costs
  ▾ Chapter Wide (Lee only)
      Chapter QA       → /admin/chapter-qa
      Chapter Content
  ▾ Quizzes
      Generate
      Quiz Queue
      Deployment

ADMIN
  VA Admin
  Payment Links
  ▾ Settings
      Asset Stats
      Legacy Links     → /admin/legacy-links
```

All nav items visible to all admins. Restricted pages show popup on access attempt.

---

## Pricing & Access

- Semester Pass: $125 (was $250)
- Chapter Pass: $30
- Finals Special: $99 (hidden, direct link)
- Access expiry: 2026-05-16T23:59:59
- Student auth: pending (magic link via Supabase)

---

## External Services

| Service | Key/Secret name | Purpose |
|---|---|---|
| Anthropic | ANTHROPIC_API_KEY | All AI generation |
| htmlcsstoimage.com | HCTI_USER_ID, HCTI_API_KEY | Formula images |
| Resend | RESEND_API_KEY | Email from lee@mail.surviveaccounting.com |
| Twilio | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN | SMS widget |
| Stripe | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Payments (pending) |

---

## What's Being Built Next

1. Student auth sprint (magic link + Stripe + access control)
2. Course landing pages /ole-miss/:courseCode
3. Greek portal (April 20 deadline)
4. Twilio SMS widget on all paywall cards

Do not suggest alternatives to these — they are locked decisions.
