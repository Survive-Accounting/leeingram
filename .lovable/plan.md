# Free Beta Checkout — Reframe `/get-access` as Beta Claim

Reposition the checkout page as **free beta access** while anchoring the future $250 price. After the student claims, log them in and send them straight to `/my-dashboard`.

## 1. New edge function: `claim-free-beta`

Create `supabase/functions/claim-free-beta/index.ts` that handles the no-payment flow (parallel to `stripe-webhook`'s post-purchase steps):

- Accepts `{ email, campus?, course?, earlyBirdOptIn?, origin? }`
- Resolves `campus_id` and `course_id` (default course slug: `intro-accounting-2`)
- Upserts `students` row
- Inserts `student_purchases` with:
  - `purchase_type: "free_beta"`
  - `expires_at: 2026-05-16T23:59:59Z` (Spring '26 finals)
  - `price_paid_cents: 0`
  - `stripe_session_id: free-beta-{random}` (uniqueness)
  - Skipped if an active purchase already exists for that email + course
- Logs `free_beta_claimed` event in `student_events` (records `early_bird_opt_in` flag)
- Marks matching `student_emails` rows as `converted: true`
- Ensures Supabase auth user exists (`createUser` with `email_confirm: true`)
- Generates a magic link via `auth.admin.generateLink({ type: "magiclink" })` with `redirectTo = /auth/callback?next=/my-dashboard?free_beta=1`
- Returns `{ ok: true, magicLink }`

The client navigates to that magic link → `/auth/callback` establishes the session → user lands on `/my-dashboard` already signed in.

## 2. Rewrite checkout card in `src/pages/GetAccess.tsx`

Keep the existing layout, light-blue background, premium card, red CTA, and price-pulse animation. Only swap copy + remove now-irrelevant pricing controls for the beta state.

**Hero section (above the card):**
- H1: "Your exam is coming up." (unchanged)
- Subhead: "Join the free beta and get access through your Spring '26 final exams."
- Small line below: "Regular semester access will be $250 after beta."

**Card header row:**
- Replace "Finals Week Pricing" badge → **"FREE BETA"** (red pill, same style)
- Replace "Secure Checkout" → **"Create Your Free Beta Pass"**
- Remove "Powered by Stripe" line entirely (Stripe is not used in this flow)

**Price box (top-right):**
- Big number: **$0** (keep navy, shimmer, pulse animation)
- Sub-label under $0: **"FREE BETA ACCESS"** (replaces "One-time payment")
- Small line below: **"Regularly $250 / semester"** (gray strikethrough style)
- Remove the promo code UI and `autoRenewActive` "$25 applied" badge for this state

**Product section:**
- Name: **"Survive Study Pass — Free Beta"**
- Keep email display
- Keep: "🔒 One account per student"

**Access section:**
- Label: **ACCESS** (unchanged)
- Main line: **"Free beta access through your Spring '26 final exams"**
- Description: **"Use it as much as you want while beta access is open."**
- Add note (small, muted): **"After beta, semester access will be $250. You'll only pay if you choose to renew."**
- Replace the "Continue next semester (save $25)" checkbox with:
  > **"Send me early-bird discounts for Summer/Fall '26 access"**
  
  This is a pure email-list opt-in; no auto-renewal language. Default unchecked.

**CTA button:**
- Text: **"Get Free Beta Access →"**
- Loading state: "Setting up your beta access..."

**Trust line (bottom):**
- **"Free beta · No credit card required · Instant access"**
- Replaces the 7-day refund guarantee line (refund makes no sense at $0)

## 3. New `handleClaimBeta` handler (replaces `handleCheckout`)

In `GetAccess.tsx`:

```ts
const handleClaimBeta = async () => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) { requestAccess({}); return; }
  setCheckoutLoading(true);
  setCheckoutError(null);
  try {
    const { data, error } = await supabase.functions.invoke("claim-free-beta", {
      body: {
        email: cleanEmail,
        campus: campusParam || null,
        course: courseParam || null,
        earlyBirdOptIn,
        origin: window.location.origin,
      },
    });
    if (error) throw error;
    const magicLink = (data as any)?.magicLink as string | null;
    if (magicLink) {
      window.location.href = magicLink;     // → /auth/callback → /my-dashboard
    } else {
      navigate("/my-dashboard?free_beta=1"); // fallback if email send pipeline failed
    }
  } catch (err) {
    setCheckoutError("We couldn't set up your beta access. Please try again.");
    setCheckoutLoading(false);
  }
};
```

Replace the old `autoRenew` checkbox state with `earlyBirdOptIn`. Drop the now-unused promo code, extra-semester, lifetime-upgrade, and price-pulse-on-toggle code paths for this beta state — leave the static pulse animation in place since the price never changes (just renders once).

## Files touched

- **NEW:** `supabase/functions/claim-free-beta/index.ts`
- **EDITED:** `src/pages/GetAccess.tsx`

No DB migrations needed — `student_purchases` already supports arbitrary `purchase_type` and `price_paid_cents: 0`. No new secrets needed (uses existing service role key + Supabase auth admin).

## What's intentionally NOT changed

- The page background, navbar, founding-student banner, alias testing banner, testimonials section, footer
- The Stripe-based `create-get-access-checkout` edge function (left in place — it'll be reused after beta ends)
- LearnWorlds enrollment is **not** triggered in this beta flow (LW seats cost money; we'll enroll on actual purchase). Free beta access flows through Survive Accounting's own `/my-dashboard` and the existing `useAccessControl` hook, which checks `student_purchases` regardless of LW status.
