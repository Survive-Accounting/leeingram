
CREATE TABLE public.course_products (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references public.courses(id) not null,
  chapter_id uuid references public.chapters(id),
  product_type text not null, -- 'full_pass' | 'chapter_pass'
  stripe_price_id_live text,
  stripe_price_id_test text,
  display_name text not null,
  price_cents integer not null default 12500,
  original_price_cents integer,
  sale_label text,
  sale_expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(course_id, chapter_id, product_type)
);

ALTER TABLE public.course_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active course products"
  ON public.course_products FOR SELECT
  USING (is_active = true);
