# Solutions V2 Helper Buttons — Diagnosis & Fix Plan

## What's broken

All four toolbox buttons on Solutions V2 (Walk me through it, Hint, Setup, Full solution) appear to do nothing meaningful. The button toggles open, briefly shows the loading spinner, then collapses back to empty — and clicking again re-triggers the spinner with the same empty result.

## Root cause (confirmed)

**Field name mismatch between the edge function and the client.**

The `survive-this` edge function (`supabase/functions/survive-this/index.ts`) returns:

```
{ success: true, cached, response_text, prompt_type }
```

But `src/pages/v2/SolutionsViewerV2.tsx` reads `data.response` in two places:

- Line 786 (background prefetch for "walk_through")
- Line 841 (`handleToolboxClick`, all four buttons)

```
setResponses((p) => ({ ...p, [key]: data.response || "" }));
```

`data.response` is `undefined` for every successful call, so the stored value falls back to `""`. The render branch is:

```
responses[activeSection] ? <InlineResponseBlock ... /> : null
```

`""` is falsy → nothing renders. On the next click `responses[key]` is also falsy, so the fetch fires again with the same empty result. The cache write on the server side does succeed, so the cached row is correct — only the client display is broken.

The companion `simplify-problem` edge function uses `data.simplified_text` and the client reads `data.simplified_text` — that path is fine. PDF print still works.

This is a recent regression: the field on the server was renamed to `response_text` (consistent with the `response_text` column in `survive_ai_responses`), but the V2 viewer was never updated.

## Fix

Single-file change in `src/pages/v2/SolutionsViewerV2.tsx`:

1. Line 786 — change `data.response` → `data.response_text`
2. Line 841 — change `data.response` → `data.response_text`
3. Line 840 — `if (!data?.success) throw new Error(data?.error || "No response");` — keep, but also guard against empty `response_text` so a future regression is loud instead of silent.

No edge-function changes, no DB changes. The four buttons share the same handler, so one fix restores all of them. Cached rows already in `survive_ai_responses` will start displaying immediately.

## Confirmation of which prompt powers each button

All four buttons hit `survive-this` with a `prompt_type` defined in `buildUserPrompt` (lines 27-264 of `supabase/functions/survive-this/index.ts`). Mapping:

| Button (UI label) | `prompt_type` sent | Prompt purpose |
|---|---|---|
| Walk me through it | `walk_through` | Step-by-step, one step at a time, max 6 steps; ends with "Ready for step 2?" |
| Hint | `hint` | Single nudge, no calculations, max 3 sentences |
| Setup | `setup` | Empty worksheet/scaffold + one rule + one target sentence; does NOT solve |
| Full solution | `full_solution` | One-line method + HTML solution table with totals row + 2 follow-up sentences |

System prompt (shared, lines 9-25): Lee persona — HTML tables only (never markdown pipes), `<strong>` for bold, ≤180 words (≤80 with a table), second-person tutor voice, no "Great question!" filler, model `o3` with `max_completion_tokens: 2000`.

The viewer also has additional prompt types defined server-side that aren't wired to the four main buttons but exist for other surfaces: `challenge`, `challenge_followup`, `similar_problem`, `memorize`, `journal_entries`, `financial_statements`, `real_world`, `professor_tricks`, `the_why`, plus the legacy `strategy`.

## Verification after the fix

1. Open Solutions V2 on any approved asset.
2. Click each of the four buttons in turn — each should reveal a formatted response within ~1-3 seconds (or instantly if cached).
3. Re-click a button — it should toggle closed, not refetch.
4. Switch to a second asset and back — responses should reset and reload from cache instantly.

If a button still fails after the fix, the network/console error will now surface (the empty-response guard added in step 3) and the existing user-facing error message ("Lee's tools are taking a breather…") will appear.
