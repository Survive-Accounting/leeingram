## Demo Viewer in the Laptop (V2 Solutions Viewer + Beta Paywall)

Replace the current static two-pane laptop preview with a live, embedded V2 Solutions Viewer that students can scroll/navigate inside but cannot interact with for help, PDF, or "Ask Lee". Any blocked action triggers a Beta paywall modal.

### What the user will see

1. **Course pills** (Intro 1, Intro 2, Intermediate 1, Intermediate 2) — already exist above the laptop. Stays.
2. **Chapter selector** appears under the pills:
   - Replace the current Ch.1 / Ch.2 / Ch.3 ... chip row with a single styled `<select>` dropdown ("Choose a chapter…") matching the current minimalist style.
   - On chapter change, the laptop screen swaps to that chapter's first problem.
3. **Inside the laptop screen**: a live, embedded V2 Solutions Viewer (`/v2/solutions/:assetCode?embed=1`) showing the actual student experience — problem text, instructions, "Choose how you want help" panel, "Print PDF", "Stuck? Ask Lee" button, etc.
4. **Read-only behavior**: scrolling and visual navigation work, but every "help" interaction opens a Beta Paywall modal.

### Beta Paywall triggers

Any of these clicks open the Beta Paywall instead of running their normal action:
- "Walk me through this problem" (red CTA)
- "Start me off"
- "Show the setup"
- "Explain the rule"
- "Print PDF"
- "Stuck? Ask Lee" (floating bottom-right button)
- Any "Open full solution", "Suggest Fix", or "Share" actions inside the embed
- Any internal navigation link (sibling problem arrows, "Jump to chapter", etc.)

What still works inside the embed:
- Scrolling within the viewer
- Expanding/collapsing the "Your Tasks" accordion
- Visually reading the problem and right-side panel

### Beta Paywall modal content

- Headline: **"Join the free beta to unlock this."**
- Body: "This is a live preview of the cram tool. Help walkthroughs, PDFs, and Ask Lee are turned on for beta students."
- Primary CTA: **"Join the Free Beta"** → calls the existing `requestAccess` flow (same as the page's other CTAs).
- Secondary: "Maybe later" (closes modal).
- Small line: "Free during beta · No credit card required."

### Technical implementation

**1. Add a `?embed=1` mode to `SolutionsViewerV2`:**
- Read `searchParams.get("embed") === "1"`.
- When embedded:
  - Hide the top breadcrumb/nav bar, sibling-prev/next nav, and the floating "Stuck? Ask Lee" button — OR keep them visible but route every click through a single `requestPaywall()` handler.
  - Intercept the top-level click handlers for: Print PDF button, all four toolbox buttons (`how_to_solve`, `lees_approach`, `lock_it_in`, `why_it_works`), "Stuck? Ask Lee", "Suggest Fix", "Share", and any `<Link>`/`<a>` inside the page.
  - Implementation: in embed mode, wrap the entire page in a `<div>` with an `onClickCapture` handler that:
    - Allows clicks on elements with `data-embed-allow="true"` (the tasks accordion toggle, scroll containers).
    - For everything else, calls `e.preventDefault()` + `e.stopPropagation()` and then `window.parent.postMessage({ type: "sa-embed-paywall" }, "*")`.
  - Disable the auto-open simplify modal in embed mode.

**2. Update `StagingCoursesSection.tsx`:**
- Replace the chapter chip row with a styled `<select>` dropdown.
  - Hidden until a course pill is clicked the first time (or simply default to Intro 1 + Ch. 1 already populated, matching current behavior — the dropdown just sits there instead of chips).
  - Options: `Ch. {n} — {chapter_name}`.
- Replace `LaptopViewer` body with an `<iframe>`:
  - `src="/v2/solutions/{detail.asset_name}?embed=1"`.
  - Same laptop-frame styling (lid, bezel, hinge, 16:10 aspect).
  - `sandbox="allow-scripts allow-same-origin"`.
  - `style={{ pointerEvents: "auto", border: 0 }}` so users can scroll.
- Remove the existing static "Get a guided walkthrough / Show me how to think through this" right-pane mock (no longer needed — the real viewer replaces it).
- Add a `window.addEventListener("message", ...)` listener: on `{ type: "sa-embed-paywall" }`, open the BetaPaywallModal.

**3. New component: `BetaPaywallModal.tsx`** (in `src/components/landing/`):
- Built on `Dialog` from shadcn/ui.
- Props: `open`, `onOpenChange`, `onJoinBeta`.
- Calls `onJoinBeta()` (which the parent wires to `requestAccess({ course: defaultCourse.slug })`).

**4. Loading + empty states:**
- While the iframe loads (no problem yet), show the existing spinner overlay on top.
- If no chapter selected, show a soft "Pick a chapter to load a problem" message inside the screen.

### Out of scope
- Server-side gating — paywall is UX only; the V2 viewer route remains publicly viewable directly via URL (matches existing public DRM model).
- No changes to the V2 viewer outside of the embed-mode click guard.
- No changes to other landing sections, the red CTA, or the Ask Anything section.

### Files touched
- `src/components/landing/StagingCoursesSection.tsx` — chapter dropdown + iframe + postMessage listener
- `src/components/landing/BetaPaywallModal.tsx` — new
- `src/pages/v2/SolutionsViewerV2.tsx` — `?embed=1` mode with global click interceptor
