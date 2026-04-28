# Journal Entry Helper — MVP Plan

## A. Audit findings

### A1. Where JE data lives (two distinct stores)

**`chapter_journal_entries`** — chapter-level "master" entries built for the Survive This Chapter hub.
- Fields: `chapter_id`, `category_id` (FK → `chapter_je_categories`), `transaction_label`, `je_lines` (jsonb), `is_approved`, `sort_order`, `source` (`extracted` | `suggested`).
- `je_lines` shape per row: `{ side: "debit"|"credit", account: string, amount: string, account_tooltip: string }`.
- Coverage today: **289 approved entries across IA2 chapters 13–22.** No Intro 1/2 or IA1 yet.
- RLS: public read. Already wired into Solutions Viewer V1 + Survive This Chapter.

**`teaching_assets.journal_entry_completed_json`** — per-problem "real" entries with numbers.
- Per row: `account_name`, `side`, `debit`/`credit`, `debit_credit_reason`, `amount_source`, `calculation_formula`.
- This is where actual dollar amounts and per-amount tooltips live.
- Tied to a problem, not a chapter-level transaction.

### A2. Tooltip data — what's actually populated

| Surface | Account "why" tooltip | Amount "how" tooltip |
|---|---|---|
| `chapter_journal_entries.je_lines` | YES (`account_tooltip`) | NO — every `amount` is literally `"???"` |
| `teaching_assets.journal_entry_completed_json` | YES (`debit_credit_reason`) | YES (`amount_source` + `calculation_formula`) |

**This is the single most important constraint for the MVP.** Chapter JEs are *already* "practice mode by design" — they have account-level explanations and ??? amounts, but no real numbers and no calculation tooltips. They cannot be "revealed" because the data isn't there.

### A3. Reusable display component

Solutions Viewer V1 already has `ChapterJEAccordion` (`src/pages/SolutionsViewer.tsx`, line 2063) that renders this exact data: dark table, indented credits, `JETooltip` next to each account, `???` in amount columns. We can lift its render logic almost verbatim.

`JournalEntryTable` + `StructuredJEDisplay` exist for `journal_entry_completed_json` (real amounts + amount tooltips), but they're built for a single asset, not a chapter switcher.

### A4. Reusable Practice Problem Helper patterns (`src/pages/v2/SolutionsViewerV2.tsx`)

- Sticky 3-column header (left attribution, center switcher, right Share Feedback).
- `JumpToProblem`-style switcher modal pattern.
- Premium dark gradient panel (`#0F1A2E → #0B1424`, `rounded-lg`, `border-white/10`).
- `HelperResponseThumbs` and `ProblemClarityFeedback` components — drop-in for JE feedback.
- `FeatureIdeasModal` for the "Suggest a new idea" link.
- `getCourseLabel()` from `src/lib/courseLabel.ts`.

### A5. What's missing / unknowns

1. **No real amounts in `chapter_journal_entries`** → "Reveal mode" can't show numbers from this table alone.
2. **No amount tooltips in `chapter_journal_entries`** → no calculation explanations for chapter JEs.
3. **Coverage is IA2-only.** Intro 1, Intro 2, IA1 have zero approved chapter JEs today.
4. **No "JE Rubric" image** stored anywhere — the modal would be styled markup.

---

## B. MVP recommendation

Build the helper around **`chapter_journal_entries` only**, presented honestly as an *account-pattern practice* tool — not a numbers-reveal tool. This matches the data we actually have, ships fast, and stays consistent with how the data already renders in Solutions Viewer V1 and Survive This Chapter.

A future v2 can swap to (or layer in) `teaching_assets.journal_entry_completed_json` when we want real reveals — that needs a different switcher (per-problem, not per-chapter-transaction) and is out of scope.

### Route
`/je-helper/:courseSlug?chapter=13&entry=<uuid>` (course slug from `getCourseLabel`, query params for shareable deep links).

### Layout (mirrors Practice Problem Helper)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Built by Lee Ingram      [JE Switcher · Ch 13 ▼]   Share Fdbk │
├─────────────────────────────────────────────────────────────────┤
│  LEFT: Transaction card                │ RIGHT: Helper panel    │
│  ┌──────────────────────────────────┐  │ ┌────────────────────┐ │
│  │ "Sale of services on credit"     │  │ │ Walk me through it │ │
│  │ ─────────────────────────────    │  │ │ Show the rubric    │ │
│  │ Account            Debit  Credit │  │ ├────────────────────┤ │
│  │ Accounts Rec. ⓘ    ???           │  │ │ (chat output area) │ │
│  │   Service Rev. ⓘ          ???    │  │ └────────────────────┘ │
│  │ ─────────────────────────────    │  │ Suggest a new idea →   │
│  │ [ Reveal accounts only ]  ◀ ▶    │  │                        │
│  │ Problem clear?  👍 👎             │  │                        │
│  └──────────────────────────────────┘  │                        │
└─────────────────────────────────────────────────────────────────┘
```

### Switcher behavior
- Modal lists all chapters with `count(*) > 0` of approved chapter JEs (today: IA2 ch 13–22).
- Inside a chapter: entries grouped by `chapter_je_categories`, ordered by `sort_order`.
- Prev/Next arrows on the JE table flow through entries within the current chapter.

### JE table (account-only practice mode)
- Reuses the V1 render: header `Account / Debit / Credit`, indented credits, `JETooltip` on every account using `account_tooltip`.
- Amount cells render `???` in monospace muted color (matches V1).
- A small `ⓘ` next to each `???` opens a tooltip: *"Numbers vary by problem — focus on whether this is a debit or a credit."* (Static copy; we don't have per-amount data here.)

### Modes
- **Practice (default):** account names visible, tooltips behind ⓘ, amounts hidden.
- **"Show all hints"** toggle: pre-opens every account tooltip inline (no popovers needed).
- ~~Reveal real amounts~~ — out of MVP scope (data not available in this table).

### Helper panel (right side, reuses Practice Helper styling)
1. **Walk me through it** — iterates the `je_lines` array, one card per line: account name → "Debit because…" / "Credit because…" pulled from `account_tooltip` → "Next". No AI call needed.
2. **Show the rubric** — opens a modal with the A=L+E hierarchy:
   ```
   A = L + E
   A: + Debit / − Credit
   L: − Debit / + Credit
   E: − Debit / + Credit
   Revenue ↑ E (credit)   Expense ↓ E (debit)
   ```
   Plus a small **Account breakdown** list for the current entry: account name → type (Asset/Liability/Equity/Revenue/Expense) → normal balance → why D/C.
   Account-type classification: a small client-side lookup against the global Chart of Accounts (`mem://features/global-chart-of-accounts`) — no DB change needed.
3. **Suggest a new idea →** subtle link, opens existing `FeatureIdeasModal`.

### Feedback (reuses existing components verbatim)
- `HelperResponseThumbs` at the bottom of any helper response, `section: "je_walkthrough"` or `"je_rubric"`.
- `ProblemClarityFeedback` at the bottom of the JE card, `section: "je_clarity"`, context includes `chapter_je_id`, `chapter_id`, `course`.
- Both write to existing `explanation_feedback` table — **no schema change.**
- Header "Share Feedback" reuses `FeedbackChooserModal`.

---

## C. What's IN vs OUT

**IN (MVP)**
1. `/je-helper` route + page shell
2. Course/chapter switcher modal (limited to chapters with approved entries)
3. JE picker (categorized list within chapter)
4. JE table render (account + ??? amounts + account tooltips), reusing V1 styling
5. Prev/Next JE navigation + URL deep linking
6. "Walk me through it" — non-AI, walks `je_lines` using existing `account_tooltip`
7. "Show the rubric" modal with A=L+E + per-entry account breakdown
8. Reuse: thumbs feedback (helper + problem clarity), Share Feedback chooser, Suggest a new idea link
9. Entry on Student Dashboard + a card on Survive This Chapter

**OUT (v2+)**
- Real amount reveal (needs `teaching_assets.journal_entry_completed_json` integration)
- Calculation tooltips on amounts
- AI-generated explanations
- User input / scoring / quiz mode
- Spaced repetition / progress tracking
- Animations beyond the existing fade-in
- Brand-new JE generation
- Coverage for Intro 1, Intro 2, IA1 (data doesn't exist yet — content task, not engineering)

---

## D. Database changes

**None required for MVP.** Everything renders from existing tables and writes feedback to existing `explanation_feedback`.

Optional future work (NOT in MVP): a follow-up migration could add nullable `real_amount numeric` and `amount_tooltip text` to `chapter_journal_entries` if we ever want true reveal mode. Flagging only — do not build.

---

## E. Technical notes (for the implementer)

- New file: `src/pages/v2/JournalEntryHelperV2.tsx` — page shell modeled on `SolutionsViewerV2`.
- New file: `src/components/v2/ChapterJEPicker.tsx` — switcher modal (chapter dropdown + categorized entry list).
- New file: `src/components/v2/JERubricModal.tsx` — A=L+E reference + per-entry account breakdown.
- Lift the table render from `SolutionsViewer.tsx` lines 2095–2138 into a shared `<ChapterJETable entry={...} mode="practice" />` component, then have V1 import it too (de-dupes the markup).
- Account-type classifier: small `src/lib/accountClassifier.ts` mapping account name → `{type, normalBalance}` from the global chart-of-accounts memory. Falls back to `"Unknown"` if not matched.
- Route registration in `src/App.tsx`. Public access (matches Survive This Chapter — chapter JEs are public read).
- Reuse `getCourseLabel`, `HelperResponseThumbs`, `ProblemClarityFeedback`, `FeatureIdeasModal`, `FeedbackChooserModal` directly from V2 viewer.

---

## F. Questions I need answered before building

1. **Reveal mode scope.** Confirm MVP is account-pattern only (no real numbers). If you want real numbers in v1, we need to either (a) add `real_amount` columns to `chapter_journal_entries` and backfill, or (b) switch the data source to per-problem `teaching_assets.journal_entry_completed_json` (which changes the switcher model entirely).
2. **Coverage gap.** Today's data is IA2 ch 13–22 only. Do we ship MVP IA2-only, or block until Intro 1 / Intro 2 / IA1 chapter JEs are generated?
3. **Entry point.** Standalone route, or also surface inside Survive This Chapter as a "Practice these entries" button on the existing chapter JE accordion?
4. **Auth.** Public access like Survive This Chapter, or paywalled like full Solutions?
5. **Rubric image.** Do you have a diagram you want shown in the rubric modal, or is styled markup fine for MVP?
6. **Walkthrough copy.** OK to use existing `account_tooltip` text verbatim for the walkthrough, or should it be re-voiced (more "you-focused", per the AI Tutor Voice memory)?

Once you answer 1, 2, and 3, the rest can be defaulted and built.
