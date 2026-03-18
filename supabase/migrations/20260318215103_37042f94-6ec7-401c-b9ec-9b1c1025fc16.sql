CREATE TABLE public.preview_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX preview_rate_limits_ip_hash_idx ON public.preview_rate_limits (ip_hash);

ALTER TABLE public.preview_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.preview_rate_limits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public select" ON public.preview_rate_limits FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public update" ON public.preview_rate_limits FOR UPDATE TO anon USING (true) WITH CHECK (true);