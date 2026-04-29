# Journal Entry Helper — MVP Plan (APPROVED SCOPE)

## Decisions locked
1. **Reveal mode**: Account-pattern only. Amounts stay as `???`. No real numbers in v1.
2. **Coverage**: Pull ALL `chapter_journal_entries` regardless of `is_approved` / `is_rejected`. Refine in-place after launch.
3. **Entry point**: Loads inside the **preview monitor** (RetroTerminalFrame) on `/` and `/my-dashboard` — same slot as the Practice Problem Helper. Sibling tool, not a standalone route.
4. **Access tier**: V2 Viewer context. Same gating posture as `SolutionsViewerV2` (paywalled).
5. **A = L + E rubric**: Styled HTML/Tailwind card. No HCTI image.
6. **Walkthrough copy**: Use existing `account_tooltip` verbatim. No AI re-voicing pass.

## Build outline (pending user "build" approval)
- New component: `<JournalEntryHelper />` rendered inside the preview monitor alongside Practice Problem Helper (toggle/tab between the two tools).
- Data: `chapter_journal_entries` + `chapter_je_categories` joined by chapter; group by chapter → category → entry.
- Layout (inside monitor):
  - Left rail: chapter picker + entry list (categorized).
  - Right pane: JE table (account / Dr / Cr) with `???` amounts and per-row tooltip from `account_tooltip`.
  - Footer actions: "Walk me through it" stepper, "Show A = L + E rubric" toggle, thumbs up/down (re-use `explanation_feedback`).
- No DB migrations.
- No new edge functions.

## Postponed (v2+)
- Real-amount reveal mode.
- AI-rewritten tutor-voice walkthrough.
- Standalone `/je-helper` route.
- Approval filtering UI.

## Open items before build
None. Awaiting user "build" command.
