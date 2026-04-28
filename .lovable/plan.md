## SEO Quick Wins + Headshot Favicon

The current `index.html` is hardcoded to ACCY 304 only. We're now multi-course (Intro 1/2, IA1, IA2) and multi-campus, so the title, description, OG tags, and favicon all need to broaden out.

### 1. Favicon → Lee's headshot
- Copy `src/assets/lee-headshot-original.png` (the same headshot used in the Landing hero) to:
  - `public/favicon.png` — main browser tab icon
  - `public/apple-touch-icon.png` — iOS home-screen / bookmark icon
- Confirm the legacy `public/favicon.ico` is no longer referenced (already absent from repo).
- Update `index.html` `<link rel="icon">` to point at `/favicon.png` (replaces the LearnWorlds-hosted JPG).

### 2. Page title + meta description
Replace the ACCY 304-specific copy with course-agnostic messaging:
- **Title**: `Survive Accounting — Pass Your Accounting Exam, Stress-Free` (under 60 chars, brand-first, action verb).
- **Description**: `Step-by-step solutions, journal entries, formulas, and exam traps for college accounting. 2,500+ worked problems by Lee Ingram, tutor since 2015.` (~155 chars).
- Add `<meta name="keywords">` covering core course codes (ACCY 201/202/303/304), "accounting tutor", "journal entries", etc. (low-impact, but cheap).
- Add `<meta name="theme-color" content="#14213D">` for mobile address-bar branding.

### 3. Crawler + canonical
- Add `<meta name="robots" content="index, follow, max-image-preview:large">`.
- Add `<link rel="canonical" href="https://learn.surviveaccounting.com/">` so preview/staging URLs don't outrank the real domain.

### 4. Open Graph + Twitter cards
- Update `og:title`, `og:description`, `twitter:title`, `twitter:description` to match the new course-agnostic copy.
- Add `og:site_name`, `og:url`, and `og:image:alt` (small lift, materially better link previews in iMessage/Slack/X).

### 5. Structured data (JSON-LD)
- Add a single `EducationalOrganization` schema block referencing Lee Ingram as founder. Helps Google show a richer brand panel and ties the site to a named tutor.

### Out of scope (flag for later, not doing now)
- A real `sitemap.xml` (robots.txt already references one but the file doesn't exist — worth a follow-up sprint).
- Per-route `<title>` updates via `react-helmet-async` for `/solutions/:assetCode`, campus pages, etc. — bigger lift, separate task.

### Files touched
- `index.html` — full rewrite of `<head>`.
- `public/favicon.png` — new (copied from `src/assets/lee-headshot-original.png`).
- `public/apple-touch-icon.png` — new (same source).
