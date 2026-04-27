create table if not exists public.export_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  asset_id uuid,
  asset_code text,
  chapter_id uuid,
  course_id uuid,
  user_id uuid,
  email text,
  sheet_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists export_events_asset_id_idx on public.export_events(asset_id);
create index if not exists export_events_created_at_idx on public.export_events(created_at desc);

alter table public.export_events enable row level security;

create policy "anyone can insert export events"
  on public.export_events
  for insert
  with check (true);