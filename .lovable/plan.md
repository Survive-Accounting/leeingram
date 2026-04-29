## Problem-by-problem diagnosis & fix plan

Six bugs reported across 10 screenshots. All are in the modern Solutions Viewer (`src/pages/v2/SolutionsViewerV2.tsx`) plus one edge function and one missing database RPC. Grouped by root cause.

---

### Issue 1 — White-on-white table headers in tutor responses (Screenshots 1, 2, 5)

**Cause.** The tutor response area at `SolutionsViewerV2.tsx:1758` forces `[&_th]:!text-white [&_td]:!text-white` on its container. The inline AI HTML stylesheet at line 1297 sets `th { background:#FAFAFA; color:#6B7280 }` (light bg, gray text). The `!text-white` override wins for color but background stays light → white text on light gray = invisible. The `td` cells inherit white text on the dark panel (fine) but the `th` row is unreadable.

**Fix.** Remove the blanket `[&_th]:!text-white [&_td]:!text-white/90` overrides on the response window container (line 1758), and rebuild the inline AI HTML stylesheet (lines 1296–1305) so it is dark-panel-native:
- `th` → background `rgba(255,255,255,0.08)`, color `rgba(255,255,255,0.95)`, font-weight 600
- `td` → color `rgba(255,255,255,0.92)`, border `rgba(255,255,255,0.08)`
- `tr.total td` → background `rgba(255,255,255,0.06)`, white text, top border `rgba(255,255,255,0.18)`
- `strong` → `#FFFFFF`, `em` → `rgba(255,255,255,0.7)`

This guarantees readability on the navy/black tutor panel without needing the `!important` overrides.

---

### Issue 2 — White-on-white table headers in problem text (Screenshots 3, 4, 9)

**Cause.** `SolutionsViewerV2.tsx:3237` wraps `<SmartTextRenderer>` with `[&_th]:!text-white [&_td]:!text-white/90`. `SmartTextRenderer` renders pipe-tables with header row `background:#1A2E55` (navy) and body rows `background:#FFFFFF / #F8F9FA` (white). Forcing `td` text to white makes body cells invisible; the header row stays readable only because its background is dark.

**Fix.** Drop the `[&_th]:!text-white [&_td]:!text-white/90` selectors from the wrapper at line 3237 — let `SmartTextRenderer`'s own table palette (navy header / white body / dark text) win. Keep `[&_*]:!text-white/95 [&_strong]:!text-white` for plain prose, but scope it so it does not bleed into tables:
- Replace with: `[&_p]:!text-white/95 [&_li]:!text-white/95 [&_strong]:!text-white [&_.font-semibold]:!text-amber-300`

Same scoping fix applied to the problem-text wrapper used elsewhere in the viewer (only one instance found; verify and update both if the pattern recurs).

---

### Issue 3 — Thumbs up/down throws "Couldn't save that — try again?" (Screenshot 7)

**Cause.** Two `cast()` functions (lines 790 and 980) insert into `public.explanation_feedback`, then call `.select("id").single()`. The table has RLS enabled with only:
- INSERT policy "Anyone can submit explanation feedback" (`WITH CHECK true`)
- SELECT policy only for service role

Anonymous users can insert but the chained `.select()` returns 0 rows under RLS → `.single()` throws → toast fires.

**Fix (database migration).** Add an anon-friendly SELECT policy scoped to the row just inserted in this session. Two safe options:
1. Add a policy: `CREATE POLICY "Insert returns own row" ON public.explanation_feedback FOR SELECT USING (true);` — feedback is anonymous and low-risk; keeping it readable is acceptable, OR
2. Switch the client to a fire-and-forget pattern (drop `.select().single()`) and skip storing `feedbackId`. This breaks the optional follow-up "reason" update flow.

Recommendation: option 1 (add SELECT policy `USING (true)`) — keeps the reason-follow-up working. Ignore() is acceptable because the table only stores opt-in feedback signals.

Also add an UPDATE policy for the same path so `sendReason()` (lines 819, 1031) can attach a reason to the row it just created:
`CREATE POLICY "Anyone can attach a reason" ON public.explanation_feedback FOR UPDATE USING (true) WITH CHECK (true);`

---

### Issue 4 — Feature-idea vote counts disappear on reload (Screenshot 8)

**Cause.** `FeatureIdeasVoting.tsx:166` and `SolutionsViewerV2.tsx:1584` both call `supabase.rpc("increment_survive_helpful", ...)`. That RPC **does not exist** in the database (`SELECT proname FROM pg_proc WHERE proname='increment_survive_helpful'` returns 0 rows). The optimistic local state shows the bumped count for that session; on reload, `useEffect` reads `survive_ai_responses.helpful_count` which was never incremented → 0.

**Fix (database migration).** Create the missing RPC. It must upsert a row in `survive_ai_responses` for the (asset_id, prompt_type) pair and increment `helpful_count` atomically:

```sql
CREATE OR REPLACE FUNCTION public.increment_survive_helpful(
  p_asset_id uuid, p_prompt_type text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.survive_ai_responses (asset_id, prompt_type, helpful_count)
  VALUES (p_asset_id, p_prompt_type, 1)
  ON CONFLICT (asset_id, prompt_type)
  DO UPDATE SET helpful_count = COALESCE(survive_ai_responses.helpful_count, 0) + 1;
END $$;
GRANT EXECUTE ON FUNCTION public.increment_survive_helpful(uuid, text) TO anon, authenticated;
```

(Verify a unique index on `(asset_id, prompt_type)` exists; add one if missing — the survive-this edge function also relies on it.)

---

### Issue 5 — "Walk me through it" 30-60 s on first click (Screenshot 10)

**Cause.** `supabase/functions/survive-this/index.ts` calls **OpenAI o3** (`max_completion_tokens: 4500` for walk_through). o3 is a reasoning model with very high latency — multi-step + table generation regularly takes 30-60 s on a cold call. Subsequent clicks are fast because the result is cached in `survive_ai_responses`. The viewer's idle-time prefetch (lines 1543–1578) only fires for `walk_through` and only after `requestIdleCallback`, so the first user typically still pays the latency.

**Two-part fix:**

**A. Switch the model to Claude Sonnet 4 via direct Anthropic call** (matches the project's locked AI rule from `mem://core` — never use Lovable AI gateway, always direct `api.anthropic.com`). Edits in `survive-this/index.ts`:
- Replace OpenAI fetch with POST to `https://api.anthropic.com/v1/messages` using `ANTHROPIC_API_KEY`, model `claude-sonnet-4-20250514`, `max_tokens: 4500` for walk_through and 2000 otherwise, system + user message format, response read from `data.content[0].text`.
- Drop `OPENAI_API_KEY` requirement.

Sonnet 4 returns a multi-step walkthrough in ~5–10 s vs 30–60 s for o3.

**B. Strengthen the prefetch.** In `SolutionsViewerV2.tsx`:
- Move the idle prefetch to fire immediately when the asset loads (not gated by `requestIdleCallback` 2.5 s delay) but still backgrounded with `setTimeout(prefetch, 300)`.
- Additionally trigger prefetch for `setup` and `hint` on **hover** of those buttons (mouseenter handler), so a user who hovers before clicking gets an instant response.

Both changes together turn the first-click experience from 30-60 s into typically <2 s (cache hit) or <10 s worst case.

---

### Technical change list

**Files to edit:**
- `src/pages/v2/SolutionsViewerV2.tsx`
  - Line 1297-1305: rewrite inline AI HTML CSS for dark panel
  - Line 1758: remove `[&_th]:!text-white [&_td]:!text-white/90`
  - Line 3237: replace `[&_*]` blanket override with scoped per-element overrides that exclude tables
  - Lines 1543-1578 + button mouseenter handlers: stronger prefetch (immediate + hover-triggered for setup/hint)
- `supabase/functions/survive-this/index.ts`: swap OpenAI o3 call for direct Anthropic Sonnet 4 call

**Database migration (single migration file):**
1. Add SELECT policy `USING (true)` on `public.explanation_feedback`
2. Add UPDATE policy `USING (true) WITH CHECK (true)` on `public.explanation_feedback`
3. Ensure `survive_ai_responses` has unique index on `(asset_id, prompt_type)`
4. Create `public.increment_survive_helpful(uuid, text)` SECURITY DEFINER function and grant EXECUTE to anon + authenticated

**No new secrets required** — `ANTHROPIC_API_KEY` is already configured.

---

### Out of scope / not changed

- The "Stacked view" tooltip in screenshot 6 was inspected; the popover renders dark navy with white icons and is readable. No change needed unless the user wants the toolbar restyled.
- The voting UI itself (FeatureIdeasVoting) needs no client changes once the RPC exists.
