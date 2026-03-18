ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS instruction_1 text,
  ADD COLUMN IF NOT EXISTS instruction_2 text,
  ADD COLUMN IF NOT EXISTS instruction_3 text,
  ADD COLUMN IF NOT EXISTS instruction_4 text,
  ADD COLUMN IF NOT EXISTS instruction_5 text,
  ADD COLUMN IF NOT EXISTS instruction_list text;