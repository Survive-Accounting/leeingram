# Greek Organization Portal — Architecture

## Overview

A self-service licensing portal that allows Greek organizations to purchase semester study passes for their members and manage access to Survive Accounting courses.

**URL**: `greek.surviveaccounting.com`
**Repository**: Separate Lovable project
**Database**: Same Supabase instance as main app (shared)
**Status**: Foundation built, migrations pending (as of March 2026)

---

## Why Separate Project

The Greek portal has a distinct audience (org admins, not Lee's VAs), different auth model (magic link only), and public-facing org pages. It connects to the same Supabase but lives at its own domain.

---

## User Roles

| Role | Access | Auth |
|---|---|---|
| Super Admin (Lee) | `/admin` — everything | Magic link |
| Org Admin | `/org/[org_slug]` — their org only | Magic link |
| Public | `/[org_slug]` — landing page | No auth |

---

## Routes

| Route | Page | Auth Required |
|---|---|---|
| `/` | Home/Landing | No |
| `/login` | Magic link login | No |
| `/auth/callback` | Post-login redirect handler | No |
| `/admin` | Super admin dashboard | Lee only |
| `/org/:orgSlug` | Org admin dashboard | Org admin |
| `/:orgSlug` | Public org landing page | No |

---

## Auth — Magic Link Only

No passwords. Supabase `signInWithOtp`.

Post-login redirect logic (in `/auth/callback`):
1. Check email against `greek_org_admins` → redirect to `/org/[slug]`
2. Check email against `VITE_ADMIN_EMAIL` → redirect to `/admin`
3. Neither → show "No account found" error

---

## Database Tables

All tables live in the shared Supabase instance.

### `greek_organizations`
One row per chapter per campus.

Key fields: `org_slug`, `org_name`, `org_letters`, `org_type`, `council`, `campus`, `campus_slug`, `university_full`, `is_active`, `is_public`

Slug format: `[letters]-[campus]` e.g. `kappa-delta-ole-miss`

### `greek_licenses`
One row per semester purchase.

Key fields: `org_id`, `semester`, `seats_purchased`, `seats_used`, `price_paid_cents`, `stripe_payment_intent_id`, `lw_coupon_code`, `status`, `expires_at`, `rollover_seats`

### `greek_org_admins`
One or more admins per org (president, academic chair, advisor).

Key fields: `org_id`, `email`, `name`, `title`, `is_primary`, `supabase_user_id`

### `greek_members`
One row per member who claims a seat.

Key fields: `org_id`, `license_id`, `email`, `lw_user_id`, `lw_tag`, `status`, `seat_claimed_at`, `lw_enrolled_at`

---

## Pricing — Semester Study Passes

| Passes | Price | Per Pass |
|---|---|---|
| 10 | $1,500 | $150 |
| 20 | $2,600 | $130 |
| 30 | $3,600 | $120 |
| 40 | $4,400 | $110 |
| 50 | $5,000 | $100 |

Recommended tier badge: 20 passes.

---

## Seat Cap Enforcement

When seats are full, new member signups show:
> "Kappa Delta's passes are full. Contact [exec name] at [phone] to add more."

SMS alert sent to exec (via Twilio) when last seat is claimed.

---

## LearnWorlds Integration

On purchase:
1. Auto-generate LW coupon code via LW API
2. Store in `greek_licenses.lw_coupon_code`
3. Signup link: `learn.surviveaccounting.com/?coupon=[CODE]`

When member signs up via coupon link:
- LW tags them with org tag
- LW tag webhook fires → decrement `seats_used`

When member is removed:
- Unenroll via LW API
- LW tag removed → webhook fires → increment `seats_used` (seat returns to pool)

---

## Rollover Seats

Unused seats at semester end → discount coupon for next purchase.

Stored in `greek_licenses.rollover_seats`.

---

## Multi-Campus Ready

Slug format supports multi-campus from day one:
- `kappa-delta-ole-miss`
- `kappa-delta-alabama`
- `kappa-delta-auburn`

Each campus is a separate org record, separate license, separate admin.

---

## Seeded Organizations — Ole Miss

26 Ole Miss Greek orgs pre-seeded (`is_active = false`, `is_public = true`):

**IFC Fraternities (17)**: Alpha Tau Omega, Beta Theta Pi, Chi Psi, Delta Kappa Epsilon, Kappa Alpha Order, Kappa Sigma, Lambda Chi Alpha, Phi Delta Theta, Phi Kappa Psi, Pi Kappa Alpha, Pi Kappa Phi, Sigma Alpha Epsilon, Sigma Chi, Sigma Nu, Sigma Phi Epsilon, Sigma Pi, Theta Chi

**Panhellenic Sororities (9)**: Alpha Delta Pi, Alpha Omicron Pi, Chi Omega, Delta Delta Delta, Delta Gamma, Kappa Delta, Kappa Kappa Gamma, Phi Mu, Zeta Tau Alpha

---

## Shared Services (from Main App)

- **Resend**: `RESEND_API_KEY` already in Supabase secrets — send from `lee@mail.surviveaccounting.com`
- **Stripe**: Use test keys first, switch to live before finals week
- **Supabase**: Same instance, no sync needed

---

## Two-Week Launch Plan (April 20 Pilot Target)

**Week 1**:
- Day 1–2: Foundation + DB live ✅
- Day 3: Stripe checkout
- Day 4: LearnWorlds API (coupon generation, enrollment)
- Day 5: Seat cap + Twilio SMS alert

**Week 2**:
- Day 6–7: Member management, LW tag webhooks, unenroll flow
- Day 8: Org admin invite flow, rollover pass calculation
- Day 9: All 26 org pages live, end-to-end test
- Day 10: Demo prep, Loom walkthrough

---

## Prompts Still to Build

1. Stripe checkout + webhook handler
2. LW coupon auto-generation on purchase
3. Seat cap enforcement + Twilio SMS
4. LW tag webhook receiver (tag added/removed)
5. Member unenroll via LW API
6. Org admin magic link invite flow
7. Rollover pass calculation
8. Activity dashboard (study time from `asset_events`)
