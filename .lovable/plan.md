## Dashboard Refinements

Polish the `/my-dashboard` hero, Beta Tools section, and the feedback modal copy. Repurpose the navbar CTA into a feedback launcher and add a welcome video placeholder.

### 1. Hero (`StudentDashboard.tsx`)
- Change heading from "Welcome back, {name}" to **"Thanks for joining, {name}"**.
- Add a **welcome video placeholder** in the top-right of the hero row:
  - A clickable card (~280×160) with a play icon, "Watch the welcome video" caption, navy gradient background.
  - Opens a modal with a centered 16:9 video frame (placeholder iframe / "Video coming soon" panel for now).
  - Stack vertically below the heading on mobile.
- Add more breathing room: increase top/bottom padding on `<main>` and gap between hero, welcome card, and beta tools.

### 2. Navbar CTA (`StudentDashboard.tsx`)
- Replace **Start Studying** button with **Submit Feedback** button (same red gradient styling).
- Clicking it opens the existing `FeedbackToolModal` (lifted to dashboard state, or triggered via prop).
- Keep the chapter picker accessible via the existing "Jump to a chapter" section below.

### 3. Beta Tools (`BetaToolCards.tsx`)
- Tool 01 body: "Get instant help for any problem in your chapter." (replaces "Your live tutor…")
- Tool 02 body: "Drill the JEs for deeper understanding." (replaces "Drill the JEs you keep getting wrong. Coming soon.")
- Tool 03 title stays "Help us decide". Add a subline directly under the title:
  > "If we could build you the perfect study tool, what all would it do?"
- Section eyebrow "You're shaping these" → replace with **"Your feedback is implemented in real time"** rendered as a clickable link (same small uppercase style) that opens the feedback modal.
- Lift `feedbackOpen` state up to the dashboard so the navbar button, the tool 03 card, and the eyebrow link all share one modal instance.

### 4. Feedback Modal (`FeedbackToolModal.tsx`)
- Keep the headline "What should we build next?" but make the modal more general (it now also handles Practice Problem Helper / JE Memorizer / suggestions).
- Subtitle: "Share thoughts about the Practice Problem Helper, Journal Entry Memorizer, or any idea."
- Add a small radio/segmented selector for **Topic**: `Practice Problem Helper · Journal Entry Memorizer · General suggestion` (defaults to General). Prefix the message sent to `send-contact-notification` with `[Beta · {topic}]`.
- Textarea placeholder: **"Your feedback is invaluable to us."**

### Technical notes
- All copy/UX changes; no schema or edge-function changes.
- Files touched:
  - `src/pages/StudentDashboard.tsx` — hero copy, video placeholder + modal, lifted feedback state, navbar CTA swap, padding.
  - `src/components/dashboard/BetaToolCards.tsx` — body copy, tool 03 subline, eyebrow link, accept `onOpenFeedback` prop, drop internal modal.
  - `src/components/dashboard/FeedbackToolModal.tsx` — topic selector, subtitle, placeholder, message prefix.
- Welcome video modal uses a simple `<div>` placeholder (no video URL yet); ready to swap an `<iframe>` later.
