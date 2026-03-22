# Bulk Fix Queue

## Overview

The Bulk Fix Queue allows Lee to queue and run large-scale operations against all teaching assets in a chapter or across the platform. Operations run sequentially overnight with per-operation email summaries.

Route: `/bulk-fix`

---

## Available Operations (in recommended order)

1. **Enrich JE Rows** — Adds missing account metadata to journal entry rows
2. **Rewrite JE Reasons (YOU Format)** — Rewrites `debit_credit_reason` fields in second-person YOU voice
3. **Rewrite Amount Sources (Plain English)** — Rewrites `amount_source` fields with method-only explanations (no dollar figures)
4. **Generate Dissector Highlights** — Generates Problem Dissector highlight annotations for each asset

---

## JE Tooltip Format Standards

### Debit/Credit Reason — YOU Format
```
Debit Cash because you're receiving cash and need to 
increase it — assets increase with a debit.
```
- Second person ("you")
- States what's happening in the transaction
- States the normal balance rule
- One sentence, plain English

### Amount Source — Plain English
```
This is the face value of the bond multiplied by 
the stated interest rate, prorated for the period.
```
- No dollar figures
- Method/formula only
- One to two sentences

---

## Edge Function: `rewrite-je-tooltips`

Supports two modes:
- `mode: 'rewrite_reasons'` — rewrites `debit_credit_reason` fields
- `mode: 'rewrite_amounts'` — rewrites `amount_source` fields

Both show amber warning banners in the UI before running (destructive operation — overwrites existing content).

---

## Queue Persistence

The queue is stored in a `bulk_fix_queue` database table so overnight operations survive page refreshes.

Operations run sequentially — each one auto-advances to the next on completion.

Errors are skipped (logged) and the queue continues.

---

## Email Notifications (Resend)

Each operation sends a completion email via Resend:

- **From**: `lee@mail.surviveaccounting.com`
- **Reply-To**: `lee@surviveaccounting.com`
- **To**: `lee@surviveaccounting.com`
- Edge function: `send-bulk-fix-summary`

A final queue-complete summary email is sent when all operations finish.

---

## Dissector Highlights — Auto-Trigger

The `generate-dissector-highlights` edge function:
- Includes a skip-if-exists check (won't overwrite existing highlights)
- Is auto-triggered (fire-and-forget) when an asset is approved in Phase 1

The Bulk Fix Queue version runs it across all assets in a chapter at once.
