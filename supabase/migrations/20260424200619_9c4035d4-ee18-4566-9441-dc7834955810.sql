-- Configurable seat-based pricing for Greek org licensing
CREATE TABLE public.org_seat_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seats INTEGER NOT NULL CHECK (seats >= 1),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  per_seat_cents INTEGER GENERATED ALWAYS AS (total_cents / NULLIF(seats, 0)) STORED,
  label TEXT,
  badge TEXT,
  is_promo BOOLEAN NOT NULL DEFAULT false,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_seat_pricing ENABLE ROW LEVEL SECURITY;

-- Public can read active tiers (pricing is shown on /get-org-access)
CREATE POLICY "Anyone can view active org seat pricing"
ON public.org_seat_pricing
FOR SELECT
USING (is_active = true);

-- Authenticated staff can manage tiers
CREATE POLICY "Authenticated users can insert org seat pricing"
ON public.org_seat_pricing
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update org seat pricing"
ON public.org_seat_pricing
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete org seat pricing"
ON public.org_seat_pricing
FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_org_seat_pricing_updated_at
BEFORE UPDATE ON public.org_seat_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed standard tiers ($100/seat, min 10) + founding promo
INSERT INTO public.org_seat_pricing (seats, total_cents, label, badge, is_promo, is_recommended, sort_order)
VALUES
  (10, 50000,  'Founding chapter pilot', 'Founding pilot', true,  false, 0),
  (10, 100000, NULL,                     NULL,             false, false, 10),
  (20, 200000, NULL,                     'Popular',        false, true,  20),
  (30, 300000, NULL,                     NULL,             false, false, 30),
  (40, 400000, NULL,                     NULL,             false, false, 40);