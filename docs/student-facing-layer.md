# Student-Facing Layer — Architecture & Decisions

## Overview

As of March 2026, Survive Accounting has a fully separate student-facing layer running at:

**https://learn.surviveaccounting.com**

This is distinct from the admin pipeline at `admin.surviveaccounting.com`. All student-facing URLs, iFrame embed codes, and share links must use `learn.surviveaccounting.com` as the base — never `window.location.origin`, which would point to the admin domain.

The constant used throughout the codebase:

```typescript
const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";
```

---

## Public Routes

These routes require no authentication and are embeddable in LearnWorlds via iFrame:

| Route | Page | Purpose |
|---|---|---|
| `/solutions/:assetCode` | `SolutionsViewer.tsx` | Full solutions page, paid or preview mode |
| `/practice/:assetCode` | `PracticeViewer.tsx` | Practice mode — always shows problem, hides solution by default |
| `/tools/flashcards` | `FlashcardTool.tsx` | Chapter-level flashcard tool |
| `/tools/formula-recall` | `FormulaRecallTool.tsx` | Chapter-level formula recall |
| `/tools/entry-builder` | `EntryBuilderTool.tsx` | Journal entry builder |
| `/tools/problem-dissector` | `ProblemDissectorTool.tsx` | Problem dissector |
| `/accy304` | `ACCY304Landing.tsx` | ACCY 304 beta marketing page |

---

## SolutionsViewer (`/solutions/:assetCode`)

### Modes

**Preview mode** (`?preview=true`): Shows problem text and instructions. All reveal toggles display a paywall card instead of content. This is what a non-paying visitor sees.

**Paid mode** (no param): All sections fully unlocked. This is what a LearnWorlds student with a Study Pass sees.

### Share Link Rule

**All share links always use `?preview=true`.** A paid student sharing a link should never accidentally give another person free access. The share button always appends `?preview=true` regardless of which mode the sharer is currently viewing.

Toast on share: "Preview link copied — recipients will need a Study Pass for full access"

### Sections

Always visible (no toggle):
- Problem text (pipe-delimited tables auto-render)
- Instructions — labeled `(a)`, `(b)`, `(c)` etc., always shown, never gated

Reveal toggles (paid unlocks, preview shows paywall):
- Reveal Solution (`answer_summary`)
- Reveal Journal Entries
- Reveal How to Solve This (flowchart, when available)
- Reveal Important Formulas
- Reveal Key Concepts
- Reveal Exam Traps

### Branding

- Top bar: Lee headshot + "Survive Accounting / by Lee Ingram"
- Headshot URL: `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg`
- Green badge: "✦ Deeper than a solutions manual — built from 10+ years of Ole Miss tutoring"
- Identifier bar: `source_ref — problem_title` (e.g. "P17.10 — Long-Term Contract with Interim Loss")
- About Lee card at bottom with Aoraki image
- Dark/light toggle stored in localStorage key `sa-viewer-theme`

### Identifier / Problem Title

The identifier bar should show `source_ref — problem_title` when a title is available. The title "Long-Term Contract with Interim Loss" visible in the assets library is already stored in the database — the field name needs to be confirmed (likely `problem_title` on `teaching_assets` or `title` on `chapter_problems`).

**Backfill needed:** Run migration to copy `chapter_problems.title` → `teaching_assets.problem_title` for all existing IA2 Ch 13–22 assets.

**Going forward:** OCR import should extract problem titles and store them on `chapter_problems.title` at import time.

### Tracking

`solutions_page_views` incremented via RPC on each load.

---

## PracticeViewer (`/practice/:assetCode`)

Same branding and header as SolutionsViewer.

Always visible: Problem, Instructions, Formulas, Key Concepts.

Reveal toggles: Solution, Journal Entries, Flowchart, Exam Traps.

Footer: "← View Full Solutions" link.

Tracking: `practice_page_views`.

---

## iFrame Embed Codes

Three embed types are available from the admin AssetsLibrary per-row dropdown:

```html
<!-- Full Solutions (paid student sees everything) -->
<iframe src="https://learn.surviveaccounting.com/solutions/IA2_CH17_P050_A"
  width="100%" height="900" frameborder="0"
  style="border:none;border-radius:8px"></iframe>

<!-- Preview (paywall after problem — use for free previews) -->
<iframe src="https://learn.surviveaccounting.com/solutions/IA2_CH17_P050_A?preview=true"
  width="100%" height="900" frameborder="0"
  style="border:none;border-radius:8px"></iframe>

<!-- Practice Mode -->
<iframe src="https://learn.surviveaccounting.com/practice/IA2_CH17_P050_A"
  width="100%" height="900" frameborder="0"
  style="border:none;border-radius:8px"></iframe>
```

---

## Report Issue System

Students can flag problems via a "Report Issue" button on the Solutions Viewer.

Database table: `asset_issue_reports` (id, teaching_asset_id, asset_name, reporter_email, message, status)

Edge function: `send-issue-report` — emails `lee@surviveaccounting.com`

Admin view: Issues tab in asset detail modal. Open issue count badge appears on the "Teaching Assets" sidebar link.

---

## ACCY 304 Beta Landing Page (`/accy304`)

Public marketing/teaser page for the Ole Miss ACCY 304 beta.

Features: Hero CTA → LearnWorlds enroll URL, Problem Picker (Chapter + Problem Type + Source #), BlurredPreview component showing problem + required with redacted solution sections, "Try New Numbers" button.

Admin page: `/accy304-admin` — protected, used to set `learnworlds_enroll_url` in `app_settings`.

### BlurredPreview Component

`src/components/BlurredPreview.tsx` — used on the ACCY 304 landing page.

Shows problem and instructions fully. All solution sections (journal entries, answer summary, formulas, concepts, exam traps) render as gray placeholder rectangles with an "Unlock with Study Pass →" CTA.

"Try New Numbers" calls the `swap-problem-numbers` edge function, which uses AI to change amounts/rates/dates while preserving the problem structure. The swap is session-only — it does not persist to the database.

---

## Phase 3 Study Tools (Admin-built, student-facing)

All tools live at `/tools/*` and are embeddable in LearnWorlds via iFrame.

Preview mode shows 3 items then a paywall CTA. Chapter-level scope except Problem Dissector (asset-level).

| Tool | Route | Admin Page | DB Tables |
|---|---|---|---|
| Flashcards | `/tools/flashcards?chapter_id=` | `/study-tools/flashcards` | `flashcard_decks`, `flashcards` |
| Formula Recall | `/tools/formula-recall?chapter_id=` | `/study-tools/formula-recall` | `formula_sets`, `formula_items` |
| Entry Builder | `/tools/entry-builder?chapter_id=` | `/study-tools/entry-builder` | `entry_builder_sets`, `entry_builder_items`, `entry_builder_accounts` |
| Problem Dissector | `/tools/problem-dissector?asset_id=` | `/study-tools/problem-dissector` | `dissector_problems` |

---

## Key Assets & URLs

| Item | Value |
|---|---|
| Lee headshot | `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg` |
| Aoraki / About Lee image | `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png` |
| Student base URL | `https://learn.surviveaccounting.com` |
| Admin base URL | `https://admin.surviveaccounting.com` |

---

End of student-facing-layer.md
