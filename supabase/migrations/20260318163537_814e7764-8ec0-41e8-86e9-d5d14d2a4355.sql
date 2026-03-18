
-- Create edu_preview_sessions table
CREATE TABLE public.edu_preview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  asset_ids uuid[] NOT NULL,
  asset_codes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used boolean NOT NULL DEFAULT false
);

-- Unique index on email (one session per .edu email)
CREATE UNIQUE INDEX idx_edu_preview_sessions_email ON public.edu_preview_sessions (email);

-- Enable RLS
ALTER TABLE public.edu_preview_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for new signups - no auth required)
CREATE POLICY "Allow public insert" ON public.edu_preview_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow public select by id (for link validation)
CREATE POLICY "Allow public select by id" ON public.edu_preview_sessions
  FOR SELECT TO anon, authenticated
  USING (true);
