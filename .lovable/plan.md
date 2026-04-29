## Goal

Replace the current "JE Helper" (which just auto-opens the JE dialog inside the Practice Problem Helper iframe) with a **standalone JE Helper screen**. It lives in the same retro-monitor previewer, looks like the Practice Problem Helper visually, but its UX is: study every journal entry in the selected chapter on one screen, each shown as a transaction description + the existing JE table with the account/amount tooltips (matching screenshot 1).

## What changes

### 1. New component: `JEHelperPanel`
File: `src/components/study-previewer/JEHelperPanel.tsx`

A self-contained, full-screen-inside-the-previewer panel (no iframe). Layout matches the Practice Problem Helper's chrome so it feels like the same hardware, but its content is a scrollable list of journal entries for the selected chapter.

Header (matches PPH header):
- Left: `SPRING '26 BETA` chip
- Center: `View Journal Entries · Ch N` button (replaces "Switch Problem")
  - Opens a lightweight chapter-switcher dropdown (or simply re-uses chapter list — for the demo, this can be a non-interactive label saying `Ch N — name` since chapter selection already happens on the previous screen)
- Right: `Share Feedback` (same component/handler as PPH)

Breadcrumbs (using existing `RetroBreadcrumbs`):
- `home` → posts `sa-viewer-go-home` to parent
- `ch N` → posts `sa-viewer-go-chapter` to parent
- `je helper` (current)

Body:
- Heading: `Journal Entries — Ch N: <Chapter Name>`
- Subheading: `Study every journal entry in this chapter. Hover the ⓘ icons to see why each account is debited/credited and where the numbers come from.`
- Vertical list of journal-entry cards. Each card:
  - **Transaction description** (bold, ~14–15px) — e.g. "Record stock-option compensation expense"
  - **Source pill** (tiny, muted) — e.g. `E15.10 · Part (a)` so students can find the originating problem
  - **JE table** rendered with the existing `StructuredJEDisplay` / `JournalEntryTable` style (account / debit / credit columns, with `JETooltip` on accounts and amounts) — the exact look in screenshot 1
- Empty state if no JEs: friendly "This chapter doesn't have journal entries yet" message
- Loading skeleton while fetching

### 2. Data fetching

In `JEHelperPanel`, on mount + whenever `chapterId` changes:

```sql
SELECT id, asset_name, source_number, instructions,
       journal_entry_completed_json, answer_text, journal_entry
FROM teaching_assets
WHERE chapter_id = :chapterId
  AND journal_entry_completed_json IS NOT NULL
ORDER BY source_number ASC NULLS LAST, asset_name ASC
```

Then flatten each asset's JE payload into one or more entry cards:

- If `journal_entry_completed_json` is canonical (`isCanonicalJE`), iterate `scenario_sections[].entries_by_date[]`.
  - **Transaction description** = scenario `label` (e.g. "Part (a)") if it carries a description, otherwise pull from instructions; fall back to the date string.
  - For the demo, a robust derivation is:
    - If scenario `label` looks descriptive (>4 words) → use it
    - Else use `<source_number> · <scenario.label>` (e.g. `E15.10 · Part (a)`)
- If the legacy array format, render each group as one card using the existing `JournalEntryTable` (which already handles tooltips via `StructuredJEDisplay` for canonical and falls back gracefully).

For MVP/demo we render each `(scenario, date)` pair as one card containing one JE table. This keeps each card focused on a single transaction.

### 3. Wire JE Helper into the previewer (no iframe)

In `src/components/study-previewer/StudyPreviewer.tsx`:

- Remove the `iframe` branch for `activeTool === "je"` (lines ~833–893).
- Replace it with `<JEHelperPanel chapterId={selectedChapterId} chapter={selectedChapter} onShareFeedback={onOpenFeedback} onGoHome={...} onGoChapter={...} />`.
- Drop `jeAssetCode` state and the related Supabase prefetch (no longer needed). Practice Problem Helper still uses `viewerAssetCode` and the iframe — unchanged.
- The "go home" / "go chapter" actions just call the existing setters locally (same effect as the postMessage path the iframe uses today).

### 4. Tool-card label

In `TERMINAL_TOOLS` (StudyPreviewer.tsx):
- Keep the JE Helper card label `Journal Entry Helper` and description `Study every journal entry in this chapter, with the why behind each line.`
- The `cta` becomes `View Journal Entries`.

(The "View Journal Entries" wording the user mentioned for the "Switch Problem" spot lives inside the new JEHelperPanel header — see Header above.)

### 5. Tooltips — preserved as-is

The existing `StructuredJEDisplay` already renders `JETooltip` for `debit_credit_reason` (account) and `amount_source` (amount). We reuse it directly so screenshot-1 styling and behavior come for free.

### 6. SolutionsViewerV2 cleanup (small)

Remove the now-unused `?focus=je` auto-open behavior added in the previous round, since the JE Helper no longer routes through the V2 viewer. (The `useEffect` that opens `setJeOpen(true)` when `focusJE` is true can be deleted; harmless to leave but cleaner to remove.)

## Files touched

- **new** `src/components/study-previewer/JEHelperPanel.tsx`
- **edit** `src/components/study-previewer/StudyPreviewer.tsx` (swap iframe branch for the new panel; drop `jeAssetCode` state + JE prefetch query)
- **edit** `src/pages/v2/SolutionsViewerV2.tsx` (remove `focus=je` auto-open; minor)

## Out of scope (for the demo)

- A chapter-switcher inside the JE Helper header (chapter selection happens on the previous retro screen).
- Filtering / search across entries.
- Per-entry deep links back to the originating problem (we surface the source code as a pill but don't link it yet).
