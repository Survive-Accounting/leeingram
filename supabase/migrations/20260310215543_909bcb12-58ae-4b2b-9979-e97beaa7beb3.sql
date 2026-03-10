ALTER TABLE public.teaching_assets 
ADD COLUMN IF NOT EXISTS sheet_master_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sheet_practice_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sheet_promo_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sheet_path_url text DEFAULT NULL;