# Beta Dashboard — Standalone page + Student Signups list

Two changes to `/beta-spring2026`:

1. Make it a **standalone page** (no sidebar, no domain shell, no other dashboard chrome).
2. Add a **Student Signups** section at the bottom — a sortable list of every signup with email, campus, course, and engagement stats.

## 1. Standalone page

Today the page is wrapped in `<SurviveSidebarLayout>` (the "Survive Accounting Admin" shell with the left nav, course/chapter pickers, and clocks). Strip that wrapper.

Replace the layout with a minimal full-bleed shell rendered directly inside the route element:

```text
<AccessRestrictedGuard>
  <div min-h-screen bg-muted/20>
    <header>  ← thin top strip: "Spring 2026 Beta Dashboard · Internal" + "← Exit" link to /domains
    <main max-w-[1400px] mx-auto px-6 py-6>
      ...existing dashboard content (header card, metrics, AI themes, feedback inbox, NEW signups list)
    </main>
  </div>
</AccessRestrictedGuard>
```

- No sidebar, no chapter picker, no clocks, no other admin nav.
- Keep `AccessRestrictedGuard` so only Lee/admins reach it.
- Keep `ProtectedRoute` wrapper in `App.tsx` as-is (auth gate).
- Tiny "Exit" link in the corner that returns to `/domains` (the dashboard selector) so Lee isn't stranded.

Files touched:
- `src/pages/BetaSpring2026Dashboard.tsx` — remove `SurviveSidebarLayout` import + wrapper, add minimal shell.

## 2. Student Signups section

New section rendered as the last block on the page (below Feedback Inbox).

### Columns

| Column | Source |
|---|---|
| # | `student_onboarding.beta_number` (global beta #) |
| Email | `student_onboarding.email` |
| Name | `student_onboarding.display_name` |
| Campus | `campuses.name` (via `student_onboarding.campus_id`) |
| Course | `courses.course_name` (via `student_onboarding.course_id`) — fall back to `getCourseLabel` |
| Signed up | `student_onboarding.created_at` (relative + absolute on hover) |
| Last login | `profiles.last_login_at` |
| Logins | count of `student_events` rows where `event_type IN ('login','session_start')` for that email/user_id |
| Tool opens | count of `student_events` rows where `event_type LIKE 'study_tool_%'` or `'helper_%'` |
| Helper clicks | count of `student_events` rows where `event_type = 'helper_click'` (or matching keys already used) |
| Paid? | green check if a `student_purchases` row exists for that email; tooltip shows `purchase_type` + price |
| Confidence | `student_onboarding.confidence_1_10` (small bar) |

### Behavior

- Default sort: most recent signup first.
- Toolbar: search by email/name, filter by campus, filter by paid/unpaid, CSV export button.
- Pagination: 50 rows per page (signup volume is low — pagination is just a guard).
- Click a row → expand to show: greek_org, syllabus on file (yes/no), beta number, last 5 events.

### Data path

Add a new endpoint to the existing edge function `beta-dashboard-query`:

- New action `signups` (or extend the current response with a `signups` array).
- Service-role query joins:
  ```
  student_onboarding
    LEFT JOIN campuses ON campus_id
    LEFT JOIN courses ON course_id
    LEFT JOIN profiles ON user_id
  ```
  filtered to `is_legacy = false` (real beta users only), ordered by `created_at DESC`.
- Engagement counts come from a single `student_events` aggregate query grouped by `email`, then merged into the signup rows in JS. Limited to events since `2026-04-01` (beta start) so counts stay meaningful.
- Paid lookup: one `student_purchases` query for the same email set; reduce to a `Map<email, purchase>`.

Page-side: render in a new `<SignupsTable />` component inside `BetaSpring2026Dashboard.tsx` (or a sibling file `src/components/beta-dashboard/SignupsTable.tsx` — sibling preferred for readability).

CSV export: client-side, builds a CSV from the loaded rows and triggers download (no new dependencies).

Files touched:
- `src/pages/BetaSpring2026Dashboard.tsx` — render the new section.
- `src/components/beta-dashboard/SignupsTable.tsx` — new component (table, search, filter, CSV export, row expand).
- `supabase/functions/beta-dashboard-query/index.ts` — add `signups` payload to the existing response (single function call still feeds the whole page).

## Out of scope

- No schema changes (all data already exists).
- No new RLS policies (queries run service-role inside the edge function; page is admin-gated client-side).
- No design system changes — reuse existing card / table primitives and the navy/red palette already on this page.
