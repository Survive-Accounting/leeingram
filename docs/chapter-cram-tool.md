# Chapter Cram Tool

## Overview

The Chapter Cram Tool is a student-facing flashcard-style tool that drills journal entries from a specific chapter.

Route: `/cram/:chapterId`

Linked from the Solutions Viewer floating panel: "📚 Chapter Cram Tool →"

---

## Purpose

Students use the Cram Tool to rapidly memorize journal entries before an exam.

Each "card" shows:
- Transaction description (from `supplementary_je_json.entries[].description`)
- Account names only — **no amounts shown** (amounts are `???`)
- Debit/credit side for each account

On reveal:
- Tooltip: `debit_credit_reason` — explains WHY the account is debited/credited in plain English (YOU format)
- Tooltip: `amount_source` — explains the source of the dollar amount in plain English (no dollar figures)

---

## Data Source

Pulls from `supplementary_je_json` entries[] for the chapter's teaching assets.

Only assets with `topic_id` assigned are included when `topics_locked = true` on the parent chapter.

Supplementary Problems assets are included (shown at end of deck).

---

## Card Format

```
[Transaction Description]

DR  [Account Name]     ???
CR  [Account Name]     ???
```

Accounts shown with their normal balance indicator: `(+Dr / -Cr)` or `(-Dr / +Cr)`

---

## Tooltip Content Format

### Debit/Credit Reason (YOU Format)
```
Why debit Cash here?
Debit Cash because you're receiving cash and 
need to increase it — assets increase with a debit.
```

### Amount Source (Plain English)
```
Where does this number come from?
This is the face value of the bond multiplied 
by the stated interest rate, prorated for the 
period covered.
```

No dollar figures in amount source explanations.

---

## Paywall

After card 3, non-paying visitors see a paywall card.

---

## Controls

- Shuffle button — randomizes card order
- Reveal amounts — shows actual dollar amounts from asset data
- Previous / Next navigation
- Progress indicator: "Card 4 of 23"

---

## Status Before Topics Locked

When `topics_locked = false`, shows all JEs from all chapter assets.
A note displays: "Showing all chapter JEs — lock topics to focus this tool"

For Chapter 17 (Revenue Recognition, IA2), this was 138 journal entries before topic locking.
After locking 5-6 topics, this drops to a manageable focused set.

---

## Topic Cram Mode (Future)

A per-topic Cram Tool variant may be built later that only shows JEs from a single topic — useful as a pre-video study tool. This is not yet implemented.
