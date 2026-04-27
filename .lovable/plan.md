## Goal

Make the "Quick favor?" feedback popover (in `SolutionsViewerV2`) available to **any user** previewing the tool — including users in the landing-page embed iframe — and strip out the 5-star rating UI so it's just the textarea + Send.

## Current behavior

In `src/pages/v2/SolutionsViewerV2.tsx` the `MagicWandFeedback` component:

- Only opens after a usage threshold: `views >= 5 || clicks >= 2 || minutes >= 8`.
- Suppresses itself once `sa_wand_shown` or `sa_wand_dismissed` is in `localStorage` (so first-time landing-page viewers in the iframe almost never see it, and dismissed users never see it again).
- Shows a 5-star rating row above the textarea.
- `send()` blocks submit unless `wish.trim()` OR `rating > 0`, and stores `helpful: rating >= 4` plus `rating_N` in the `reason` array.

## Changes (single file: `src/pages/v2/SolutionsViewerV2.tsx`)

1. **Always-available trigger for previewers**
   - Replace the threshold-gated `useEffect` with logic that opens the widget on mount for anyone in preview / embed mode, regardless of `sa_wand_shown` / `sa_wand_dismissed`.
   - Detection: read `searchParams.get("embed") === "1"` (already used elsewhere in the file as `isEmbed`) — these are landing-page iframe viewers.
   - For non-embed visits, keep a lightweight first-load open (since the user said "any user who is previewing it"): show the popover once on mount if not previously dismissed, instead of waiting for the views/clicks/minutes thresholds. Dismiss still hides it for the session, but we'll allow it to reopen on a fresh session/load.
   - Keep the dismiss button so users can close it; just don't permanently suppress on subsequent loads.

2. **Remove star rating**
   - Delete the `rating` and `hoverRating` state plus the `<div role="radiogroup">` star block (lines ~845–864).
   - Update `send()`: only require `wish.trim()` to submit; remove `rating`-based `helpful` logic (set `helpful: null` or omit), and drop `rating_${rating}` from `reason` (just `["wand_prompt"]`).
   - Update the empty-state toast to: "Add a quick note first 🙂".

3. **Keep everything else intact**
   - Textarea, placeholder copy, Skip/Send buttons, Wand2 icon header, "Quick favor?" title, position (`bottom-20 right-4`), and Supabase insert into `explanation_feedback` with `asset_name: "__magic_wand__"` all stay the same.
   - The `bumpWandCounter` calls elsewhere in the file can stay — they just become unused signals for this widget but cause no harm.

## Out of scope

- No DB / migration changes (still reusing `explanation_feedback`).
- No changes to the landing-page embed wrapper or admin preview logic.
- No copy changes other than the empty-submit toast.