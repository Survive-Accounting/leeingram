
-- Add new columns to chapter_accounts
ALTER TABLE public.chapter_accounts
  ADD COLUMN IF NOT EXISTS normal_balance text NOT NULL DEFAULT 'Debit',
  ADD COLUMN IF NOT EXISTS debit_effect text NOT NULL DEFAULT 'Increase',
  ADD COLUMN IF NOT EXISTS credit_effect text NOT NULL DEFAULT 'Decrease';

-- Set account_type NOT NULL with default
ALTER TABLE public.chapter_accounts
  ALTER COLUMN account_type SET DEFAULT 'Asset',
  ALTER COLUMN account_type SET NOT NULL;

-- Add unique constraint on (chapter_id, account_name) case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS chapter_accounts_chapter_id_account_name_unique
  ON public.chapter_accounts (chapter_id, lower(account_name));
