
-- Add discount columns to campus_pricing
ALTER TABLE public.campus_pricing
  ADD COLUMN IF NOT EXISTS anchor_price_cents integer,
  ADD COLUMN IF NOT EXISTS discount_percent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_label text,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- Backfill: set anchor_price_cents = price_cents for existing rows where anchor is null
UPDATE public.campus_pricing
SET anchor_price_cents = price_cents
WHERE anchor_price_cents IS NULL;

-- Seed global semester pass discount
INSERT INTO public.campus_pricing (
  campus_id, product_type, anchor_price_cents, price_cents, discount_percent, discount_label, valid_from, valid_until, is_active
) VALUES (
  NULL, 'semester_pass', 25000, 12500, 50, 'Finals Special', '2026-01-01', '2026-05-31', true
)
ON CONFLICT DO NOTHING;
