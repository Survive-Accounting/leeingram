-- priority_queue_config already exists; add any missing columns
ALTER TABLE public.priority_queue_config
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS same_day_price_cents integer DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS two_day_price_cents integer DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS cutoff_time time DEFAULT '14:00:00',
  ADD COLUMN IF NOT EXISTS beta_mode boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

INSERT INTO public.priority_queue_config (is_active, beta_mode)
SELECT false, true
WHERE NOT EXISTS (SELECT 1 FROM public.priority_queue_config);
