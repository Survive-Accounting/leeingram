
-- Shadow columns on teaching_assets
ALTER TABLE public.teaching_assets
  ADD COLUMN IF NOT EXISTS you_problem_text text,
  ADD COLUMN IF NOT EXISTS you_instruction_1 text,
  ADD COLUMN IF NOT EXISTS you_instruction_2 text,
  ADD COLUMN IF NOT EXISTS you_instruction_3 text,
  ADD COLUMN IF NOT EXISTS you_instruction_4 text,
  ADD COLUMN IF NOT EXISTS you_instruction_5 text,
  ADD COLUMN IF NOT EXISTS you_business_name text,
  ADD COLUMN IF NOT EXISTS you_format_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS you_format_notes text,
  ADD COLUMN IF NOT EXISTS you_format_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS you_format_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS you_format_approved_by text;

CREATE INDEX IF NOT EXISTS idx_teaching_assets_you_format_status
  ON public.teaching_assets(you_format_status);

-- Business library
CREATE TABLE IF NOT EXISTS public.you_format_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT you_format_businesses_name_unique UNIQUE (name)
);

ALTER TABLE public.you_format_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read businesses"
  ON public.you_format_businesses FOR SELECT USING (true);

CREATE POLICY "Admins manage businesses"
  ON public.you_format_businesses FOR ALL
  USING (auth.jwt() ->> 'email' IN (
    'lee@surviveaccounting.com','leeingram01@gmail.com'
  ))
  WITH CHECK (auth.jwt() ->> 'email' IN (
    'lee@surviveaccounting.com','leeingram01@gmail.com'
  ));

CREATE TRIGGER trg_you_format_businesses_updated
  BEFORE UPDATE ON public.you_format_businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chapter -> allowed domains mapping
CREATE TABLE IF NOT EXISTS public.you_format_chapter_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT you_format_chapter_domains_unique UNIQUE (chapter_id, domain)
);

ALTER TABLE public.you_format_chapter_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapter domains"
  ON public.you_format_chapter_domains FOR SELECT USING (true);

CREATE POLICY "Admins manage chapter domains"
  ON public.you_format_chapter_domains FOR ALL
  USING (auth.jwt() ->> 'email' IN (
    'lee@surviveaccounting.com','leeingram01@gmail.com'
  ))
  WITH CHECK (auth.jwt() ->> 'email' IN (
    'lee@surviveaccounting.com','leeingram01@gmail.com'
  ));

-- Seed curated business library (~30 across domains)
INSERT INTO public.you_format_businesses (name, domain, description) VALUES
  -- Retail
  ('Northpine Outfitters', 'retail', 'Outdoor gear retail store'),
  ('Cedar & Vine Market', 'retail', 'Specialty grocery'),
  ('Harbor Books', 'retail', 'Independent bookstore'),
  ('Loop Cycles', 'retail', 'Bike shop'),
  ('Bramble Home Goods', 'retail', 'Home decor retailer'),
  ('Field Notes Coffee', 'retail', 'Coffee roaster and cafe'),
  -- Manufacturing
  ('Ironwood Furniture Co.', 'manufacturing', 'Wood furniture manufacturer'),
  ('Brightline Bicycles', 'manufacturing', 'Bicycle manufacturer'),
  ('Sumter Steel Works', 'manufacturing', 'Steel components manufacturer'),
  ('Plainfield Apparel', 'manufacturing', 'Clothing manufacturer'),
  ('Riverside Ceramics', 'manufacturing', 'Pottery and tile manufacturer'),
  -- Services
  ('Greystone Consulting', 'services', 'Management consulting firm'),
  ('Atlas Property Management', 'services', 'Property management services'),
  ('Beacon Marketing Group', 'services', 'Marketing agency'),
  ('Trailhead Architects', 'services', 'Architecture firm'),
  ('Magnolia Veterinary Clinic', 'services', 'Veterinary services'),
  -- Professional (legal/accounting/medical)
  ('Westbrook Legal', 'professional', 'Law firm'),
  ('Summit Family Dentistry', 'professional', 'Dental practice'),
  ('Park Avenue Accounting', 'professional', 'CPA firm'),
  -- Tech / SaaS
  ('Lattice Software', 'tech', 'B2B SaaS company'),
  ('Pinecone Analytics', 'tech', 'Data analytics startup'),
  -- Hospitality / Food
  ('Driftwood Inn', 'hospitality', 'Boutique hotel'),
  ('Calliope Catering', 'hospitality', 'Catering company'),
  ('Two Rivers Brewing', 'hospitality', 'Craft brewery and taproom'),
  -- Construction / Real Estate
  ('Keystone Builders', 'construction', 'General contractor'),
  ('Foxglove Realty', 'real_estate', 'Real estate brokerage'),
  -- Transportation / Logistics
  ('Crosswind Logistics', 'logistics', 'Freight and logistics company'),
  ('Marlow Auto Group', 'automotive', 'Car dealership'),
  -- Healthcare
  ('Willow Creek Pharmacy', 'healthcare', 'Independent pharmacy'),
  ('Cardinal Physical Therapy', 'healthcare', 'PT clinic')
ON CONFLICT (name) DO NOTHING;
