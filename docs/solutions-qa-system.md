# Solutions QA Review System

## Overview

The Solutions QA system allows Virtual Assistants to review the visual accuracy of Solutions Viewer pages against the original textbook.

Route: `/solutions-qa`

Standalone route — no sidebar.

---

## Review Flow

The VA opens `/solutions-qa` and is guided through a two-step review per asset:

### Step 1: Screenshot Comparison
- Student-facing solutions page loads in an iFrame
- VA compares it side-by-side with a textbook screenshot
- Rating: `Yes` / `Almost` / `No`
- If `No` or `Almost` → system auto-creates an issue record

### Step 2: Section Checklist
- Only shows sections with content for that asset
- Keyboard shortcuts 1–7 for fast navigation
- VA checks off each section as correct

### One-Click Clean Review
- "✓ All Good — Next Asset" button (Enter/Space shortcut)
- Advances to next asset immediately when everything looks correct

---

## Multiple Issues Per Asset

Multiple issues can be logged per asset. Each issue has:
- `fix_scope`: `'asset_specific'` | `'bulk_pattern'`
- Description of the problem
- Section it affects

---

## Reviewer Identity

Reviewer name stored in `localStorage` — entered once, persists.

---

## Database Tables

### `solutions_qa_assets`
Tracks review status per asset.

### `solutions_qa_issues`
Logs specific issues found during review.

| Column | Values | Description |
|---|---|---|
| `fix_scope` | `asset_specific` \| `bulk_pattern` | Whether fix applies to one asset or a system-wide pattern |

---

## QA Admin Panel

Admin view at `/solutions-qa` (admin tab):

- **Issues Tab**: Lists all open issues, filterable by fix_scope
- **Generate Prompt Tab**: Splits issues into:
  - System-wide bulk pattern fixes (for edge function updates)
  - Asset-specific fixes (for targeted corrections)
- **"⚡ Bulk Fixes Ready" amber card**: Appears when bulk pattern fixes are queued

---

## Relationship to Bulk Fix Queue

Issues with `fix_scope = 'bulk_pattern'` feed into the Bulk Fix Queue at `/bulk-fix`.

The QA Admin "Generate Prompt" tab produces the prompt text needed to implement the fix in Lovable or the relevant edge function.
