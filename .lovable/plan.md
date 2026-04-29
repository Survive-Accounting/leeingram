## Audit findings

### 1. Study Console (`StudyPreviewer.tsx` + `LandingStudyPreviewerSection.tsx`)

- **Course switcher** (`LandingStudyPreviewerSection`) refetches `chapters` every time `selectedCourseId` changes via raw `useEffect` + `supabase.from('chapters')`. No TanStack cache, no prefetch of the other 3 courses. Switching from IA2 → Intro1 always triggers a fresh round-trip even though chapter lists are tiny and rarely change.
- **Chapter switcher** (`StudyPreviewer.handleChapterChange`) issues **2 sequential-style queries** to `teaching_assets` to find the first asset and first JE asset, then **awaits a hard `setTimeout(400)`** before showing the new state. Net perceived latency: ~600–900 ms even when DB is fast. The localStorage hydrate effect (lines 133–167) re-runs the same two queries again on mount.
- **No caching layer**: every chapter visit re-queries the same first-asset row. Same data is then re-queried inside the iframe by `SolutionsViewerV2`.
- **Iframe loading** is gated by a `BrandedLoader` shown until the iframe `onLoad` fires, plus a `setTimeout(2000)` "showSlowStatus" — but the loader covers the iframe area for 1.5–3 s on every open even when data is warm.
- The course list (`COURSES`) is hard-coded — fine, but chapter metadata could be the same: a single static-ish payload fetched once.

### 2. Practice Problem Helper (`SolutionsViewerV2.tsx`)

- On asset load (line 2727) it fetches the asset, then a parallel pair `(chapter, siblings)`. Reasonable, but **not prefetched** from the Study Console. The Console already knows the first asset code and could warm the asset row before the iframe mounts.
- Helper buttons (`handleToolboxClick`, line 1593) and `prefetchToolbox` (1628) call `supabase.functions.invoke('survive-this', …)` directly. There's hover prefetch + idle prefetch for `walk_through`, but **no client-side dedupe** of in-flight calls — hammering the same button fires multiple invokes; the server `ai_generation_cache` dedupes the model call, but the Edge Function cold-start + cache-poll path still runs N times.
- **`survive_ai_responses` legacy cache lookup** runs on every survive-this call before falling back to `ai_generation_cache`. This is the actual reason returning helpers are fast — but cache hits still pay one Edge Function cold-start round-trip (~200–600 ms).
- Toolbox UI shows **walk_through, hint, setup, full_solution all at the same visual weight** in a 4-button grid. The user wants Walk + Full as primary, the rest as "experimental".
- 16 viewer route bundle is heavy (3,748 lines). It's eagerly loaded via the iframe `<link rel="prefetch">` (line 651) — good — but the route component itself isn't `React.lazy`'d.

### 3. AI generation pipeline (already centralized)

- ✅ `_shared/aiConfig.ts` + `_shared/generateTutorResponse.ts` exist and route through `ai_generation_cache` (pending/completed/failed) with cache_key = sha256(course|chapter|problem|tool|action|prompt_v|model|problem_v|solution_v).
- ✅ Default model `gpt-5.5` with auto-fallback to `gpt-5`.
- ✅ Server-side dedupe via unique cache_key + 25 s pending poll.
- ⚠️ `problem_version` and `solution_version` are **never passed** by `survive-this` (or by `SolutionsViewerV2`). That means cache rows are not invalidated when an asset's problem text changes. We should pass `teaching_assets.updated_at` as the version.
- ⚠️ Legacy `survive_ai_responses` lookup happens **before** `ai_generation_cache`, defeating per-version invalidation in some cases.

### 4. Loading screens

- `BrandedLoader` is now a clean phosphor SVG spinner — short, no headshot. Fine to keep but it currently always shows for the full iframe boot, masking content even when the underlying viewer has paint-ready data.

### 5. Feedback

- `explanation_feedback` table exists (helpful counts via `increment_survive_helpful` RPC) but no per-response 👍/👎 + free-text on each generated helper response. No dedicated student-beta-feedback table.

---

## Recommended plan

### Phase 1 — Make switching feel instant (low risk)

**Goal:** course/chapter changes feel <100 ms perceived.

1. **Add TanStack Query** wrappers for the previewer's data:
   - `useChapters(courseId)` — `staleTime: Infinity, gcTime: 1h`. One query per course, cached for the session.
   - `useFirstAsset(chapterId)` — combines the "first asset" + "first JE asset" lookups into a single SQL via a new RPC `get_chapter_entry_assets(chapter_id)` returning `{ first_asset_name, first_je_asset_name }`. `staleTime: Infinity`.
   - `useAssetSummary(assetCode)` — minimal asset row used by `SolutionsViewerV2`, prefetched from the Console before the iframe mounts.

2. **Drop the artificial `setTimeout(400)`** in `handleChapterChange`. The CRT pulse animation (~180 ms) already provides the visual "switch" feedback.

3. **Prefetch siblings** when entering a chapter:
   - On `handleChapterChange`, call `queryClient.prefetchQuery` for the next chapter in the dropdown order.
   - On course change, prefetch the chapter list for the *previously selected* and *next* course (so toggling between IA2 and Intro 1 has zero delay).

4. **Files touched:**
   - `src/components/landing/LandingStudyPreviewerSection.tsx`
   - `src/components/study-previewer/StudyPreviewer.tsx`
   - new `src/hooks/useStudyConsoleData.ts`
   - new migration adding `get_chapter_entry_assets` SQL function (returns 2 fields, security definer, public execute).

5. **Skip the BrandedLoader entirely when the asset row is already warm** — pass a `prewarmed` prop down from Console; if true, render the iframe with `opacity:0.001` until `onLoad`, then fade in 120 ms (no full-screen loader). Loader still shows for cold boots.

### Phase 2 — Helper UI simplification + duplicate-click protection

1. **Reorder toolbox** in `InlineExplanation`:
   - **Primary row:** Walk me through it (red), Full solution (red ghost). Side by side or stacked.
   - **Secondary "Try experimental helpers" disclosure:** collapsed by default. Inside: Hint, Show setup, Memorize, The Why, Real World, Professor Tricks, Similar problem, Challenge.
   - Add a small label: "We're testing new AI tools — your votes shape what stays."

2. **Client-side dedupe**:
   - Track in-flight `actionType`s in component state (`Set<string>`). If a button is clicked again while pending, no-op + toast "Still loading…".
   - Disable all toolbox buttons while any one is loading via a single `globalLoading` flag in the existing component. (No Zustand needed — local state is enough; the server cache already handles cross-tab dedupe.)

3. **Pass `problemVersion`** in `buildContext()` (= `asset.updated_at`) so cache busts correctly when problem text changes. Add `updated_at` to the asset SELECT in `SolutionsViewerV2` (line 2738).

4. **Files touched:** `src/pages/v2/SolutionsViewerV2.tsx` only.

### Phase 3 — Beta feedback capture

1. **New migration** — table `student_helper_feedback`:
   ```
   id uuid pk default gen_random_uuid()
   cache_key text             -- joins to ai_generation_cache
   asset_id uuid              -- denormalized for quick filtering
   chapter_id uuid
   action_type text           -- walk_through, hint, …
   rating smallint not null   -- 1 = up, -1 = down
   comment text               -- optional short feedback
   user_id uuid
   session_id text
   email text                 -- captured from EmailGate when available
   created_at timestamptz default now()
   ```
   - RLS: anyone (anon + authenticated) may INSERT; SELECT restricted to admins via existing `is_admin()` pattern (or service role only).
   - Indexes: `(action_type, created_at desc)`, `(asset_id)`, `(chapter_id)`.

2. **UI:** Below every rendered helper response, show two icon buttons (👍 👎) and a collapsible "Tell us why?" textarea (200-char limit). Submitting writes one row to `student_helper_feedback`. After submit, replace controls with a small "Thanks — noted." chip.

3. **Files touched:**
   - `src/pages/v2/SolutionsViewerV2.tsx` — render feedback bar inside the helper response area (single small subcomponent).
   - new migration `…_student_helper_feedback.sql`.

4. **Admin retrieval:** out of scope for this sprint — table is ready and Lee can read via existing Cloud SQL view. (A real `/admin/helper-feedback` page can be a follow-up.)

### Phase 4 (optional polish) — Loader trims

- Cap `BrandedLoader` visible time to 250 ms minimum/600 ms maximum: if the iframe `onLoad` fires before 250 ms, still hold for 250 ms to avoid flash; if not loaded by 600 ms, swap to a tiny phosphor pulse in the corner instead of full-screen.
- Drop the `await new Promise(r => setTimeout(r, 400))` already in scope from Phase 1.

---

## Performance bottlenecks (ranked)

1. **`setTimeout(400)` in `handleChapterChange`** — 100 % of chapter switches eat 400 ms unnecessarily. *Phase 1.*
2. **Two sequential first-asset queries per chapter** — collapse into 1 RPC. *Phase 1.*
3. **No TanStack caching of chapters/courses** — every switch re-queries. *Phase 1.*
4. **Iframe boot loader covers warm reloads** — gate by warm flag. *Phase 1.*
5. **Helper button hammer** — fires multiple Edge Function invocations even though server dedupes. *Phase 2.*
6. **`problem_version` never sent** — stale-cache risk after asset edits. *Phase 2.*

---

## Acceptance criteria

- Switching course on the landing page Study Console shows the new chapter list in <100 ms when previously visited (TanStack cache hit).
- Switching chapter does not block on a hard `setTimeout`. New chapter pill + tool selector appears in <150 ms; first-asset code resolves from a single RPC.
- Opening the Practice Problem Helper for a previously-visited asset does not show the BrandedLoader; the viewer fades in within ~200 ms.
- Clicking a helper button that already has a cached response in `ai_generation_cache` returns within ~250 ms (network round-trip only) and never re-calls OpenAI.
- Mashing a helper button only fires one Edge Function invocation; subsequent clicks while pending are ignored with a toast.
- Walk me through it + Full solution are the only two visible primary buttons. The other 6+ helpers live behind a single "Try experimental helpers" disclosure.
- Each rendered helper response has 👍 / 👎 controls and an optional short comment. Submissions land in `student_helper_feedback` with `cache_key`, `asset_id`, `action_type`.
- `gpt-5.5` is still the default model; no hard-coded model strings outside `_shared/aiConfig.ts`.
- No student-facing route changes; retro terminal styling preserved.

---

## Risks & assumptions

- **Assumption:** `teaching_assets.updated_at` exists on the schema (used as `problem_version`). If not, add an `updated_at` column with a trigger before passing it.
- **Risk:** Existing `survive_ai_responses` legacy rows will continue to be served (warm cache) and won't carry a `cache_key` — that's fine; the new feedback table allows `cache_key` to be null when the source is the legacy table.
- **Risk:** Hover-prefetch on every helper button could spike OpenAI usage if someone mouse-skims. Mitigation: prefetch only fires for the two primary buttons (already true for `walk_through`); secondary tools prefetch on `focus` / `mouseenter` only after disclosure is opened.
- **Risk:** `gpt-5.5` is still not a real OpenAI model slug — the existing fallback to `gpt-5` covers this; no change.
- **Out of scope:** building the admin viewer for `student_helper_feedback`, redesigning the chapter picker visuals, changing the JE Helper.

---

## Files & migrations summary

**New:**
- `src/hooks/useStudyConsoleData.ts` (TanStack hooks)
- migration: `…_get_chapter_entry_assets.sql` (RPC)
- migration: `…_student_helper_feedback.sql` (table + RLS + indexes)

**Edited:**
- `src/components/landing/LandingStudyPreviewerSection.tsx` (use TanStack, prefetch siblings)
- `src/components/study-previewer/StudyPreviewer.tsx` (drop setTimeout, RPC, warm-flag prop)
- `src/components/study-previewer/BrandedLoader.tsx` (min/max display window)
- `src/pages/v2/SolutionsViewerV2.tsx` (toolbox reorder, dedupe, problemVersion, feedback bar, asset SELECT adds `updated_at`)
- `supabase/functions/survive-this/index.ts` (forward `problem_version` from context to `generateTutorResponse`)

**Untouched:** `_shared/aiConfig.ts`, `_shared/generateTutorResponse.ts`, JEHelperPanel, RetroTerminalFrame, all other routes.
