-- Simplify beta onboarding: add identity + role fields, relax major constraint
ALTER TABLE public.student_onboarding
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS accounting_major_status text,
  ADD COLUMN IF NOT EXISTS onboarding_version text;

-- Allow 'not_sure' (and keep prior values for back-compat)
ALTER TABLE public.student_onboarding
  DROP CONSTRAINT IF EXISTS student_onboarding_is_accounting_major_check;

ALTER TABLE public.student_onboarding
  ADD CONSTRAINT student_onboarding_is_accounting_major_check
  CHECK (is_accounting_major IS NULL OR is_accounting_major IN ('yes','no','definitely_not','not_sure'));

ALTER TABLE public.student_onboarding
  ADD CONSTRAINT student_onboarding_user_role_check
  CHECK (user_role IS NULL OR user_role IN ('student','parent','professor','cpa_professional','other'));

ALTER TABLE public.student_onboarding
  ADD CONSTRAINT student_onboarding_accounting_major_status_check
  CHECK (accounting_major_status IS NULL OR accounting_major_status IN ('yes','no','not_sure'));