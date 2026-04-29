## Two flags before we build

**1. Model slug "gpt-5.5" doesn't exist (yet).** OpenAI's current public lineup is `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, and `gpt-5.2`. There is no `gpt-5.5` or `gpt-5.4`. If we ship `model: "gpt-5.5"` to `api.openai.com`, every call returns a 404. **Recommendation:** put `gpt-5.5` in the config exactly as you asked, but I'll wire the helper to log + fall back to `gpt-5` automatically if OpenAI rejects the slug, so the app keeps working. When the real `gpt-5.5` lands, no code change needed — it just starts working. Tell me if you want me to use `gpt-5` outright instead.

**2. This reverses the project rule "never use OpenAI/Lovable gateway, always Anthropic direct."** Your custom instructions and the saved Anthropic-API-only memory both lock the tutor to Claude. Switching every tutor surface to OpenAI is a deliberate strategic change. I'll proceed and update the memory rule to reflect the new standard ("OpenAI GPT-5.x via centralized config; Anthropic deprecated for tutor surfaces").

---

## Scope

Two combined asks:
- **A.** Centralize the model + reasoning config and route all tutor AI through one helper.
- **B.** Add a real database cache (`ai_generation_cache`) with cache-key, pending/completed states, deduping, and admin tooling.

Tutor surfaces in scope (all student-facing): `survive-this` (Walk me through it, Hint, Setup, Full solution, JE Helper, Memorize, Real World, The Why, Professor Tricks, Financial Statements, Similar Problem, Challenge), `explain-solution-part`, `explain-this-solution`. Backend/admin generators (`generate-chapter-*`, `bulk-fix`, OCR, etc.) stay on whatever they use today — out of scope.

---

## Plan

### 1. Central config (server-side)
New file: `supabase/functions/_shared/aiConfig.ts`

```ts
export const DEFAULT_AI_MODEL = "gpt-5.5";
export const FALLBACK_AI_MODEL = "gpt-5";          // auto-used on 404
// Future cost-cut options (not active):
// export const CHEAP_MODEL = "gpt-5.4-mini";

export const REASONING_BY_ACTION: Record<string, "low"|"medium"|"high"> = {
  hint: "low",
  setup: "low",
  full_solution: "medium",
  walk_through: "medium",
  journal_entries: "medium",
  explain_part: "medium",
  // everything else → DEFAULT_REASONING_EFFORT
};
export const DEFAULT_REASONING_EFFORT = "low";
export const DEFAULT_VERBOSITY = "medium";

export const PROMPT_VERSION = "v1";  // bump to invalidate cache
export const MODEL_VERSION  = DEFAULT_AI_MODEL;
```

### 2. Shared tutor helper
New file: `supabase/functions/_shared/generateTutorResponse.ts`

Single function `generateTutorResponse({ toolType, actionType, courseId, chapterId, problemId, problemVersion, solutionVersion, userId, sessionId, systemPrompt, userPrompt, maxTokens })` that:
- Computes `cache_key = sha256(courseId|chapterId|problemId|toolType|actionType|PROMPT_VERSION|MODEL_VERSION|problemVersion|solutionVersion)`
- Looks up `ai_generation_cache` by cache_key
  - `completed` → return cached row (cache hit logged)
  - `pending` → poll up to ~25s (250ms intervals) for completion; return result or pending state
  - missing → atomic upsert with `status='pending'` (unique index on cache_key serializes concurrent callers)
- Calls OpenAI Chat Completions with model from config + reasoning_effort from action map
- On 404 (bad model slug): retry once with `FALLBACK_AI_MODEL`, log the swap
- On 429/402: return friendly error, mark cache row `failed` with error_message, do **not** leave it pending
- Updates row: `status='completed'`, `response_text`, token counts, latency_ms
- Inserts log row in `ai_request_log` (see step 3)

API key (`OPENAI_API_KEY`) read from `Deno.env` — never exposed to client. Already configured in secrets.

### 3. Database changes (migration)

```sql
create table public.ai_generation_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  course_id uuid, chapter_id uuid, problem_id uuid,
  tool_type text not null, action_type text not null,
  prompt_version text not null, model_version text not null,
  problem_version text, solution_version text,
  response_text text, response_json jsonb,
  status text not null check (status in ('pending','completed','failed')),
  error_message text,
  prompt_tokens int, completion_tokens int, total_tokens int,
  latency_ms int,
  generated_by_user_id uuid, session_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on ai_generation_cache (problem_id, action_type);
create index on ai_generation_cache (status, created_at);

create table public.ai_request_log (
  id uuid primary key default gen_random_uuid(),
  cache_key text, cache_hit bool not null,
  tool_type text, action_type text,
  model_used text, reasoning_effort text,
  prompt_tokens int, completion_tokens int, total_tokens int,
  latency_ms int,
  user_id uuid, session_id text,
  problem_id uuid, chapter_id uuid,
  error_message text,
  created_at timestamptz default now()
);
```

RLS: both tables are server-write-only. Public **read** on `ai_generation_cache` for `status='completed'` (so realtime poll from client also works if needed). `ai_request_log`: admin-only read.

A janitor query (run inside the helper itself) marks any `pending` row older than 60s as `failed` so a crashed function never blocks a key forever.

### 4. Refactor edge functions

- **`survive-this/index.ts`**: keep all the prompt-building logic; replace the Anthropic block with a call to `generateTutorResponse(...)`. Pass `toolType="survive_this"`, `actionType=prompt_type`. Drop the old `survive_ai_responses` write (we'll backfill-read it once for cache warming, then deprecate).
- **`explain-solution-part/index.ts`**: replace OpenAI o3 call with helper. `actionType="explain_part"`. Keep the `survive_solution_explanation_cache` JSON merge for now (legacy compatibility) but source the text from the new cache.
- **`explain-this-solution/index.ts`**: same treatment, `actionType="explain_solution"`.

No frontend file changes required for the model swap itself — they already call these functions. Frontend changes are only for button-hammer prevention (step 5).

### 5. Frontend hammer-protection
Touch the three caller files (`SolutionsViewerV2.tsx`, `SurviveThisPanel.tsx`, `StructuredSolutionDisplay.tsx`):
- Disable the clicked button during in-flight request (most already do; verify all toolbox buttons).
- One-active-generation-per-session guard via a small Zustand/Context store: if any tutor request is in flight, other tutor buttons show "One response is already loading." toast and no-op. Hover-prefetch already added in last sprint stays — it's a fire-and-forget that the cache absorbs.

### 6. Admin controls
New admin page `/admin/ai-cache` (Lee-only via existing AccessRestrictedGuard):
- Filter by chapter / problem / action_type / status
- Show model, tokens, latency, response preview
- Buttons: **Regenerate** (deletes row, next click rebuilds), **Mark bad** (sets a `flagged` bool — minor schema add), **Invalidate by chapter / tool / prompt version** (bulk delete)

Not blocking launch — can ship in same PR but behind a "coming soon" tab if time-tight. Recommend shipping minimal version with regenerate + invalidate-by-problem.

### 7. Memory update
Update `mem://constraints/direct-anthropic-api-access` and Core rule: tutor surfaces now use **OpenAI GPT-5.5 via centralized config** through `_shared/aiConfig.ts` + `generateTutorResponse`. Anthropic remains allowed for non-tutor admin/content generators if those teams haven't migrated.

---

## Files touched
- **New:** `supabase/functions/_shared/aiConfig.ts`, `supabase/functions/_shared/generateTutorResponse.ts`, migration for `ai_generation_cache` + `ai_request_log`, `src/pages/admin/AICachePage.tsx`, small Zustand store `src/stores/aiGenerationLock.ts`
- **Edited:** `supabase/functions/survive-this/index.ts`, `supabase/functions/explain-solution-part/index.ts`, `supabase/functions/explain-this-solution/index.ts`, `src/pages/v2/SolutionsViewerV2.tsx`, `src/components/SurviveThisPanel.tsx`, `src/components/StructuredSolutionDisplay.tsx`, admin sidebar entry, memory files
- **Deprecated (read-only):** existing `survive_ai_responses` table — keep around for one release as fallback warm-cache, then drop in a future migration

---

## Open questions
1. Should I really ship `model: "gpt-5.5"` (with auto-fallback to `gpt-5`), or use `gpt-5` directly until OpenAI announces 5.5?
2. Confirm OK to switch tutor surfaces from Anthropic → OpenAI and update the memory rule accordingly?
3. Admin `/admin/ai-cache` page in this PR, or follow-up?