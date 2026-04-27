## Goal

Add an **"Open in Google Sheets"** button next to **Print PDF** in `SolutionsViewerV2`. It creates a fresh sheet in **your** Drive from a template, then opens Google's standard "Make a copy" prompt in a new tab so the tutor/student lands in *their* own copy. We control the template, they get a personal copy.

## Why this approach works for V0

- You already have **`GOOGLE_SERVICE_ACCOUNT_JSON`**, plus a working pattern in `supabase/functions/create-asset-sheet/` (JWT auth, Drive API, Sheets API helpers).
- Google Drive exposes a built-in **`/edit?usp=sharing` → swap to `/copy`** URL pattern. When opened, Drive shows the user a "Make a copy" dialog and drops the copy in *their* Drive, signed in as them. No per-user OAuth needed.
- Since the user just gets a copy, the source sheet stays clean — perfect for iterating the template.

## Scope (V0)

**Required fields per click:**
- Problem title / source_ref / asset_code
- Course name
- Chapter name + number
- Problem text
- Instructions / required tasks
- Original problem URL (`https://learn.surviveaccounting.com/solutions/{asset_name}`)

**Out of scope:** journal entries, solutions, formulas, anything from the answer key. This is a blank work sheet for live tutoring.

## Steps

### 1. Set up the source template (one-time, manual — I'll guide you)

After this ships, you create one Google Sheet manually in your Drive named `Survive Accounting · Tutoring Template`, share it as **"Anyone with the link → Viewer"**, and paste its file ID into a new Supabase secret `TUTORING_SHEET_TEMPLATE_ID`. The edge function uses this as the source. You can edit the template anytime to refine layout — every future export inherits the latest version.

(If you'd rather skip the manual template and have the function build the sheet from scratch each time, say the word — I'll generate it programmatically with batchUpdate. Template approach is cleaner for iterating styling.)

### 2. New edge function: `supabase/functions/create-tutoring-sheet/index.ts`

- Reuses the `getAccessToken` / `googleFetch` pattern from `create-asset-sheet`.
- Input: `{ assetId: string }`. Server-side fetches asset + chapter + course from `teaching_assets`/`chapters`/`courses` (no client-trusted payload).
- Flow:
  1. Drive API: `POST /files/{TEMPLATE_ID}/copy` with name `Survive Accounting - {course_code} Ch {chapter_number} - {source_ref or asset_code}` into a designated `TUTORING_EXPORTS_FOLDER_ID` (new Drive folder, ID stored as another secret — or reuse `GDRIVE_BACKUP_FOLDER_ID` parent if you want).
  2. Sheets API: `values:batchUpdate` to write the layout you specified (A1 title, A2 course, A3 chapter, A4 problem, A6/A7 problem text, A12/A13 instructions, A18/A19 work area, A25/A26 link).
  3. Drive API: `PATCH /files/{newId}` to set `permissions` → "anyone with link, role: reader" (so the copy prompt works without sign-in to your account).
  4. Build copy URL: `https://docs.google.com/spreadsheets/d/{newId}/copy?title={encoded title}` and return it.
- Logs to a new lightweight table `export_events` (see step 4).

### 3. Frontend button in `src/pages/v2/SolutionsViewerV2.tsx`

- Add `Sheet` icon (lucide `Sheet` or `Table2`) import.
- Add `exporting` state and `handleOpenInSheets()` handler that:
  1. Fires `google_sheet_export_clicked` insert into `export_events`.
  2. Calls `supabase.functions.invoke("create-tutoring-sheet", { body: { assetId: asset.id } })`.
  3. On success: `window.open(data.copyUrl, "_blank", "noopener")` and toast success. The `export_events` row gets updated with `sheet_url` + `event_name = "google_sheet_export_created"` server-side.
  4. On failure: `toast.error("Couldn't open Google Sheets — copied problem to your clipboard instead")` and copy a plain-text version (title + course + chapter + problem text + instructions + URL) to clipboard as fallback.
- Render a second `<Button>` immediately to the right of Print PDF, identical sizing (`size="sm" variant="outline" h-8 px-3 text-xs`), with loading spinner state.

### 4. New table `export_events` (migration)

```sql
create table public.export_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  asset_id uuid references public.teaching_assets(id),
  chapter_id uuid,
  course_id uuid,
  user_id uuid,
  email text,
  sheet_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.export_events enable row level security;
-- Insert: any authenticated or anon (so unauth previewers still log)
create policy "anyone can insert export events" on public.export_events for insert with check (true);
-- Read: admins only (use existing has_role helper if present)
create policy "admins read export events" on public.export_events for select using (public.has_role(auth.uid(), 'admin'));
```

### 5. Don't touch

- Print PDF button, layout, or any other viewer logic.
- Existing `create-asset-sheet` and related VA workflows.

## What I need from you before I build

**One decision:** template-based (you create one sheet manually, paste its ID into a secret) **or** scratch-build (function generates layout + formatting in code each time)?

- **Template** = easier to iterate styling visually, requires one ~2-min manual setup from you.
- **Scratch** = zero manual setup, but every formatting tweak is a code change.

Recommend template for V0 since you said "perfect the template on our end."

Once you pick, I'll: add the secret request (template path) → write the edge function → run the migration → add the button. ~3 sequential steps.