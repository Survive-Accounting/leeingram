# Onboarding Cleanup Plan

Refactor the 3-step `OnboardingModal` so it only asks what we genuinely don't know, captures full name, defers syllabus to the dashboard, and lets admins skip through during testing.

## What changes

### 1. Step 1 — "Let's get you set up"

**Name field**
- Replace "Your first name" with **"Your full name"** (single field, required).
- Placeholder: `e.g. Lee Ingram`.
- Prefill from existing `prefillName` if present.
- Saved into `display_name` on submit (no schema change — we already store full display name).

**Campus field — conditional on what we know**
- If `prefillCampusId` resolves to a real campus (i.e. .edu domain matched something other than Catch-All): **hide the campus picker entirely.** Show a small confirmation line instead, e.g. `Campus: University of Mississippi` with a tiny "Not right?" link that reveals the dropdown.
- If `prefillCampusId` is null OR resolves to the Catch-All ("general") campus: show an **optional free-text "Your campus"** input (keeps current `campus_write_in` behavior). Label it `Your campus (optional)` with hint "We'll get this cleaned up later."
- Drop the required campus dropdown for the non-.edu path — we never want to block someone here.

**Syllabus field**
- Remove from Step 1 entirely. We'll surface it later as a dashboard prompt card (separate follow-up — not part of this change beyond removal here).

### 2. Steps 2 & 3
- No structural changes. Keep major question, Greek question, confidence slider.

### 3. Admin skip (testing helper)

For staff users (detected via existing `useIsStaff()` hook):
- Show a small **"Admin: skip step →"** link in the modal footer next to Back, on every step.
- Clicking it advances to the next step without validation. On step 3, it submits with safe defaults (name = prefill or "Admin Test", campus = whatever's prefilled, major = "no", inGreek = false, confidence = 5).
- Link is hidden for non-staff. Styled subtle gray, not a primary action.

### 4. Validation tweak

`canAdvance` for step 1 becomes:
- Name required (non-empty after trim).
- Campus is **never** required (either we already know it, or it's optional write-in).

## Technical notes

**Files to edit**
- `src/components/dashboard/OnboardingModal.tsx` — main refactor
- `src/pages/StudentDashboard.tsx` — no functional change; `prefillName` source could broaden to full name later but not blocking
- `supabase/functions/complete-onboarding/index.ts` — already accepts `campus_other` and `display_name`, so no edge function change needed

**Logic for "known campus"**
```ts
const knownCampus = prefilledCampus && prefilledCampus.slug !== CATCH_ALL_SLUG;
// knownCampus → hide picker, show confirmation
// !knownCampus → show optional write-in (current isCatchAll path, but also for null)
```

**Admin skip**
```ts
const isStaff = useIsStaff();
// In footer, conditional link:
//   onClick: if (step < 3) setStep(step+1); else handleSubmit() with defaults
```

**No DB migration required.** All fields already exist; we're just collecting fewer of them up front.

## Out of scope (future)
- Building the dashboard "Upload your syllabus" prompt card — flagged for a follow-up message.
- Cleaning up `campus_other` write-ins into real campus records — manual admin task.
