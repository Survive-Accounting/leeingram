
-- Create payment_links table
CREATE TABLE public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id),
  chapter_id UUID REFERENCES public.chapters(id),
  link_type TEXT NOT NULL DEFAULT 'full_pass',
  label TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  original_price_cents INTEGER,
  sale_label TEXT,
  sale_expires_at TIMESTAMPTZ,
  url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Public can read active payment links
CREATE POLICY "Anyone can read active payment links"
  ON public.payment_links FOR SELECT
  USING (is_active = true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert payment links"
  ON public.payment_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "Authenticated users can update payment links"
  ON public.payment_links FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
