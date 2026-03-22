# Solutions Viewer — Architecture & DRM

## Overview

The Solutions Viewer is the primary student-facing tool at `learn.surviveaccounting.com/solutions/:assetCode`.

It renders a full accounting problem solution page that can be:
- Embedded in LearnWorlds via iFrame
- Shared as a public preview link
- Accessed directly with a preview token

---

## Access Control — DRM Logic

The viewer checks access in this priority order:

1. **Authenticated admin** → always full access, no checks needed
2. **Valid `preview_token`** (URL param) → full access for token holders
3. **`?ref=lw` + valid LW referrer** → full access (student is inside LearnWorlds)
4. **`?ref=lw` without valid LW referrer** → preview/paywall
5. **`?preview=true`** → preview mode
6. **No params** → preview mode

### LW Referrer Validation

When `?ref=lw` is present, the viewer checks `document.referrer` against a whitelist:

Valid referrer domains:
- `learnworlds.com`
- `surviveaccounting.learnworlds.com`
- `learn.surviveaccounting.com`
- `surviveaccounting.com`

Once validated, `sessionStorage` key `sa-lw-verified` is set so the check persists within the session.

---

## Standard Embed URL Format

All LearnWorlds embed codes should use this format:

```
https://learn.surviveaccounting.com/solutions/[asset_code]?ref=lw&lw_user_id={{USER_ID}}&lw_email={{USER_EMAIL}}&lw_name={{USER_NAME}}&lw_course={{COURSE_ID}}&lw_unit={{UNIT_ID}}
```

The LW variables (`{{USER_ID}}` etc.) are injected by LearnWorlds at render time, passing student identity into the embed for analytics tracking.

---

## Preview vs Paid Mode

**Preview mode**: Problem text + instructions always visible. All reveal toggles show a paywall card instead of content.

**Paid mode**: All sections fully unlocked.

**Share link rule**: Share buttons always append `?preview=true` regardless of viewer's current mode. A paid student sharing a link should never grant free access to others.

Toast on share: `"Preview link copied — recipients will need a Study Pass for full access"`

---

## Floating Panel (bottom of viewer)

The viewer includes a floating panel with:
- **Problem Dissector** → highlights key numbers and exam traps inline
- **Chapter Cram Tool →** link (opens `/cram/[chapterId]`)
- Dark/light toggle (stored in localStorage `sa-viewer-theme`)

---

## Event Tracking — `asset_events` Table

Every viewer interaction fires an event to the `asset_events` table:

| Event Type | When Fired |
|---|---|
| `page_visit` | On load |
| `lw_embed_load` | When loaded inside LW iFrame |
| `share_click` | Share button pressed |
| `reveal_toggle` | Each section opened |
| `time_on_page` | On `beforeunload` |
| `buy_click` | Paywall CTA clicked |
| `heartbeat` | Every 60 seconds |

### Fields Captured

- `lw_user_id`, `lw_email`, `lw_name` (from URL params)
- `lw_course_id`, `lw_unit_id` (from URL params)
- `is_lw_embed` (boolean — was it loaded inside LW?)
- `is_preview_mode` (boolean)

---

## Asset Stats Dashboard (`/asset-stats`)

Replaces the old `/share-leaderboard` route.

Shows:
- Course tabs (IA2, IA1, etc.)
- Chapter leaderboard — total views, embed loads, reveals per chapter
- Asset detail modal with recharts charts
- Students tab — which LW users are engaging with which assets

---

## Sections (Reveal Toggles)

Always visible (no gate):
- Problem text (pipe-delimited tables auto-render)
- Instructions — labeled `(a)`, `(b)`, `(c)` etc.

Reveal toggles (paid = unlock, preview = paywall card):
- Reveal Solution (`answer_summary`)
- Reveal Journal Entries
- Reveal How to Solve This (flowchart)
- Reveal Important Formulas
- Reveal Key Concepts
- Reveal Exam Traps

---

## Branding Elements

- Top bar: Lee headshot + "Survive Accounting / by Lee Ingram"
- Headshot URL: `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg`
- Green badge: "✦ Deeper than a solutions manual — built from 10+ years of Ole Miss tutoring"
- Identifier bar: `source_ref — problem_title` (e.g. "P17.10 — Long-Term Contract with Interim Loss")
- About Lee card at bottom with Aoraki image
- Aoraki image: `https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/88d6f7c98cfeb62f0e339a7648214ace.png`
