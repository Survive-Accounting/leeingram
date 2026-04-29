## Where the JE Helper actually lives today

There are **two** things, and they got out of sync:

1. **A fully built V1 tool** — `src/pages/EntryBuilderTool.tsx` at the route `/tools/entry-builder?chapter_id=…`. It's a real interactive helper backed by the `entry_builder_sets` / `entry_builder_items` / `entry_builder_accounts` tables, with a paywall preview mode (`&preview=true`, first 2 entries free), play/completion tracking, share link, etc. This is the JE Helper we built.

2. **A placeholder** in the V2 Study Previewer (`src/components/study-previewer/StudyPreviewer.tsx`, lines 796–820) that shows the "Journal Entry Helper is being built — Tell us what you'd want" card you screenshotted. It's wired into both the landing demo (`LandingStudyPreviewerSection`) and `/my-dashboard` (`StudentDashboard`), but it never loads the real tool.

So nothing in V2 ever points at the V1 tool. That's why beta users can't reach it.

A second issue: **`entry_builder_sets` is currently empty** (0 rows across all chapters). The V1 tool will show "No entry builder set found" until an admin generates a set per chapter via `/study-tools/entry-builder`. Wiring is meaningful regardless, but you'll want to generate at least one chapter's set so beta users see something.

## Plan

### 1. Replace the JE placeholder with an iframe of the V1 tool

In `StudyPreviewer.tsx`, swap the `activeTool === "je"` placeholder block (lines 796–820) for the same iframe pattern already used by the Practice Problem Helper directly above it (lines 715–756): skeleton, load/error states, retry button, identical chassis.

The iframe `src` becomes:

```text
/tools/entry-builder?chapter_id=<selectedChapterId>&preview=true&embed=1
```

- `chapter_id` — the chapter the student picked in the retro terminal
- `preview=true` — keeps the existing 2-entry free preview / paywall behavior the V1 tool already implements
- `embed=1` — new flag (see step 2) so the V1 tool hides its own outer chrome when shown inside the laptop frame

If no chapter is selected we never get here (the tool launcher already requires it), so no extra empty state needed. If the chapter has no generated set, the V1 tool's existing "No entry builder set found" message shows inside the frame — acceptable for now and matches its current behavior elsewhere.

### 2. Add a lightweight `embed=1` mode to `EntryBuilderTool.tsx`

The V1 page renders its own header/back-button/branding sized for a full window. Inside the V2 laptop screen we want a clean fit:

- Read `embed = searchParams.get("embed") === "1"`
- When `embed`, hide the page-level outer header strip and bottom padding so the tool fills the iframe
- No data/logic changes — just conditional chrome

This keeps `/tools/entry-builder` working standalone (share links, direct visits) while making it embeddable.

### 3. Update both V2 entry points

Both already render `<StudyPreviewer>` and pass `chapters` + selected chapter through props, so no changes are needed beyond step 1:

- `src/components/landing/LandingStudyPreviewerSection.tsx` (the `/` demo terminal)
- `src/pages/StudentDashboard.tsx` (`/my-dashboard`)

The "Journal Entry Helper" tool tile is already in `TERMINAL_TOOLS` and shows in both places — it just routed to a placeholder.

### 4. Confirm one chapter has a generated set so beta users see real content

After the wiring lands, generate a set for the chapter you want beta users to land on (via the existing admin flow at `/study-tools/entry-builder`). I don't need to change generation code for this task — flagging it so the demo isn't empty on day one.

### Out of scope

- Killing the "Tell us what you'd want" feedback card entirely. The Help Shape What's Next tile in the same row already handles that, so no separate placeholder is needed once the real tool loads.
- Changes to V1 routes, the Entry Builder data model, or paywall logic.
- Touching the V1 Solutions Viewer (out of scope per your earlier rule: V2 only).

## Open question

Confirm the embed should use `preview=true` (free 2-entry preview, then paywall) for **both** the landing demo and `/my-dashboard`. On `/my-dashboard` paid students should arguably get the full set without the paywall — but the V1 tool currently keys "preview" off the URL param, not auth. If you want paid users to bypass the paywall on dashboard, I'd add an `isPaid` check in `StudentDashboard`'s prop wiring and drop `preview=true` for them. Tell me which behavior you want and I'll build it that way.
