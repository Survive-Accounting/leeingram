## Goal

Refine each JE Helper card so it's slick and study-focused:
1. Replace the awkward "Part e" header with a concise, AI-generated **transaction description** (e.g. "Initial ROU asset and lease liability").
2. Move the source reference (e.g. `BE20.15`) to a small **"Open in new tab"** button in the card's top-right that opens that problem in the Practice Problem Helper.
3. Drop the date subline (it's redundant once the description is clear).
4. Replace dollar amounts with **`???`** placeholders, but keep the existing `amount_source` tooltip so students can still see where the number would come from.

## What students will see (per card)

```text
┌────────────────────────────────────────────────────────────────┐
│ Initial ROU asset and lease liability        [ BE20.15 ↗ ]    │
├────────────────────────────────────────────────────────────────┤
│ ACCOUNT                              DEBIT          CREDIT     │
│ Right-of-Use Asset ⓘ                  ??? ⓘ                    │
│   Lease Liability ⓘ                                  ??? ⓘ     │
└────────────────────────────────────────────────────────────────┘
```

- ⓘ on accounts → existing `debit_credit_reason`
- ⓘ on `???` → existing `amount_source`
- `BE20.15 ↗` button → opens `/v2/solutions/<asset_code>` in a new tab

## Description generation (AI, on-the-fly + cached)

New edge function: `supabase/functions/generate-je-transaction-labels/index.ts`

- Called by JE Helper after assets load, in batches of ~10 entries per call.
- Auth: direct `api.anthropic.com/v1/messages`, model `claude-sonnet-4-20250514`, using `ANTHROPIC_API_KEY` (per project rule — never the Lovable gateway).
- Input per entry: scenario label, instruction text snippet for the part letter, the date, and the JE rows (account names + sides only, no dollar amounts needed).
- Output: a single 4–8-word transaction description in title case, no leading "Record/Recognize/To" verbs unless natural (e.g. "Initial lease payment", "Lease expense and ROU amortization", "Issued bonds at a discount").
- Tool-calling for structured output: returns `{ labels: [{ key, description }] }` keyed by the same `key` the panel already builds (`assetId-si-ei`).

### Caching

Add a new column to `teaching_assets`:
- `je_transaction_labels jsonb` — map of `"<si>-<ei>"` → description.

Flow:
1. On chapter load, fetch assets (already happening) + their `je_transaction_labels`.
2. For any `(asset, si, ei)` missing a label, queue it for generation.
3. Call the edge function in one batch, then `update teaching_assets set je_transaction_labels = ...` per asset (merging into existing JSON).
4. Render labels as they arrive (skeleton/derived fallback in the meantime so the card never looks broken).

This keeps the demo snappy on second load and across students, while letting any new asset auto-fill the first time it's viewed.

## Source button → Practice Problem Helper

- Use the asset's `asset_code` (already fetched alongside the JE data — add to the select).
- Button content: `<source_number> ↗` (e.g. `BE20.15 ↗`); if `source_number` is null fall back to "Open problem".
- `target="_blank"` `rel="noopener noreferrer"` to `/v2/solutions/<asset_code>` (same URL the iframe uses for the PPH today).
- Styling: pill-shaped, low-contrast on the navy card (`bg: rgba(255,255,255,0.06)`, white-70 text, ExternalLink icon from lucide).
- Keep the asset code itself out of the visible UI per the Internal Code Visibility rule — `source_number` is the textbook reference and is fine to show; we only use `asset_code` as the link target.

## Amounts → "???"

Inside `JECard` in `JEHelperPanel.tsx`:
- For each row, render `???` (in monospace, slightly muted) in the appropriate Debit/Credit cell instead of `formatAmount(...)`.
- Always render the `amount_source` `JETooltip` next to `???` when present, even if the underlying amount is null/zero.
- The non-active side stays empty (no `???` on the side that has no amount).

## Files

- **edit** `src/components/study-previewer/JEHelperPanel.tsx`
  - Add `asset_code` to the select.
  - Carry `asset_code`, `source_number`, and `je_transaction_labels` through `flattenAssets` into each `FlatEntry`.
  - Replace the `description` derivation: prefer the cached/AI label, fall back to the existing heuristic only while loading.
  - New header layout: title on the left, `[source_number ↗]` button on the right; remove the `entry.source` subline.
  - Render `???` + `amount_source` tooltip in place of formatted amounts.
  - Kick off batched calls to the new edge function for any entries missing a label, then `setEntries` as labels arrive.
- **new** `supabase/functions/generate-je-transaction-labels/index.ts` — Anthropic-direct, tool-calling for structured `{labels:[...]}` output, validates batch size.
- **migration** add `je_transaction_labels jsonb` column to `teaching_assets` (nullable, default `null`).

## Out of scope (for the demo)

- Backfilling labels across all chapters proactively — first view per asset triggers generation.
- A "Show amounts" toggle — locked to `???` per your direction.
- Any UI change to PPH itself when opened from the new tab; it loads as today.
