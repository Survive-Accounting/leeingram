## Scope

Refactor **`src/pages/v2/SolutionsViewerV2.tsx`** (route `/v2/solutions/:assetCode`) into a focused, fast cram experience. Live route `/solutions/:assetCode` stays untouched until you promote.

All needed infrastructure already exists — no new tables, no new edge functions:
- `simplified_problem_cache` table (asset_id unique, public read)
- `simplify-problem` edge function (already used by V2)
- `chapter_problems.problem_screenshot_urls` (already fetched via `base_raw_problem_id` in V2)

---

## LEFT PANEL — Problem

**Remove:**
- "Simplified / Original" segmented toggle (lines ~1059–1100)
- "Try it yourself first!" header strip (lines ~564–567)
- Verbose problem titles (e.g. "Usefulness, Objective of Financial Reporting…")
- The "no simplified version yet → CTA" branch (~1004–1057) — generation is now automatic

**Keep / add:**

1. **Top line**
   `Practice based on E1.4 🔍`
   - Source ref pulled from `asset.source_ref`
   - 🔍 magnifying-glass icon button → opens existing `originalOpen` Dialog with `originalImages` (already wired)
   - Disabled state if `originalImages.length === 0` (preserve current tooltip)

2. **Problem section** (default open)
   - Header: `Problem`
   - Body: simplified text only, rendered with existing `SmartContent` / markdown renderer
   - Slightly smaller font (`text-[14px]`, `leading-[1.65]`), tighter spacing
   - **Auto-fetch on mount** (replaces today's manual "Simplify" button):
     - Read `simplified_problem_cache` by `asset_id`
     - If hit → render
     - If miss → open blocking modal `"Getting this problem ready…"` (Dialog, no close button, spinner) → call `simplify-problem` edge fn → cache writes server-side → render → close modal
     - Errors fall back to raw `problem_context` with a small inline "Couldn't simplify — showing original" notice

3. **Instructions section** (collapsed by default)
   - Trigger: outline button `View instructions` ↔ `Hide instructions`
   - Content: existing instruction list (lettered a/b/c, deduped via existing `deduplicateInstructions`)

---

## RIGHT PANEL — Help

Replace today's right column entirely with:

1. **Header**: `Get Quick Help` + small `Print PDF` icon button top-right (reuses existing `generateSimplifiedPracticePdf` flow already in the file)

2. **Action grid** (2-col on desktop, 1-col mobile, navy outlined buttons matching #14213D / #CE1126 system):

   | Button | Maps to existing data |
   |---|---|
   | **How to start** | `flowchart` / `worked_steps` first step |
   | **Steps to solve** | `worked_steps` full / structured solution |
   | **Why it works** | `concept_notes` ("The Why") |
   | **Lock this in** | `memory_items` for this asset's chapter |
   | **Journal Entries** *(conditional)* | Only render if asset has JE data (`je_data` / canonical JE detected) |

3. **Lazy-load behavior** (hard requirement — "Do NOT preload"):
   - Track `activeHelp: string | null` in local state
   - Each button click sets `activeHelp` → that section's panel mounts and runs its own `useQuery` (or existing fetcher)
   - Only one section open at a time (matches your single-open accordion policy from `mem://ui/viewer-interaction-modes`)
   - A small "← Back to actions" link inside the open panel returns to the grid
   - Loading state per-section: small inline spinner, not modal

4. **Removed from right panel**: every other accordion currently rendered in V2's right column (chapter formulas, key terms, accounts, exam traps, etc.) — they belong on the chapter Cram hub, not here.

---

## NAVIGATION (unchanged)

- Footer Previous / Next + counter (e.g. `18 / 26`) — keep existing logic
- Floating "Need help?" button bottom-right — keep
- Existing chapter / course breadcrumb in topbar — keep but simplified (no large title)

---

## STYLE PASS

- Page background: white
- Card backgrounds: `#F8F9FA`, soft borders `#E5E7EB`
- Body 14px / line-height 1.65
- Section headers: 11px uppercase tracking-wider, navy
- More vertical whitespace between Problem / Instructions / Help blocks (24–32px gaps)
- Action-grid buttons: 44px tall, navy border, white bg, hover fills navy

---

## File touchpoints

- `src/pages/v2/SolutionsViewerV2.tsx` — main rewrite (will shrink significantly; the old `SimplifiedProblem` component, toggle UI, and right-column accordions are removed)
- No DB migrations
- No edge function changes
- No changes to live `/solutions/:assetCode` route

---

## Out of scope (call out for follow-up)

- Promoting this to the live `/solutions/:assetCode` route
- Pre-warming simplified cache for entire chapters
- Updating chapter Cram hub links to point at `/v2/solutions/...`
- QA-mode editing controls (`QAEditButton`, etc.) — will keep current admin gating but won't redesign
