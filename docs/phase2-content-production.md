# Phase 2 — Content Production System

## Overview

Phase 2 covers everything that happens after a teaching asset is approved in Phase 1. It is the production layer that turns approved teaching assets into student-facing content.

Phase 2 is tracked per-asset via status fields on the `teaching_assets` table. All Phase 2 work is accessible from the admin sidebar under "Phase 2 · Content Production."

---

## Phase 2 Status Fields on `teaching_assets`

| Field | Values | Purpose |
|---|---|---|
| `phase2_status` | `core_asset`, `hold`, null | Whether the asset is selected for student-facing production |
| `core_rank` | 1, 2, 3 | Priority rank within a chapter (1 = top priority) |
| `whiteboard_status` | `not_started`, `in_progress`, `complete` | Google Sheet whiteboard prep |
| `mc_status` | same | Multiple choice quiz generation |
| `video_production_status` | same | Video recording + editing |
| `ebook_status` | same | eBook integration |
| `qa_status` | same | Quality assurance |
| `deployment_status` | same | LearnWorlds deployment |
| `prep_doc_url` | text | Google Doc URL for tutoring prep sheet |
| `prep_doc_published_url` | text | Published/shared URL |
| `test_slide_url` | text | Google Slides URL for filming |
| `sheet_master_url` | text | Google Sheets whiteboard URL |
| `solutions_page_views` | int | Incremented each time the Solutions Viewer loads |
| `practice_page_views` | int | Incremented each time the Practice Viewer loads |
| `problem_title` | text | Human-readable problem title (e.g. "Long-Term Contract with Interim Loss") |

---

## Core Assets Tab

The `CoreAssetsTab` component (`src/components/CoreAssetsTab.tsx`) shows the Phase 2 production status for all assets with `phase2_status = 'core_asset'` for the active chapter.

### Per-row Tool Buttons (in order)

1. **Sync** (RefreshCw) — calls `sync-hidden-data` edge function, pushes Teaching Asset content to the Hidden_Data tab of the Google Sheet (non-destructive)
2. **Add MC** (ListPlus) — popover to select an Export Set, then calls `sync-mc-to-sheet` to append approved MC questions to the Hidden_Data sheet
3. **Slides** (Film) — creates or opens Google Slides filming template via `create-test-slide`
4. **Prep Doc** (BookOpen) — creates or opens Google Doc tutoring prep sheet via `create-prep-doc`
5. **Solutions** (ExternalLink) — dropdown with iFrame copy options and preview links
6. **Notes** (StickyNote, amber) — shows admin notes if present

### Solutions Dropdown (per-row ExternalLink button)

From the `CoreAssetsTab` and `AssetsLibrary`, the ExternalLink dropdown gives:

- Preview in App → (opens `/solutions/[asset]` — paid view, no paywall)
- Copy Full Solutions iFrame — uses `STUDENT_BASE_URL`
- Copy Preview iFrame — uses `STUDENT_BASE_URL` + `?preview=true`
- Copy Practice iFrame — uses `STUDENT_BASE_URL` for practice route

### Bulk Action Menu (AssetsLibrary)

The "Action for X selected..." dropdown includes:

- Revert to Generated
- Create Whiteboard
- Create Filming Slides
- Generate Google Prep Doc (renamed from "Generate Prep Doc" to clarify it creates a Google Doc)
- Create Test Sheet
- Create Test Slide
- Preview Solutions (Paid) — single asset only, opens `/solutions/[asset]`
- Preview Solutions (Free) — single asset only, opens `/solutions/[asset]?preview=true`

---

## Google Prep Doc (`create-prep-doc` edge function)

Creates a branded Google Doc for each core asset. Used for tutoring sessions and flight prep.

### Document Structure (section order)

1. Branded header — Lee headshot + Survive Accounting logo
2. Problem text (pipe-delimited tables auto-rendered as HTML tables with TSV copy button — admin only)
3. Instructions (labeled a/b/c sub-sections)
4. Journal Entries (3-column table, bold dates, credit indentation)
5. Answer Summary (split by (a)/(b)/(c) sub-sections, year-level formatting)
6. Important Formulas (one per line, monospace, amber background)
7. HOW TO SOLVE THIS (flowchart image if generated)
8. Key Concepts (bulleted list)
9. Exam Traps (bulleted list)
10. Footer links

### Formatting Details

- Tables detected from pipe-delimited text (`SmartTextRenderer` logic)
- TSV copy button shown on tables **in admin/prep doc context only** — hidden in student-facing pages
- "Force Regenerate All" option available: deletes old Drive file before creating new

---

## Flowchart Generation (`generate-flowchart` edge function)

AI generates a JSON structure: `{title, steps[], key_reminders[], formula_recap[]}`

Rendered to HTML then converted to PNG via htmlcsstoimage.com API.

Inserted inline in prep doc as the "HOW TO SOLVE THIS" section.

Skipped gracefully if problem is a simple single-step journal entry.

**Secrets required (set in Supabase):** `HCTI_USER_ID`, `HCTI_API_KEY` ✅ set as of March 2026.

**DB columns needed:** `flowchart_image_url`, `flowchart_image_id` (on `teaching_assets`)

---

## Google Sheets Pipeline

### Edge Functions

| Function | Purpose |
|---|---|
| `create-asset-sheet` | Creates the Google Sheet from template |
| `sync-hidden-data` | Pushes Teaching Asset content → Hidden_Data tab (non-destructive) |
| `sync-mc-to-sheet` | Appends approved MC from Export Set → Hidden_Data MC_QUESTIONS section |
| `sync-asset-sheet-to-template` | Syncs sheet to template structure |

### GAS Scripts (Google Apps Script)

Two GAS scripts have been built and handed to Thea (Sheet Prep VA lead):

**Sheet Script** — Content Panel sidebar, row-hide/show toggles, MC Quiz tab builder, reset quiz. Contains a `SECTIONS` object mapping section keys to tab names and row numbers. **Thea must verify row numbers match the actual template.**

**Slides Script v2** — Content Panel sidebar, `REVEAL_POS` coordinates, `toggleBox`/`hideAllBoxes` functions. Boxes identified by Description (alt text) set to `Box_ProblemText`, `Box_Instructions`, etc. **Thea must set the Description/alt text on each Slides text box to match `REVEAL_POS` keys.**

---

## LearnWorlds MC Export (`QuizzesReady.tsx`)

Generates CSV files for LearnWorlds quiz import.

### CSV Format

Columns: Group, Type, Question, CorAns, Answer1–Answer10, CorrectExplanation, IncorrectExplanation

Journal Entry answers formatted as: `"Dr Account 35,600 / Cr Account 36,000"`

Default IncorrectExplanation: "Not quite! Review the problem scenario and try again. Each answer choice reflects a common approach — make sure you're recording the correct accounts, amounts, and debits/credits."

### DB Columns

`lw_html_added` (boolean), `lw_csv_exported_at` (timestamptz) on `teaching_assets`.

### Two Tabs

The QuizzesReady page has two tabs: CSV Export and HTML Checklist.

---

## Phase 2 Asset Counts (IA2)

Phase 1 for IA2 (Chapters 13–22) was completed by John King VA in approximately 18 hours 22 minutes, producing **501 teaching assets**.

---

## Pending Phase 2 Work

### High Priority (student-facing fixes)

- [ ] Instructions section not rendering in SolutionsViewer/PracticeViewer — fix prompt written, checks `instruction_1` through `instruction_5`, falls back to `instruction_list`
- [ ] Problem title (`source_ref` + `problem_title`) not showing in identifier bar
- [ ] "Copy as TSV" button showing on tables in student pages — needs `hideCopyButton` prop
- [ ] Reveal Solution sub-section formatting — parse `(a)`, `(b)`, `(c)` markers and year labels
- [ ] Run `generate-flowchart` edge function prompt in Lovable
- [ ] Test flowchart on `IA2_CH17_P050_A` after running

### Domain / URLs

- [ ] Run `STUDENT_BASE_URL` prompt to ensure all iFrame and preview links use `learn.surviveaccounting.com`
- [ ] Verify all iFrame copy functions in `CoreAssetsTab.tsx` and `AssetsLibrary.tsx` use `STUDENT_BASE_URL`

### Content Production

- [ ] Run 12 Phase 3 study tool prompts (Flashcards, Formula Recall, Entry Builder, Problem Dissector — 3 prompts each)
- [ ] Force Regenerate All prep docs per chapter after formatting overhaul
- [ ] Backfill `problem_title` from `chapter_problems` to `teaching_assets` via migration
- [ ] Ensure OCR `extract-ocr` edge function stores problem titles going forward

### GAS Scripts (Thea)

- [ ] Verify SECTIONS row numbers in Sheet script match actual template rows
- [ ] Set Description (alt text) on each Slides text box to match REVEAL_POS keys
- [ ] Test Content Panel sidebar in both Sheet and Slides

### Ops

- [ ] Set `LEE_HEADSHOT_URL` in Lovable env vars as `VITE_LEE_HEADSHOT_URL`
- [ ] Set `LEARNWORLDS_ENROLL_URL` in `app_settings` table via `/accy304-admin`
- [ ] Wednesday 8PM PHT meeting: John King + Thea + new Content Creation VA

---

End of phase2-content-production.md
