## Add Journal Entry Viewing to Solutions Viewer v2

Reuse the existing `StructuredJEDisplay` component (already used in the legacy viewer and AssetDetailDrawer) — no new data model, no redesign, no tooltip changes.

### 1. Fetch JE data in `src/pages/v2/SolutionsViewerV2.tsx`

In the asset query (~line 998), add `journal_entry_completed_json` and `journal_entry_template_json` to the `.select()` and to the `Asset` type (~line 19).

### 2. Detect availability

Compute `hasJE` from the loaded asset using the same canonical check the legacy viewer uses:
- `journal_entry_completed_json?.scenario_sections?.length > 0`

If false → don't render the button.

### 3. Add button to right panel

Below the existing 4-button toolbox grid (after the `TOOLBOX_META` button block, ~line 575), render a single secondary button:
- Text: **"See journal entries"** (with a small ledger icon, e.g. `BookOpen` from lucide)
- Style: full-width outline button matching existing toolbox aesthetic, slightly less visual weight (so it reads as supplementary, not a 5th cram action)
- Only rendered when `hasJE` is true

### 4. Modal

Use the existing shadcn `Dialog` component:
- Title: **"Journal Entries"**
- Large content area: `max-w-3xl`, `max-h-[85vh]`, scrollable body (`overflow-y-auto`)
- Body renders:
  ```tsx
  <StructuredJEDisplay
    data={asset.journal_entry_completed_json}
    showHeading={false}
  />
  ```
- This automatically preserves: scenario/date grouping labels, debit/credit formatting, JETooltip account explanations, amount-source tooltips, balance indicators, and Copy-for-Sheets — all already built in.

### 5. State

Add `const [jeOpen, setJeOpen] = useState(false);` near the other right-panel state.

### What this does NOT touch
- No changes to `StructuredJEDisplay`, `JournalEntryTable`, or any data normalization.
- No changes to legacy Solutions Viewer.
- No carousel/slider — MVP scrollable modal only.
- Button hidden entirely when no JE data exists.

### Files modified
- `src/pages/v2/SolutionsViewerV2.tsx` (only file)
