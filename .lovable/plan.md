## Text Edits Plan

Three small copy changes across two files on the staging landing page (`/`).

### 1. Social proof pill — `src/pages/StagingLandingPage.tsx` (line 387)
Change the "10+ years tutoring" pill to read "Based on 10+ years tutoring".

- Update the stat object so the chip displays the new wording. Simplest approach: change `bold` to `"Based on 10+"` and keep `label: "years tutoring"`, so the rendered pill reads **Based on 10+** years tutoring.

### 2. Section subtitle — `src/components/landing/StagingCoursesSection.tsx` (line 331)
Replace:
> Fast, efficient tools — built by a real tutor, not a textbook.

With:
> Pick a problem. Get a quick explanation when you're stuck. Try it below!

### 3. Section heading — `src/components/landing/StagingCoursesSection.tsx` (line 325)
Replace:
> Explore what you'll get

With:
> Built for how students actually study

### Notes
- Pure copy changes; no styling, layout, or component structure changes.
- No other occurrences of these strings exist in the codebase.
- Heads up: you can make simple text edits like these for free using **Visual Edits** (pencil icon at the bottom-left of the chat) — faster and no credits used.
