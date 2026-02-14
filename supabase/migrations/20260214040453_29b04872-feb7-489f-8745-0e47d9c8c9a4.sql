-- Add scheduling & series columns to emails
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS send_date date,
  ADD COLUMN IF NOT EXISTS send_day text DEFAULT '',
  ADD COLUMN IF NOT EXISTS send_time text DEFAULT '',
  ADD COLUMN IF NOT EXISTS send_week integer,
  ADD COLUMN IF NOT EXISTS series_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_series boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS series_order integer,
  ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;

-- Create index for series grouping
CREATE INDEX IF NOT EXISTS idx_emails_series_name ON public.emails (series_name) WHERE series_name != '';