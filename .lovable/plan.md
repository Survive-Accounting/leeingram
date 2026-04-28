# Speed Up the Walk-Me-Through Buttons

## What's actually slow (and what isn't)

Two buttons feel slow, but for different reasons:

| Button | What happens today | Why it feels slow |
|---|---|---|
| **"Walk me through this problem"** (initial red CTA) | Calls `explain-this-solution` edge function → OpenAI `gpt-5-mini` reasoning call → returns full JSON → renders Step (a) | Cold call to a reasoning model is 5–15s. Student stares at "Survive Accounting is thinking…" with zero progress. |
| **"Continue to part (b)"** / **"Back"** | Pure `setWalkStep(idx + 1)` — local React state | Already instant *after* the first call. The lag is just the visual "feel" — no transition, content swap is abrupt. |

So this is really a **first-call latency** problem plus a small **perceived-speed** problem on the step nav. Below are the quick wins, ordered by impact.

---

## Quick wins (tonight)

### 1. Prefetch the explanation in the background as soon as the problem loads
**Highest impact.** Right now we don't call `explain-this-solution` until the student clicks the red button. We can fire it silently when the Solutions Viewer mounts (or when the student scrolls past the problem text). By the time they click "Walk me through this problem," the cache is warm and the response is **instant**.

- Add a `useEffect` in `SolutionsViewerV2` that calls `ensureSections()` after a short idle delay (e.g. 1.5s after mount) — only if not already loading/loaded.
- Use the existing cache check on the edge function — repeat calls return immediately.
- Cost impact: identical to today, since 99% of clickers would have triggered it anyway. We can gate it to "only prefetch if the asset already has a cached explanation in the DB" to be even safer (zero new AI cost — pure cache reads).

### 2. Show progressive skeleton + "first step in ~5s" message instead of a spinner
A bare spinner with "thinking…" feels endless. Replace with:
- A 3-line shimmering skeleton sized like a real step (header + restate callout + content lines).
- Subtitle: *"Lee is unpacking part (a)… first step lands in a few seconds."*
- This makes the same 5–10s wait feel ~half as long (well-documented UX effect).

### 3. Make the Continue button feel instant with a micro-transition
Continue/Back are already local state — but the content swap is a hard cut, which reads as "did anything happen?" Add:
- A 120ms `fade-in slide-in-from-right-1` animation on the step body when `walkStep` changes (we already use this pattern elsewhere in the file).
- Optimistic checkbox tick on Continue (we already do this — keep it).
- Keep the "Continue to part (b)" button focused after click so keyboard users don't lose place.

### 4. Pre-warm the cache for *all* problems in the chapter (background job, optional)
For approved assets that don't yet have a `survive_solution_explanation_cache` with the new `walkthrough` shape, run a one-time bulk warm. After that, **every** "Walk me through this problem" click is a pure DB read (~100ms instead of 5–15s).

- Reuse the existing background-job pattern (batches of 10).
- Skip if `cache.sections.walkthrough` already exists.
- One-time spend, then permanently fast for every student.

### 5. Smaller win: switch `gpt-5-mini` → `gpt-5-nano` for the walkthrough call
`gpt-5-nano` is dramatically faster and cheaper, and the walkthrough output is short structured bullets — the lower reasoning depth is fine here. Worth A/B-ing on 5–10 problems first to confirm quality holds. (Skip if you'd rather not touch the model tonight.)

---

## What I would NOT change tonight

- **Streaming the AI response token-by-token.** OpenAI tool-calling responses don't stream usefully (the JSON has to be complete to parse). True streaming would require restructuring the prompt to emit one part at a time — bigger change, save for a later sprint.
- **The Back/Continue logic itself.** It's already a single `setState`. Nothing to optimize there beyond the visual transition in #3.

---

## Recommended order

1. **#1 Prefetch on mount** (biggest perceived win, ~10 lines of code)
2. **#2 Better skeleton + copy** (no perf change, but makes the unavoidable wait tolerable)
3. **#3 Micro-transition on Continue** (polish — makes the whole flow feel snappy)
4. **#4 Bulk pre-warm cache** (do once, benefits forever)
5. **#5 Model swap** (only if you want to)

## Files I'd touch

- `src/pages/v2/SolutionsViewerV2.tsx` — prefetch effect, skeleton, transition (items 1–3)
- `supabase/functions/explain-this-solution/index.ts` — model swap if doing #5
- New small bulk-warm script or one-off button in admin for #4

Want me to ship 1+2+3 right now and leave 4 and 5 for a follow-up?
