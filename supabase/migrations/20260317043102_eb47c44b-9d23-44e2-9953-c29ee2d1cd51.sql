
-- Entry Builder Sets
CREATE TABLE public.entry_builder_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  course_id uuid REFERENCES public.courses(id),
  chapter_id uuid REFERENCES public.chapters(id),
  status text DEFAULT 'draft',
  plays integer DEFAULT 0,
  completions integer DEFAULT 0
);

ALTER TABLE public.entry_builder_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on entry_builder_sets"
  ON public.entry_builder_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read published entry_builder_sets"
  ON public.entry_builder_sets FOR SELECT TO anon USING (status = 'published');

-- Entry Builder Items
CREATE TABLE public.entry_builder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid REFERENCES public.entry_builder_sets(id) ON DELETE CASCADE,
  transaction_description text NOT NULL,
  date_label text,
  entries jsonb NOT NULL,
  source_asset_id uuid REFERENCES public.teaching_assets(id),
  sort_order integer DEFAULT 0,
  deleted boolean DEFAULT false
);

ALTER TABLE public.entry_builder_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on entry_builder_items"
  ON public.entry_builder_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read entry_builder_items"
  ON public.entry_builder_items FOR SELECT TO anon USING (true);

-- Entry Builder Accounts
CREATE TABLE public.entry_builder_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.chapters(id),
  account_name text NOT NULL,
  account_type text NOT NULL,
  normal_balance text NOT NULL
);

ALTER TABLE public.entry_builder_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access on entry_builder_accounts"
  ON public.entry_builder_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read entry_builder_accounts"
  ON public.entry_builder_accounts FOR SELECT TO anon USING (true);
