# Solutions Viewer V2 — Readability Pass

Three changes, grouped by effort. We can ship #1 and #2 tonight. #3 is bigger and worth discussing before we kick it off.

---

## 1. Show the course on the problem card (small, fast)

Right now the problem card shows only the chapter chip:
`CH 7 · INVENTORIES, COST APPROACH`

Add a course label just above it (or inline) so students know which class they're in.

**Display priority:**
1. If `courses.code` exists (e.g. `ACCY 201`) → show that
2. Else fall back to a friendly course name (`Intro Accounting 1`, `Intermediate Accounting 2`)

**Where:** `src/pages/v2/SolutionsViewerV2.tsx`
- Extend the existing `chapters` query to also fetch the course: `courses ( code, course_name )`
- Render a small muted label above the red chapter chip:

```text
ACCY 201 · INTRO ACCOUNTING 1
[ CH 7 · INVENTORIES, COST APPROACH ]   PRACTICE BASED ON E7.14
```

Style: same uppercase tracked treatment as existing meta labels, white at ~45% opacity. No new colors.

---

## 2. Interactive task checkboxes with "current task" highlight

Replace the current static `a / b / c / d` list with checkable tasks that show the student exactly which one to work on next.

**Behavior:**
- Each task has a checkbox (the existing letter badge becomes the checkbox).
- The **first unchecked task** is highlighted in **gold** (text + a soft gold left-border accent) — this is the "do this next" cue.
- Checked tasks: badge fills in red (#CE1126), text becomes muted + strikethrough.
- All tasks checked → show a small "Nice — you finished all the parts. Hit *Walk me through it* to compare." nudge.

**Persistence:**
- Save check state to `localStorage` under `sa_tasks_<asset_name>` so it survives a refresh but stays per-device (no DB write needed for MVP).
- A small "Reset" link appears once anything is checked.

**Visual sketch:**
```text
YOUR TASKS
[ A ]  Calculate the cost of ending inventory using FIFO …    ← gold (current)
[ B ]  Calculate the cost of ending inventory using LIFO …    ← muted
[ C ]  Calculate ending inventory using FIFO perpetual …
[ D ]  Calculate ending inventory using LIFO perpetual …

✓ A   Calculate the cost of ending inventory using FIFO …    ← struck through, red badge
[ B ]  Calculate the cost of ending inventory using LIFO …    ← gold (now current)
```

**Where:** same file, the `Your Tasks` block (currently lines 1549–1610). No DB changes.

---

## 3. The "You-format" problem text rewrite (bigger — let's discuss)

This is the high-impact one but it's a content migration, not a UI change. A few decisions to make before we do it.

### What we'd be changing

From:
> Survive Company A (the seller) maintains records for its inventory of specialized teapots. The following transactions occurred during May 2025…
>
> (a) Calculate the cost of ending inventory **on the books of Survive Company A (the seller)** using the FIFO method under a periodic system.

To:
> You run a small teapot shop. In May 2025, you had these transactions:
>
> (a) Calculate your ending inventory using FIFO under a periodic system.

That's roughly a 40% character reduction on the instructions alone, and the parentheticals disappear entirely.

### How we'd do it

This is a one-time AI rewrite over `teaching_assets.survive_problem_text` + `instruction_1..5` (and probably `instruction_list`). Approach:

1. **New columns** on `teaching_assets`:
   - `you_problem_text` (text)
   - `you_instruction_1..5` (text) *or* `you_instruction_list` (jsonb)
   - `you_format_status` ('pending' | 'generated' | 'approved' | 'rejected')
   - `you_format_company` (text — the fictitious company name we picked, so we can keep it consistent across re-runs)

   We do **not** overwrite the originals. The viewer reads the new columns when present, falls back to the old ones otherwise. This lets you A/B and roll back per-asset.

2. **New edge function** `rewrite-problem-you-format`:
   - Calls Anthropic directly (per the project rule), `claude-sonnet-4-20250514`.
   - System prompt enforces:
     - Second person (`you`, `your`).
     - Drop "Survive Company A" entirely. Pick a one-line fictitious business that fits the transaction (teapot shop, food truck, landscaping crew, etc.).
     - Drop role parentheticals (`(the seller)`, `(the buyer)`, etc.).
     - Keep all numbers, dates, and accounting facts identical — this is rewording only.
     - Each instruction ≤ ~18 words.
   - Returns strict JSON: `{ problem_text, instructions: [...], company: "..." }`.

3. **Batch runner** (admin-only page or one-off script) that:
   - Iterates approved assets in batches of ~10.
   - Writes results to the `you_*` columns with status `generated`.
   - Logs failures to a small audit table or `fix_notes`.

4. **QA UI** — a tab in the existing QA Toolbox that shows old vs new side-by-side with Approve / Reject / Re-run buttons. Nothing goes live to students until approved.

5. **Viewer toggle** — add a per-student toggle in the header ("Plain English / Textbook style") so anyone who prefers the original wording isn't forced into the rewrite. Default = whichever you choose (recommend "Plain English" once approved coverage is high enough).

### Things to decide before we build #3

I'd like to lock these down before we start — this is where ChatGPT-style assumptions usually go sideways.

- **Scope:** rewrite *all* approved assets, or start with one chapter (e.g. Ch 7 Inventory) as a pilot?
- **Company names:** AI picks per-problem (more variety, more drift) vs. a small fixed library you curate (10–15 businesses) that the AI must pick from?
- **Roles:** do we always drop `(the seller)` etc., or do we keep role context for problems where it matters (lessor/lessee, lender/borrower) by using "your company" + a sentence of setup?
- **Tonight:** do you want to ship #1 and #2 now and queue #3 for a separate session? My recommendation is yes — #3 needs a proper QA pass before students see it.

---

## Recommended order

1. **Now (tonight):** Course label (#1) + interactive checkboxes (#2). Pure UI in `SolutionsViewerV2.tsx`. ~1 build.
2. **Next session:** Approve scope/decisions on #3, then build the schema + edge function + batch + QA tab. Pilot on one chapter, review output together, then expand.

Want me to proceed with #1 and #2 now?
