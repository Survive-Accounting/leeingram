# Phase 2 — Topic System

## Overview

The Topic System is the first step of Phase 2 content production. It organizes approved teaching assets into logical topic groups that drive video production, quiz generation, and the Chapter Cram Tool.

Route: `/phase2-review`

---

## Why Topics Exist

Each chapter has 40–100+ teaching assets. Before producing videos and quizzes, assets must be grouped into teachable topics so that:

- Videos cover a coherent concept (not a random mix)
- Quizzes test a specific topic, not the entire chapter
- The Cram Tool shows focused JEs rather than 100+ entries
- Students have a clear mental map of chapter structure

Target: **5–6 core topics per chapter** on average. Maximum 8.

---

## Database — `chapter_topics` Table

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `chapter_id` | uuid | FK to chapters |
| `topic_name` | text | Display name (e.g. "Bond Issuance and Amortization") |
| `topic_number` | int | Sort order (1–8, 99 for supplementary) |
| `topic_description` | text | What this topic covers |
| `topic_rationale` | text | Why these assets belong together |
| `video_url` | text | LW video link when produced |
| `quiz_url` | text | LW quiz link when produced |
| `is_active` | boolean | True = visible topic, false = collapsed/merged away |
| `is_supplementary` | boolean | True = "Supplementary Problems" catch-all topic |
| `merged_into_topic_id` | uuid | If merged, points to the receiving topic |
| `display_order` | int | Current sorted position |
| `original_asset_codes` | text[] | AI-assigned assets at generation time (never auto-changed) |

### `chapters` Table Additions

| Column | Type | Description |
|---|---|---|
| `topics_locked` | boolean | True = topics finalized |
| `topics_locked_at` | timestamptz | When locked |
| `topics_locked_count` | int | How many core topics at lock time |

---

## Topic Generation — Edge Function

Edge function: `generate-chapter-topics`

- Always generates exactly **10 topics** internally
- Uses `claude-sonnet-4-20250514` model
- Analyzes all approved teaching assets in the chapter
- Returns: topic names, descriptions, rationale, and initial asset assignments
- Stores `original_asset_codes` at generation time — this field is NEVER auto-updated after initial generation
- Also creates one special `is_supplementary = true` topic ("Supplementary Problems") with `topic_number = 99`

---

## Slider Behavior

The slider controls how many **core topics** are visible. Range: **5–8**.

Default: 6.

- Slider DOWN (e.g. 8 → 6): Topics 7 and 8 collapse. Their assets move to **Supplementary Problems**.
- Slider UP (e.g. 6 → 8): Topics 7 and 8 reappear. Assets return FROM Supplementary IF they haven't been manually reassigned.
- Manual reassignment always wins — slider restore never overrides a human decision.

---

## Supplementary Problems Topic

Always the last item in the list. NOT counted in the slider number.

- `is_supplementary = true`
- `topic_number = 99`
- Visually distinct: gray "S" badge instead of numbered badge, muted styling
- Catches: slider-collapsed assets, edge-case problems that don't fit a core topic
- Can have its own video and quiz URL
- Cannot be merged into or deleted
- Assets in Supplementary are tagged to a real `topic_id` — they are not untagged

---

## Drag-to-Merge

Intentional merging between two active core topics:

1. Drag one topic card onto another
2. Confirm merge dialog appears
3. Assets from source topic move to receiving topic
4. AI auto-renames the combined topic
5. Source topic collapses with "Merged into [Topic] ↑" label + Undo button

The slider never forces a merge. Only intentional drag initiates a merge.

---

## Locking Topics

"Lock Topics" button sets `chapters.topics_locked = true`.

On lock:
- Shows summary: "Locking [N] core topics + Supplementary Problems ([X] total assets tagged)"
- Slider and merge are disabled after lock
- Asset reassignment within topics still works after lock
- Lock is reversible — "Unlock" sets the flag back to false

---

## Effect on Chapter Cram Tool

When `chapters.topics_locked = true`:
- Cram Tool only shows JEs from assets with a `topic_id` assigned
- Assets in Supplementary Problems are included (shown at end)
- Untagged assets are excluded
- Small note shown: "Showing JEs from [N] core topics"

When not locked:
- Cram Tool shows all chapter assets (fallback)
- Note shown: "Showing all chapter JEs — lock topics to focus this tool"

---

## Pipeline Progress Strip

The Phase 2 pipeline strip shows:
`Topic Generator | Quiz Queue | Video Queue | Deployment`

Topic Generator step is marked complete when `topics_locked = true`.
