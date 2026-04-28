## Goal

Make the study previewer on `/` (StagingLandingPage) **identical** to the one on `/my-dashboard` (StudentDashboard), so future tool changes flow to both pages. The `/` version is gated by the existing beta paywall; `/my-dashboard` stays ungated. Admins viewing `/` behave like a normal logged-out user (so beta walls are testable).

## What's actually live today

- `/my-dashboard` renders the new flow: course/chapter selector card → `StudyToolCards` (Practice / JE / "Add a tool") → workspace pane that loads the Practice Problem Helper iframe (`/v2/solutions/:assetCode`) or the JE "coming soon" panel.
- `/` renders `StagingLandingPage`, which uses the **older** `StagingCoursesSection` (laptop preview + chapter dropdown + `BetaPaywallModal`). The newer `CourseExplorerSection.tsx` exists in the repo but is unused — that explains why none of the recent prompts showed up on `/`.
- `BetaPaywallModal` already exists (`src/components/landing/BetaPaywallModal.tsx`) — single CTA "Start Studying" that triggers `onJoinBeta`.

## Plan

### 1. Extract a shared `StudyPreviewer` component

Create `src/components/study-previewer/StudyPreviewer.tsx`. Lift the dashboard's previewer block (everything between the welcome heading and Share band) into it:

- Course/chapter selector card (the white rounded card with "Your course" + chapter dropdown)
- `StudyToolCards` (already a component — keep as-is)
- Workspace pane (header strip + iframe for Practice; "coming soon" panel for JE; empty-state message)
- Internal state: `selectedChapterId`, `activeTool`, `viewerAssetCode`, `chapterLoading`
- Internal handlers: `handleChapterChange`, `handleSelectTool`, `handleNudgeChapter`
- Receives via props:
  - `chapters: Chapter[]` (already-loaded chapter list)
  - `campusName?: string | null`, `courseLabel?: string | null` (for the header)
  - `onRequestUnlock?: (action: "select_tool" | "select_chapter" | "open_workspace") => boolean` — when provided AND it returns `false`, the action is blocked and the parent shows the paywall (used on `/`). When omitted (dashboard), everything works normally.
  - `onOpenFeedback: () => void`
  - `assetUrlBuilder?: (assetCode) => string` — defaults to `/v2/solutions/:code` (kept as-is for both pages so behavior is identical).
  - `persistChapterKey?: string` — passes the localStorage key through (dashboard keeps its key; landing uses a separate key or none).

### 2. Refactor `StudentDashboard.tsx`

Replace the inline selector + StudyToolCards + workspace section with `<StudyPreviewer chapters={chapters} campusName={campusName} courseLabel={courseLabel} onOpenFeedback={() => setFeedbackOpen(true)} persistChapterKey="sa.dashboard.chapterId" />`. No behavior change.

### 3. Mount `StudyPreviewer` on `/` (StagingLandingPage)

Add a new section between the existing `StagingCoursesSection` and `AskAnythingSection` (or replace the laptop area entirely — see Question A below). On `/`:

- Show a **course pill row** (Intro 1 / Intro 2 / Intermediate 1 / Intermediate 2) above the previewer so visitors can pick which course's chapters to load.
- Once a course is picked, fetch chapters for that course (same query the dashboard runs) and pass to `<StudyPreviewer>`.
- Pass an `onRequestUnlock` that always returns `false` for unauthenticated users (and for admins when the test-mode toggle below is on). When it returns `false`, open the existing `BetaPaywallModal`. Its "Start Studying" CTA calls the existing `requestAccess({ course: defaultCourse.slug })` flow (same one already wired on the page).
- Allow free **browsing** of chapters/courses on `/` (so the previewer feels alive). Gate only the meaningful interactions: clicking a study tool card and loading the workspace iframe. This matches the previous laptop-preview pattern where chapter selection was free but unlocking content showed the paywall.

### 4. Admin-as-normal-user on `/`

In `StagingLandingPage`, do **not** branch on `useIsStaff` for the previewer — admins see the same gating as anonymous visitors. (Admins can still reach the real workspace via `/my-dashboard` or `/admin`.) This guarantees the beta wall can be QA'd live.

If we want an explicit override for admins to bypass when needed, gate it behind a `?preview_unlock=1` query param rather than the staff hook — keeps default admin experience identical to a student.

### 5. Cleanup

- Keep `CourseExplorerSection.tsx` for now (unused) — leave a note for later removal. Do **not** wire it; the dashboard previewer is the source of truth.
- Keep `StagingCoursesSection` mounted on `/` as the course-cards section it currently is (the four big course cards with chapter accordions). The new `StudyPreviewer` lives **above or below** it — see Question A.

## Technical notes

- Files added: `src/components/study-previewer/StudyPreviewer.tsx` (~250 lines lifted from StudentDashboard).
- Files edited: `src/pages/StudentDashboard.tsx` (replace inline section with component), `src/pages/StagingLandingPage.tsx` (mount previewer + paywall wiring).
- No DB or edge-function changes. No new dependencies. The iframe target `/v2/solutions/:assetCode` already works for any visitor (DRM enforced at the viewer layer), so paywall gating only needs to block the user-action level (clicking a tool card / opening workspace) rather than the iframe URL.

## Questions before I build

I'll ask these next so I can build the right thing.
