## Goal

Tonight's launch needs the V2 Solutions Viewer to feel less like a "problem viewer" and more like a "cram tool that tells me exactly what to do next." Focus on three quick wins: **clearer problem text**, **better quick-help buttons (with one primary CTA)**, and **lightweight feedback collection** that doesn't interrupt cramming.

Everything is scoped to be safe to ship in a single pass — no schema migrations required.

---

## What Will Change

### 1. Problem card — readability pass (left column)

File: `src/pages/v2/SolutionsViewerV2.tsx` (lines ~1280–1393)

- Add a **Topic chip** above "Practice based on …" when `chapter.chapter_name` exists: "Ch 7 · Inventory Costing".
- Render the problem text with **SmartTextRenderer** (already in repo) instead of raw `whitespace-pre-wrap`. This auto-detects pipe tables (Date/Activity/Units/Cost…) and renders them as proper styled tables on the dark card. Falls back to paragraphs for normal prose.
- Increase paragraph spacing (`space-y-3`) and ensure long lines wrap nicely (drop `max-w-prose` on dark card, replace with `max-w-[68ch]`).
- Default the **Instructions** section to **open** and re-label to **"Your Tasks"** with checkbox-style bullets (visual only — no state).
- Keep the same navy background; just add air, structure, and a clear "Your Tasks" heading.

### 2. Quick Help redesign (right column)

File: `src/pages/v2/SolutionsViewerV2.tsx` `InlineExplanation` component (lines ~449–668)

Rename + reorder the four buttons to match how a stressed student thinks:

| Old key | New label | Notes |
|---|---|---|
| `lees_approach` | **Start me off** | hint only, first 1–2 steps |
| `how_to_solve` | **Walk me through it** | full step-by-step — **PRIMARY** |
| `why_it_works` | **Explain the rule** | concept-only |
| `lock_it_in` | **Show the setup** | tables/formulas/structure |

Layout change:
```text
┌─────────────────────────────────────────────┐
│  Choose how you want help                   │
│  Get a hint, see the setup, or walk through │
│  the full solution.                         │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  ▶  Walk me through this problem      │  │  ← large red primary
│  └───────────────────────────────────────┘  │
│                                             │
│  [ Start me off ]  [ Show the setup ]       │
│  [ Explain the rule ]  [ Journal Entries ]  │
└─────────────────────────────────────────────┘
```

- Replace card heading "Get Quick Help" → **"Choose how you want help"** + subtext.
- Print PDF stays in the top-right of the card.
- The active section still renders below in the existing "Your Study Workspace"-style panel — re-label that panel header to **"Your Study Workspace"** and use the new button label as the section title.
- Keep the existing `ExplanationFeedback` thumbs Yes/Not really at the bottom (already implemented and writes to `explanation_feedback`).

**No prompt/edge-function changes.** The `lees_approach`/`how_to_solve`/`why_it_works`/`lock_it_in` keys keep their existing meaning so cached responses in `explanation_feedback`/`survive-this` continue to hit. Only the labels students see change.

### 3. Lightweight "magic wand" feedback prompt

A small **slide-up card** in the bottom-right corner that appears once per session after meaningful activity, instead of every-10th-navigation modals.

Triggers (whichever happens first):
- 5 problems viewed in this session, OR
- 2 quick-help buttons clicked, OR
- 8 minutes on the site

Content:
> **Quick favor?**
> If we could wave a magic wand and make this the perfect study tool for you, what would it do?
> [ ★★★★★ rating ]
> [ textarea — optional ]
> [ Send ]   [ Not now ]

Storage: writes to existing `explanation_feedback` table (reuse — `note` field for the wish, `reason` array can hold `["wand_prompt", "rating_4"]`). No migration needed for tonight; we can split into a dedicated table later.

Dismiss state stored in `localStorage` (`sa_wand_shown=1`) so it never nags the same student twice.

### 4. Quick wins on copy and visual hierarchy

- Floating "Need help?" bubble (already on page) → relabel to **"Stuck? Ask Lee"**.
- After a thumbs-up on Quick Help, the existing share CTA stays.
- Show toast **"Saved — we'll use this to make it better"** after wand feedback.

---

## What We Are NOT Doing Tonight

To keep the launch safe, these are explicitly deferred (good follow-ups for week 2):

- "Practice another version" / AI clone problem
- Confidence buttons ("Still lost / Getting there / I could do this on an exam") — needs a new table
- Per-AI-response thumbs (already partially exists on `survive_ai_responses`; not refactoring tonight)
- Tabbed Hint / Setup / Solution / Why — current single-section reveal is fine for v1
- New `prompt_version` column on cache — keep current cache shape

---

## Files Touched

- `src/pages/v2/SolutionsViewerV2.tsx` — problem card formatting, Quick Help redesign, wand feedback widget
- (no edge function, no DB migration, no Supabase config changes)

---

## Risk

Very low. All changes are UI-only on a single page, reuse existing tables (`explanation_feedback`), and preserve existing AI section keys so cached responses still work. If anything misbehaves, reverting is one-file.
