# Engagement-gated sharing on V2 Solutions Viewer

Goal: stop asking everyone to share. Only invite the most engaged students (those who rated us 4–5 AND took the time to send written feedback) to share with a friend.

---

## What changes for the student

**1. Remove the Share button from the V2 viewer header.**
No more always-visible Share icon next to "Jump anywhere in the course."

**2. The "Quick favor?" popup (every 15th problem view) becomes a 3-step funnel:**

```text
Step 1 — Rate
  "How are we doing so far?"
  [1] [2] [3] [4] [5]   ← 1 = worst, 5 = best
  Don't show again · Skip

  ├─ Rating 1–3 → save rating, show short "Thanks — we'll keep improving" → close.
  │              No wish step. No share step.
  │
  └─ Rating 4–5 → continue to Step 2.

Step 2 — Wish (only for 4★/5★)
  "Glad it's helping. If you could wave a magic wand,
   what would make this even better?"
  [textarea — placeholder: "One thing you'd change…"]
  Skip · Send to Lee

  ├─ Skip / empty → save rating only → close.
  │
  └─ Sends actual feedback → continue to Step 3.

Step 3 — Share (only after they actually submit a wish)
  "You're exactly the kind of student we built this for.
   Know a friend cramming right now? Send them this:"
  [link field]  [Copy link]
  Done
```

The existing "Send this to a friend" button inside the per-problem **ExplanationFeedback** card (shown after a thumbs-up) stays — it's user-initiated and only appears for engaged students, which fits the same philosophy.

---

## Trigger rules (unchanged from today)

- Popup opens on every 15th problem view (`sa_problem_views % 15 === 0`).
- "Don't show again" sets `sa_wand_optout=1` and the popup never returns on that browser.
- "Skip" at any step just closes; the next 15-view cycle can re-trigger.

---

## Data captured

Reuse the existing `explanation_feedback` table. One row per popup completion, written at the end of whichever step the student finished:

| field | value |
|---|---|
| `asset_id` | sentinel `00000000-0000-0000-0000-000000000001` (current pattern) |
| `asset_name` | `__magic_wand__` |
| `user_email` | from `v2_student_email` / `sa_free_user_email` if present |
| `helpful` | `true` if rating ≥ 4, `false` if ≤ 3, `null` if skipped |
| `reason` | `["wand_prompt", "rating:<1-5>"]` |
| `note` | wish text (only for 4–5 who typed something) |

No schema migration needed — `reason` is already a text array.

---

## Technical implementation

All changes live in **`src/pages/v2/SolutionsViewerV2.tsx`**.

1. **Delete** the header Share button (lines ~1564–1578) — the `<button>` with `<Share2>` icon. Keep `openShareModal`, `ShareModal`, and `shareOpen` state — they're still used by `ExplanationFeedback` and now by the new wand flow.

2. **Refactor `MagicWandFeedback`** (lines ~795–894):
   - Add `onTriggerShare: () => void` prop.
   - Replace single-screen UI with a `step` state machine: `"rate" | "wish" | "thanks"`.
   - On rating click: store rating in local state; if 1–3, write feedback row and show "Thanks" then close; if 4–5, advance to `"wish"`.
   - On wish "Send to Lee" with non-empty text: write feedback row → close popup → call `onTriggerShare()` (which opens the existing `ShareModal`).
   - On wish "Skip": write rating-only row → close.
   - Keep "Don't show again" link visible on the rate step only.
   - Keep Lee headshot at the top of all steps for continuity.

3. **Wire it up** at line 1951:
   ```tsx
   <MagicWandFeedback onTriggerShare={openShareModal} />
   ```

4. **Tighten copy** to keep the friendly, concise voice already established:
   - Rate step title: `Quick favor?`
   - Rate step body: `How's Survive Accounting working for you so far?`
   - Wish step title: `Awesome — one wish?`
   - Wish step body: `If you could wave a magic wand, what would make this perfect?`
   - Share step title: `Help a friend before their exam`
   - Share step body: `You're the kind of student we built this for. Send them the link:`

5. **Star UI**: 5 large numbered buttons (1–5) in a row, navy fill on hover, red fill on selected, matching the project's existing button styling. No icon library needed beyond Lucide `Star` if we want stars; numeric 1–5 is simpler and matches the user's spec ("1 worse, 5 best").

6. **Remove unused import** `Share2` from the lucide import line **only if** no other in-file usage remains. `ExplanationFeedback` still uses `Share2`, so the import stays.

---

## Files touched

- `src/pages/v2/SolutionsViewerV2.tsx` — single-file change.

No DB migrations, no new components, no new dependencies.
