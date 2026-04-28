# Survive This Panel — Beta Prompt System Build

## My honest review of the off-platform prompts

The plan is **mostly solid and well thought through**. It captures the right end state: 5 primary buttons, an Explore section, vote badges, distinct AI prompts per button, table-aware HTML rendering, and a Challenge follow-up loop. A few things I want to flag before we build, because they'll either break or cause subtle bugs:

### Issues that need fixing before we ship

1. **Wrong model in the off-platform spec.** It says "keep `o3`" but the actual edge function uses `gpt-5-mini`. We keep what's there — `gpt-5-mini` — and don't touch the model.

2. **`max_completion_tokens: 500` is too low** for the new prompts. Tables, Full Solution, Walkthrough Step 1, Financial Statements, and Professor Tricks (3-4 traps × 3 sentences each) will all truncate at 500 tokens, especially since `gpt-5-mini` is a reasoning model that burns tokens internally before emitting output. Bump to **2000** to match what `explain-this-solution` learned the hard way (we hit truncation issues there at lower limits — see code comment in that function). Not a model change, just a ceiling change.

3. **Prompt-key mismatch.** UI uses `journal_entries` (plural). Edge function case is `journal_entry` (singular). The spec correctly maps them in the UI's `promptTypeMap`, but we have to make sure both ends actually agree. We'll standardize on **`journal_entries`** everywhere (the existing UI key) and use the same in the edge function — no mapping layer needed. Cleaner and one less footgun.

4. **`dangerouslySetInnerHTML` + AI output is risky.** `gpt-5-mini` will occasionally return `<script>` or weird inline event handlers. We need to sanitize before injecting. We'll use **`DOMPurify`** (already a tiny dep, common in this codebase pattern). I'll add it if not installed.

5. **`skip_cache` write behavior.** The spec says "skip_cache should ONLY bypass read, still write." That's correct — but every challenge follow-up writes a row keyed on `(asset_id, prompt_type)`. If there's a unique constraint on that pair, the second submission will fail. We need to either: (a) include `student_answer` hash in the key, or (b) not save follow-ups at all. **Recommendation: don't cache challenge follow-ups** — they're per-student, per-attempt, and have no replay value. Just write to a separate `survive_challenge_attempts` table OR skip the write entirely. Simplest path: **skip the write** for `challenge_followup`.

6. **Vote badges from `helpful_count`.** That column is per-row, not aggregated by `prompt_type`. To show a badge per Explore button we need to **sum `helpful_count` across all rows for that `(asset_id, prompt_type)`**, OR display it for the single cached row that exists for this asset. Since the edge function caches one row per `(asset_id, prompt_type)`, in practice there's exactly one row per pair → we just read its `helpful_count`. Easy.

7. **Email gate logic** — the spec says "preserve as-is." Confirmed there's an email gate in `ResponseView` we won't touch.

8. **Prompts reference inventory-specific steps** ("Build the layers table", FIFO/LIFO etc.). These are written for one chapter. We need to **strip the inventory-specific examples** from the prompts and let the AI infer steps from the actual problem. Otherwise students on other chapters get nonsense. I'll generalize the step examples in the system prompt while keeping the structural rules (numbered steps, one at a time, soft prompt to continue).

9. **System prompt is being rewritten too.** The off-platform spec keeps the existing `SYSTEM_PROMPT` "exactly as-is" but then provides a rich new one in the second document. We should adopt the new system prompt (it's much better — sets voice, table rules, plain-english-first). I'll merge it in.

10. **Suggest-your-own-idea writes to `activity_log`.** I need to verify that table exists and what columns it has. If it doesn't, we either create it or write to a more appropriate place. I'll check during build.

### Things I'd skip or defer

- **"Check My Work" button** in the prompt library — not in any of the 3 prompts. Skip for tonight; it's a separate feature that needs its own UI (input for student work + correct answer detection). Add to backlog.
- **The `.ai-table` CSS with white/transparent colors** — that's for a dark panel. The actual `SurviveThisPanel` is white. I'll use the dark navy text version from Prompt #1 instead.

---

## What we'll build, in order

### Step 1 — Edge function (`supabase/functions/survive-this/index.ts`)

- Replace `SYSTEM_PROMPT` with the new "Lee" system prompt (warm, HTML tables only, plain-english-first, <180 words).
- Replace `buildUserPrompt` with all 13 cases: `walk_through`, `hint`, `setup`, `full_solution`, `challenge`, `challenge_followup`, `similar_problem`, `memorize`, `journal_entries`, `financial_statements`, `real_world`, `professor_tricks`, `the_why`. Keep existing `strategy` as fallback.
- Generalize the inventory-specific step lists to "fit the problem type" guidance.
- Bump `max_completion_tokens` from 500 → **2000**.
- Read `skip_cache` from body. When `true`: skip the cache lookup AND skip the cache write (specifically for `challenge_followup` use case — avoids unique-constraint conflicts and per-student row pollution).
- Keep CORS, Deno.serve wrapper, model (`gpt-5-mini`), and `survive_ai_responses` table writes for non-skipped types unchanged.

### Step 2 — UI (`src/components/SurviveThisPanel.tsx`)

- Update `PromptKey` to the 14 keys (drop `study_strategy`/`how_to_solve`/`formulas`/`exam_traps`, add the new ones, keep `about_lee` + `request_video`).
- Add `PROMPT_LABELS` mapping.
- Replace `MenuView` (the 7-card grid) with `PrimaryButtons`:
  - Row 1: "🚀 Walk me through it" — full-width red CTA (`#CE1126`)
  - Row 2: 2-col grid — "💡 Give me a hint" | "📄 Show the setup"
  - Row 3: 2-col grid — "✅ Full solution" | "⚡ Challenge me"
  - Below: 1px divider
  - **Explore section** (collapsed by default) — "VOTE ON IDEAS" toggle row + 8 explore buttons each with vote badges + "+ suggest your own idea" textarea link
- Vote badges: on mount, query `survive_ai_responses` for this `asset_id` filtered to the 8 explore prompt_types, map `helpful_count` per type, render in the pill. Optimistically increment when student gives 👍.
- Suggest-your-own-idea: small inline textarea (max 120 chars) → write to `activity_log` (verify table during build; if missing, fall back to a toast + `console.warn` rather than break).
- `ResponseView` updates:
  - Drop the `promptTypeMap` indirection — UI key === edge prompt_type now.
  - HTML detection: `/<(table|strong|ul|ol|li|br|h[1-6]|div|span)\b/.test(text)`.
  - When HTML: prepend the inline `<style>` table CSS (navy/light variant) and render via `dangerouslySetInnerHTML` **after running through `DOMPurify.sanitize`**.
  - Otherwise render as plain pre-wrap text (existing behavior).
- Header in `ResponseView`: show `PROMPT_LABELS[promptKey]` instead of the key.

### Step 3 — Challenge follow-up

- Add `challengeAnswer`, `challengeLoading`, `challengeFeedback` state in `ResponseView`.
- When `promptKey === "challenge"` AND main response is loaded (not loading, no error, response present): render the textarea + Submit button block under the response and above the rating bar.
- `submitChallengeAnswer`: call `supabase.functions.invoke("survive-this", { body: { asset_id, prompt_type: "challenge_followup", context: { ..., student_answer, original_response: responseText }, skip_cache: true } })`.
- Render `challengeFeedback` with the same HTML-aware sanitized renderer.
- Add "Try another challenge →" button that resets state and re-fires the original challenge prompt.

### Step 4 — Verify & ship

- Add `dompurify` if missing (`bun add isomorphic-dompurify` or `dompurify` + types).
- Type-check (`tsc --noEmit`).
- Deploy edge function.
- Smoke-test 3 prompt types (one HTML-table, one prose, one challenge → follow-up) via curl_edge_functions.

---

## Files I'll touch

- `supabase/functions/survive-this/index.ts` — full prompt rewrite + skip_cache
- `src/components/SurviveThisPanel.tsx` — full UI restructure
- (maybe) `package.json` — add `dompurify`

## What I will NOT touch

- The model (`gpt-5-mini` stays)
- `VideoRequestView`, `AboutLeeView`, `FloatingButton`, drag-to-detach
- The email gate in `ResponseView`
- The cache write logic for non-`challenge_followup` prompt types
- The `survive_ai_responses` schema or the rating logic

---

**Two quick decisions for you before I start building:**

1. **Confirm the model swap is off the table.** Off-platform spec said `o3`; we're keeping `gpt-5-mini`. OK?
2. **Confirm: don't cache `challenge_followup` rows at all** (skip the write). Per-student answers are noisy and hit unique-constraint risk. OK to skip?

If both yes, I'll execute Steps 1–4 in sequence.
