
-- Add semester start/end dates to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS semester_start_date date,
ADD COLUMN IF NOT EXISTS semester_end_date date;

-- Update default max refinements to 5
ALTER TABLE public.emails ALTER COLUMN max_refinements SET DEFAULT 5;
