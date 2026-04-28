# "Stuck?" Support Flow — Solutions Viewer V2

## What changes

Replace the existing **"Stuck? Ask Lee"** floating button on `/v2/solutions/:assetCode` with a cleaner, beta-feedback-flavored **"Stuck?"** button + modal. The modal lets students report 1 of 4 issue types, write a short note, and (optionally) attach a snapshot of the current problem so we have full context server-side.

The current `NeedHelpModal` ("Send Lee a question, he'll reply by email") is replaced. The other existing report flow (the small "Report issue" link under the problem card → `ReportIssueModal` → `problem_issue_reports` table) stays untouched — that one is for tagging text issues; this new one is the broad student-feedback funnel.

All submissions write to the existing **`chapter_questions`** table — same table the admin Student Inbox already reads — so Lee sees them immediately without any new admin UI work.

## Button

- Floating, bottom-right, same position as today (`fixed right-4 bottom-20`)
- Label: **Stuck?** (icon `MessageCircleQuestion` retained)
- Subtle: smaller pill, lower-contrast border, no red fill — must not compete with the helper buttons (Walk me through it, etc.)
- One button only — currently the file has **two** copies (lines ~1748 and ~2308, one for the embed/iframe context, one for the standalone page). Both get updated to the new label and both open the same new modal.

## Modal: `StuckSupportModal`

```text
┌─ What's going on? ────────────────────┐
│ Help us fix it or point you in the    │
│ right direction.                       │
├───────────────────────────────────────┤
│ ◉ Question about this problem         │
│   I'm confused and need help          │
│   understanding it.                    │
│                                        │
│ ○ Problem text / instructions issue   │
│   Something looks wrong, missing,     │
│   or unclear.                          │
│                                        │
│ ○ Walkthrough / solution issue        │
│   The explanation, math, or setup     │
│   seems off.                           │
│                                        │
│ ○ Something else                      │
│   Share general feedback or another   │
│   issue.                               │
├───────────────────────────────────────┤
│ Tell us what happened.                │
│ ┌───────────────────────────────────┐ │
│ │ What confused you, what looked    │ │
│ │ wrong, or what would make this    │ │
│ │ better?                           │ │
│ └───────────────────────────────────┘ │
│                                        │
│ [✓] Include this problem with my      │
│     report                             │
│                                        │
│         [ Send feedback ]              │
└───────────────────────────────────────┘
```

- Card-style radio options (single-select), keyboard accessible via `RadioGroup` from shadcn
- Email field appears **only** when no email is on file (`localStorage.v2_student_email` empty AND no auth user) — most students have already provided it; reuse silently when we have it
- Include-snapshot checkbox defaults to **on**
- Success: `toast.success("Thanks — we'll review this ASAP.")` then close
- Subtle "Beta feedback — replies come by email" microcopy under the submit button

## Data captured per submission

Written to `chapter_questions` (Insert):

| Column | Source |
|---|---|
| `chapter_id` | `asset.chapter_id` (required) |
| `student_email` | auth email → localStorage fallback → field value |
| `issue_type` | One of: `question`, `problem_text_issue`, `walkthrough_issue`, `general_feedback` (the existing column already takes free-form strings; the admin Student Inbox treats anything ≠ `question` as a fix/feedback ticket) |
| `question` | The textarea content + a structured **Context block** appended below `---` so Lee sees everything in one place |
| `asset_name` | `asset.asset_name` |
| `source_ref` | `asset.source_ref` |

The structured Context block (when "Include this problem" is checked) appends:

```text
---
Context (auto-captured):
- Course: <courseLabel>
- Chapter: Ch <n> · <chapter_name>
- Problem: <asset.asset_name> (ref <source_ref>)
- View mode: <viewMode>           ← split-view state added in the previous task
- Active helper: <walk_through | hint | setup | full_solution | none>
- Page URL: <window.location.href>
- Device: <navigator.userAgent>
- Timestamp: <ISO>
- Problem text snapshot:
  <first 800 chars of asset.survive_problem_text>
- Helper state:
  <e.g. "Simplified text shown" / "Walkthrough open" / "—">
```

This keeps everything inside the existing column without a schema change.

### Why no schema migration

- `chapter_questions` already accepts free-form `issue_type` strings; the admin StudentInbox already filters on it
- Stuffing structured context into the `question` text means zero migration risk and Lee sees it inline in his existing inbox
- If we later want first-class columns (selected_tool, view_mode, snapshot), that's a separate, additive migration

## State to thread into the modal

The modal needs to know:
- `asset`, `chapter`, `courseLabel` — already in scope at the call site
- `viewMode` — already in scope (added in prior task)
- `simplifiedText` (helper state hint) — already in scope
- `activeHelper` — currently the page tracks which helper button is "open" via local state inside `InlineExplanation`. To avoid plumbing a callback through, we'll read the most recent helper from a tiny new state in the parent (`activeHelper: string | null`) and update it via an existing `onAdvanceTask` neighbor — minimal plumbing.

## Implementation steps

1. **Add `StuckSupportModal`** as a new internal component near the existing `NeedHelpModal` in `src/pages/v2/SolutionsViewerV2.tsx`. Uses `Dialog`, `RadioGroup`, `Textarea`, `Checkbox`, `Button` from shadcn (`Checkbox` may need to be added to the imports — verify).

2. **Replace both floating buttons** (lines ~1748 and ~2308):
   - Text → "Stuck?"
   - Same `setHelpOpen(true)` handler
   - Tone down styling: `bg-card/80 backdrop-blur border` instead of solid card, smaller height (`h-9` instead of `h-11`), 13px font

3. **Replace `<NeedHelpModal …>` with `<StuckSupportModal …>`** at line ~2321. Pass `asset`, `chapter`, `courseLabel`, `viewMode`, `simplifiedText`, and the new `activeHelper` ref.

4. **Add `activeHelper` state** to the parent and pass a setter into `InlineExplanation` so each helper button updates it on click. Default `null`. Reset on asset change.

5. **Validation** with zod inline:
   ```ts
   const schema = z.object({
     issue_type: z.enum(["question", "problem_text_issue", "walkthrough_issue", "general_feedback"]),
     note: z.string().trim().min(3, "Add a quick note").max(2000),
     email: z.string().trim().email().max(255),
   });
   ```

6. **Keep `NeedHelpModal` definition** in the file (don't delete) — only its usage is removed. This avoids touching unrelated imports/types and lets us roll back instantly if needed. Mark it `/** @deprecated */` so the next sweep can remove it cleanly.

## Out of scope

- No schema migration (`chapter_questions` already fits)
- No changes to admin Student Inbox UI (it already shows `issue_type` + `question`)
- No changes to the small inline "Report issue" link under the problem card
- No new edge functions or notifications (existing inbox flow notifies Lee)

## QA checklist

- Both floating "Stuck?" buttons open the same modal
- Each issue type submits with the right `issue_type` value and shows up correctly in the admin Student Inbox
- Context block is appended only when the checkbox is checked
- Email is reused silently when present; field appears only when missing
- Submit blocked until an issue type is picked AND the note has ≥3 chars
- Toast says exactly: **"Thanks — we'll review this ASAP."**
- Mobile: modal scrolls cleanly, radio cards remain tappable, no horizontal overflow
- Floating button no longer competes visually with the helper buttons in the right pane
