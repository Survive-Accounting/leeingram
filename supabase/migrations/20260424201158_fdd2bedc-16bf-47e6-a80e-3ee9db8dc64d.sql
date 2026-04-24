ALTER TABLE public.org_accounts
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'ach'
    CHECK (payment_method IN ('ach', 'card', 'manual'));