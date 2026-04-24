ALTER TABLE public.org_accounts
  ADD COLUMN IF NOT EXISTS auto_reup_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_seat_limit INTEGER NOT NULL DEFAULT 20
    CHECK (weekly_seat_limit IN (10, 20, 30, 50));