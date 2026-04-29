## Spring 2026 Beta Reporting Dashboard — Plan

### 1. Route, page, components

- **Route**: `/beta-spring2026` (top-level, NOT under `/admin/...` — easier to share internally, still guarded).
- **Page file**: `src/pages/BetaSpring2026Dashboard.tsx`.
- **Wrapper**: `<SurviveSidebarLayout>` + `<AccessRestrictedGuard>` (same pattern as `LaunchAnalytics.tsx`). The guard already hard-locks to `lee@survivestudios.com` / `lee@surviveaccounting.com`. No other roles get in.
- **Register**: lazy-import in `src/App.tsx` and add `<Route path="/beta-spring2026" element={<BetaSpring2026Dashboard/>} />`. Also add `/beta-spring2026` to `RESTRICTED_PATHS` in `AccessRestrictedGuard.tsx` for belt-and-suspenders.
- **New components** (all under `src/components/beta-dashboard/`):
  - `MetricsGrid.tsx`
  - `FunnelStrip.tsx` (signup → first study tool open → repeat use)
  - `FeedbackInbox.tsx` (unified inbox)
  - `FeedbackRow.tsx` (single item w/ Copy Lovable Prompt + Categorize)
  - `AIClusterPanel.tsx` (themes from Claude)
  - `AICacheHealthCard.tsx`
  - `GhostUsersTable.tsx` (signed up, never engaged)
  - `DateRangePicker.tsx` (7d / 14d / 30d / Since Apr 1)

### 2. Existing tables we already have (no migration needed)

| Need | Table |
|---|---|
| Signups / onboarding / beta numbers / campus / course | `student_onboarding` (has `welcomed_at`, `completed_at`, `beta_number`, `is_legacy`) |
| Auth users + last login | `profiles` (`last_login_at`, `last_login_ip`, `last_user_agent`) |
| Magic-link auth attempts | `magic_link_nonces` (`created_at`, `consumed_at`) |
| Generic student events (page views, study tool opens, course/chapter selections, helper button clicks) | `student_events` (`event_type`, `event_data` jsonb, `course_slug`, `session_id`) |
| Solutions/practice viewer events | `asset_events` |
| Thumbs up/down on AI helper responses | `student_helper_feedback` (`rating`, `tool_type`, `action_type`, `comment`) |
| Written feedback on AI responses | `study_tool_response_feedback` (`rating`, `feedback_text`) |
| Idea suggestions / "would you use this?" votes | `study_tool_idea_feedback` (`vote`, `suggestion_text`, `idea_label`) |
| Explanation thumbs + reasons | `explanation_feedback` (`helpful`, `reason[]`, `note`) |
| Cram-tool engagement (Got It / Not Sure) | `cram_feedback` |
| Broken/problem reports from solutions viewer | `problem_issue_reports`, `asset_issue_reports` |
| Chapter-level questions / Suggest Fix | `chapter_questions` (`issue_type`, `responded`, `respond_by_at`) |
| Generic contact form | `contact_messages` |
| AI cache hit/miss + latency + tokens | `ai_request_log` (`cache_hit`, `latency_ms`, `total_tokens`, `model_used`) |
| AI generation cache freshness | `ai_generation_cache` |
| Beta share clicks (existing) | `student_events` filtered by `event_type='share_link_copied'` (already emitted from new dashboard CTA) |

### 3. New tables needed

**None for v1.** Everything maps cleanly to existing tables.

Optional v2 (only if Lee approves later): `beta_feedback_triage` to persist categorization, severity, "promoted to roadmap" flag, and Lovable prompt drafts. Not part of this plan.

### 4. Required Supabase migrations

None. We're read-only against existing tables.

### 5. RLS / security rules

- Page is gated client-side by `AccessRestrictedGuard` (Lee emails only).
- All queries run from the browser as Lee's authenticated session. We will add a small **edge function** `beta-dashboard-query` that:
  - Verifies `req.headers.authorization` JWT belongs to one of `LEE_EMAILS`.
  - Uses the **service role key** to read across feedback/event tables (some have stricter RLS).
  - Returns aggregated JSON only — never raw PII beyond email.
- A second edge function `beta-dashboard-summarize` calls Anthropic (`ANTHROPIC_API_KEY`, direct API per project rule) to cluster free-text feedback into themes and draft Lovable prompts.
- Both functions: `verify_jwt = true` in `supabase/config.toml` (default) plus the email check inside.

### 6. Dashboard sections (top → bottom)

```text
┌─ Header: Spring 2026 Beta · Day N of 14 · Date range picker ─┐
│                                                              │
│  [ Metrics Grid — 8 cards ]                                  │
│                                                              │
│  [ Funnel Strip ]  signup → onboarded → opened study tool    │
│                    → used 2+ tools → returned next day       │
│                                                              │
│  [ Activity Heatmap ]  student_events by hour × day          │
│                                                              │
│  [ Feedback Inbox ]   unified, filterable, AI-categorized    │
│                                                              │
│  [ AI Themes Panel ]  Claude-clustered topics + counts       │
│                                                              │
│  [ AI Cache Health ]  hit rate, p50/p95 latency, error rate  │
│                                                              │
│  [ Ghost Users Table ]  signed up, 0 engagement events       │
│                                                              │
│  [ Per-Course / Per-Chapter Drilldown ]                      │
└──────────────────────────────────────────────────────────────┘
```

### 7. Metrics cards (v1 set)

1. **Signups** — `count(*) from student_onboarding where is_legacy=false`, delta vs prior period.
2. **Logins (24h / 7d)** — distinct `user_id` from `profiles.last_login_at` + count of consumed `magic_link_nonces`.
3. **Active users (7d)** — distinct `email` in `student_events` last 7d.
4. **Study tool opens** — `student_events where event_type ilike 'study_tool_%open%'` count + top 3 tools.
5. **Helper button clicks** — `ai_request_log` count grouped by `tool_type`/`action_type`.
6. **Thumbs up / down ratio** — `student_helper_feedback` + `explanation_feedback` combined.
7. **Open feedback items** — `chapter_questions where responded=false` + `problem_issue_reports` last 14d.
8. **AI cache hit rate** — `ai_request_log` `cache_hit=true` / total, plus avg latency.

Each card: big number, sparkline (Recharts), delta arrow vs prior period.

### 8. Feedback Inbox design

Single unified feed, newest first. Source rows from:

- `chapter_questions` (filter `issue_type in ('issue','feedback','question','quiz_feedback')`)
- `study_tool_response_feedback` where `feedback_text is not null` or `rating='down'`
- `study_tool_idea_feedback` where `suggestion_text is not null` or `vote='no'`
- `explanation_feedback` where `note is not null` or `helpful=false`
- `problem_issue_reports`, `asset_issue_reports`
- `contact_messages`
- `cram_feedback` where `content_type='get_in_touch'`

Each row shows:
```text
[badge: source]  [badge: AI category]  [badge: severity]
"<excerpt of feedback>"
— student@school.edu · Course · Chapter · 2h ago · session_id
[Open full]  [Copy Lovable Prompt]  [Mark addressed]  [Slack]
```

Filters: source, course, chapter, severity, addressed/unaddressed, date range, free text search.

Storage of "addressed" flag: reuse `chapter_questions.fixed`/`responded` where the row already supports it; for tables without that column we record an `admin_notes` row keyed by source+id (table already exists). No schema changes.

### 9. "Copy Lovable Prompt" behavior

Button on every feedback row + a "Copy clustered prompt" on each AI theme.

Click handler builds a markdown prompt and copies to clipboard via `navigator.clipboard.writeText`, then `toast.success("Lovable prompt copied")`.

Template:
```text
Context: Spring 2026 beta feedback from Survive Accounting.

Source: {source_table}
Course: {course} · Chapter: {chapter} · Page: {page_url}
Student: {email_domain} ({campus})
Submitted: {created_at}

Student said:
"{verbatim_text}"

AI category: {category}
AI severity: {sev}
AI suggested action: {ai_action}

Please implement the smallest change that addresses this feedback.
Constraints: keep dark navy + brand red, do not break existing student dashboard layout, follow project memory rules.
```

For clustered prompts the body lists 3-10 representative quotes plus the AI synthesis.

### 10. AI summarization / categorization approach

- New edge function: `supabase/functions/beta-dashboard-summarize/index.ts`.
- Per project rule: **direct Anthropic API**, model `claude-sonnet-4-20250514`, `ANTHROPIC_API_KEY` secret, no Lovable AI gateway.
- Input: an array of `{id, source, text, course, chapter, created_at}` (cap 200 items per call, chunk if more).
- Output JSON: `{ items: [{id, category, severity, suggested_action, theme_id}], themes: [{id, label, summary, count, representative_ids}] }`.
- Categories (fixed enum the model must pick from): `bug`, `confusion`, `feature_request`, `content_gap`, `praise`, `pricing`, `auth_issue`, `performance`, `other`.
- Severities: `low`, `medium`, `high`.
- Cache the result keyed by sha256 of input ids in `ai_generation_cache` (`tool_type='beta_dashboard'`, `action_type='cluster'`) to avoid re-spending tokens on every page load. Refresh button on the dashboard forces re-run.
- Cost guard: function refuses to run if request size > 200 items and logs to `ai_request_log` like other tools.

### 11. Risks and assumptions

- Some early `student_events` rows may be missing `email` (anonymous sessions). Active-user count uses `coalesce(email, session_id)` and labels anonymous separately.
- `profiles.last_login_at` is only updated if the existing login flow writes it — needs a one-line check; if it doesn't, we fall back to `magic_link_nonces.consumed_at` for login activity. (Will verify during implementation.)
- AI categorization is advisory only. The "Mark addressed" state is the source of truth, not the AI label.
- No PII leaves Supabase except to Anthropic for the summarization call (verbatim feedback text + course/chapter; no full names, no IPs). Acceptable per existing direct-Anthropic policy.
- `/beta-spring2026` being a top-level route means it won't appear in the admin sidebar by default; we add a single sidebar link visible only when `useIsLee()` is true.

### 12. Implementation phases

**Phase 1 — Skeleton + guard (small)**
- Create page, register route, add to `RESTRICTED_PATHS`, sidebar link for Lee.
- Render placeholder sections so the URL is live and lockable.

**Phase 2 — Read-only metrics (medium)**
- Edge function `beta-dashboard-query` returning all 8 metric aggregates + sparkline series.
- Wire MetricsGrid, FunnelStrip, ActivityHeatmap, AICacheHealthCard, GhostUsersTable.

**Phase 3 — Feedback Inbox (medium)**
- Unified feed query, filters, search, pagination.
- `Copy Lovable Prompt` per row.
- "Mark addressed" using existing columns / `admin_notes`.

**Phase 4 — AI clustering (small)**
- Edge function `beta-dashboard-summarize` (Anthropic direct).
- AIClusterPanel with themes, counts, representative quotes, "Copy clustered prompt".

**Phase 5 — Polish**
- Date range picker, CSV export per section, Slack deep links on feedback rows, day-N-of-14 banner countdown to May 15 2026.

No new secrets required; all needed keys (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are already configured.