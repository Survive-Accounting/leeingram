ALTER TABLE public.student_onboarding
  ADD COLUMN IF NOT EXISTS early_bird_opt_in boolean NOT NULL DEFAULT false;

UPDATE public.student_onboarding so
   SET early_bird_opt_in = true
  FROM auth.users u
 WHERE so.user_id = u.id
   AND COALESCE((u.raw_user_meta_data ->> 'early_bird_opt_in')::boolean, false) = true
   AND so.early_bird_opt_in = false;