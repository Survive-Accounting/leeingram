# SEO & Marketing — Overview

## Overview

Survive Accounting has significant SEO potential, particularly through the Solutions Viewer pages. This document captures the current state and open questions for an SEO + marketing strategy.

---

## SEO Opportunity — Solutions Pages

Each solutions page at `learn.surviveaccounting.com/solutions/:assetCode` represents a unique, high-value accounting problem walkthrough.

With 500+ IA2 assets and thousands more planned, these pages could rank for highly specific accounting exam queries:

Examples of high-intent queries:
- "Intermediate accounting revenue recognition journal entry"
- "IFRS 15 percentage of completion method example"
- "Bond issued between interest dates journal entry walkthrough"
- "P17-10 intermediate accounting solution"

Students searching for specific textbook problem solutions are extremely high-intent. These are exactly the people who would pay for a Study Pass.

---

## Current Technical Problem — CSR

The main app (`learn.surviveaccounting.com`) is a **Vite + React SPA** built in Lovable.

**Problem**: React SPAs are Client-Side Rendered (CSR). Search engine crawlers see an empty HTML shell until JavaScript executes. This means:

- Page titles and meta descriptions may not be indexed correctly
- Content in reveal toggles (the actual solution text) is invisible to crawlers
- Structured data / schema markup is not present

**Fix options** (in order of complexity):

1. **Meta tags only** (quick win): Add dynamic `<title>` and `<meta description>` tags per asset using `react-helmet` or Vite's HTML manipulation. Crawlers at least see the page title and description even if not the full content.

2. **Prerendering** (medium): Use a service like `prerender.io` or Vite SSG to generate static HTML snapshots of key pages. Lovable-compatible.

3. **SSR / Next.js migration** (large): Full server-side rendering. Not practical on the current Lovable stack.

**Recommended starting point**: Dynamic meta tags + Open Graph tags. This gets social sharing working and gives crawlers the page title/description. Then evaluate prerendering based on how much organic traffic that drives.

---

## Open Graph / Social Sharing

Every solutions page should have:

```html
<meta property="og:title" content="[Problem Title] — Survive Accounting" />
<meta property="og:description" content="Free accounting solution walkthrough for [source_ref]. Journal entries, key concepts, exam traps." />
<meta property="og:image" content="[Lee headshot or branded card]" />
<meta property="og:url" content="https://learn.surviveaccounting.com/solutions/[assetCode]" />
```

When a student shares a preview link, it should render a rich card in iMessage, Slack, Discord, etc.

---

## robots.txt

`/public/robots.txt` already exists. Should allow crawling of `/solutions/*` and `/cram/*` routes.

---

## Marketing Channels

### Organic Search (SEO)
- Solutions pages as landing pages (see above)
- High-intent accounting exam queries
- Textbook-specific problem queries ("P17-10 horngren solution")

### ACCY304 Landing Page
- `learn.surviveaccounting.com/accy304`
- .edu email lead capture
- Pick-one-send-one: student picks a free problem, gets it via email
- Discount nudge in delivery email
- "Browse 500+ Practice Problems" positioned above the fold

### Greek Organization Channel
- Self-service portal drives bulk B2B sales
- One deal = 10–50 student activations
- Academic chairs / chapter presidents are the buyers

### LearnWorlds Built-in
- Students already in LW courses are an existing audience
- Solutions embeds drive tool discovery organically
- Cram Tool and Dissector showcased in topic videos

### Future
- YouTube: Short-form problem walkthrough clips
- TikTok/Reels: "Accounting exam trap" style content
- Reddit: r/Accounting, r/CPA, university subreddits

---

## Landing Page Plans

- `/accy304` — Ole Miss ACCY 304 specific (live)
- Future: `/accy301`, `/accy302` etc. per course
- Future: campus-specific landing pages (Ole Miss, Alabama, Auburn)
- Greek portal org pages double as public landing pages

---

## Key Assets for Marketing

| Asset | URL |
|---|---|
| Lee headshot | `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg` |
| Hero/bio image | `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/f10e00cd3462ea2638b6e6161236a92b.png` |
| Logo | `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png` |
| Testimonial embed | `317c8816-eefb-469f-8173-b79efef6c2fa` |
| Book tutoring | `https://app.squareup.com/appointments/book/30fvidwxlwh9vt/LY1BCZ6Q74JRF/start` |

---

## Pricing (Current)

- Full semester pass: $125 (50% off, normally $250, expires May 16 2026)
- Per-chapter: $30
- Greek org bulk: $100–$150/pass depending on quantity
