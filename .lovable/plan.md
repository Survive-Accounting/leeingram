
# Bite-Sized "Walk Me Through It" — One Part at a Time

## The Goal

Big multi-part word problems are overwhelming. Today, "Walk me through this problem" dumps the entire solution at once. We'll generate it once in the background, but **deliver it one part at a time** with a "Continue to part (b) →" button. Students can also choose **"Show me everything"** to dump the full thing if they want.

This makes a 5-part problem feel like 5 small, winnable steps instead of one wall of text.

---

## Approach

### 1. Restructure the AI output (the key unlock)

Today `how_to_solve` is one markdown blob. We change the edge function `explain-this-solution` to return a structured `walkthrough` array — one entry per instruction part:

```json
{
  "walkthrough": [
    { "part": "a", "title": "Calculate gross profit", "content": "..." },
    { "part": "b", "title": "Net amount to settle invoice", "content": "..." },
    ...
  ]
}
```

The AI generates **all parts at once** in a single call (same cost as today — no extra API hits). We just ask it to split by instruction letter. Caching stays the same (whole asset cached once).

Backwards-compatible: keep `how_to_solve` (the legacy markdown blob) as a fallback so existing cached rows still render.

### 2. Bite-sized UI in the Solutions Viewer

When a student clicks **"Walk me through this problem"**, instead of dumping everything, show:

```text
┌─────────────────────────────────────────┐
│ Step (a) of 5  ·  Calculate gross profit│
│                                         │
│ [bite-sized explanation for part a]     │
│                                         │
│ ─────────────────────────────────       │
│  ◉ ◯ ◯ ◯ ◯   ← progress dots           │
│                                         │
│  [ Show me everything ]  [ Continue → ] │
└─────────────────────────────────────────┘
```

- **Continue to part (b) →**: advances one step. Auto-checks the corresponding task in "Your Tasks" so the checklist stays synced.
- **Show me everything**: collapses into the old single-scroll view for power users.
- **Back**: lets them re-read a previous part.
- On the **last** part, the button becomes **"I got it ✓"** which marks all tasks done and surfaces the feedback prompt.

Why this works: it matches how the existing instructions checklist already works (one task at a time, current-task highlight). The walkthrough now mirrors that rhythm — read part (a), do part (a), continue.

### 3. Quick-win companions (same night, low effort)

Three small changes that compound the "easier to digest" goal:

- **Auto-scroll the matching task into view** when you advance — the checklist on the left highlights part (b) at the same moment the explanation reveals part (b). Cause-and-effect.
- **"What's this part asking?" plain-English restate** at the top of each step — one sentence in Lee's voice that translates the textbook instruction (e.g., *"Just figure out: sale price minus cost. That's it."*). The AI already produces this naturally; we just surface it as a styled callout.
- **Estimated time per part** (e.g., *"~30 sec"*) as a subtle muted-text hint. Tiny psychological win — students see "30 seconds" and start, instead of seeing a wall and bouncing.

---

## Technical Details

**Files touched:**
- `supabase/functions/explain-this-solution/index.ts` — add `walkthrough` array to the schema; keep `how_to_solve` for back-compat.
- `src/pages/v2/SolutionsViewerV2.tsx` (`InlineExplanation` component, ~line 491) — add `currentStep` state; render stepped view by default; add "Show me everything" toggle; wire `onAdvance` to call `toggleTask(i)` so the left checklist stays in sync.

**State:**
```ts
const [currentStep, setCurrentStep] = useState(0);
const [showAll, setShowAll] = useState(false);
```

**Caching:** Existing `explanation_cache` row is invalidated naturally — first load after deploy will regenerate with the new shape. Old cached rows still render via the `how_to_solve` fallback.

**Prompt change:** Add to the existing system prompt:
> "Split your step-by-step solution by instruction letter. For each lettered part (a, b, c…), produce: a one-sentence plain-English restate, then 2–4 short steps. Return as a `walkthrough` array."

---

## What This Doesn't Change

- "Start me off", "Explain the rule", "Show the setup" stay as-is (they're already concise by design).
- Pricing, paywall, JE display, and chapter content all untouched.
- No DB migration needed.

---

## Future Enhancements (not tonight)

- Streaming reveal (type-on effect per part) — feels alive but adds complexity.
- "Stuck on this part?" inline button per step that fires a smaller, cheaper "just this part" AI call.
- Track which parts students re-read most → signal for content QA.
