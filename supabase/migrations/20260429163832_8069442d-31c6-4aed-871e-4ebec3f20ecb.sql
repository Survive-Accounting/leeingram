ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS early_bird_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_bird_opt_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_students_early_bird_opt_in
  ON public.students (early_bird_opt_in)
  WHERE early_bird_opt_in = true;