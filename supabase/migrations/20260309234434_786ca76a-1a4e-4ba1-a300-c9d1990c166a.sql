
-- VA Assignments: track which VA is assigned to which chapter
CREATE TABLE public.va_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  va_account_id UUID REFERENCES public.va_accounts(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'not_started',
  hours_logged NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.va_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read va_assignments" ON public.va_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write va_assignments" ON public.va_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update va_assignments" ON public.va_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete va_assignments" ON public.va_assignments FOR DELETE TO authenticated USING (true);

-- Asset Flags: track flagged assets needing attention
CREATE TABLE public.asset_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teaching_asset_id UUID REFERENCES public.teaching_assets(id) ON DELETE CASCADE NOT NULL,
  flagged_by_va_id UUID REFERENCES public.va_accounts(id) ON DELETE SET NULL,
  flag_reason TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.asset_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read asset_flags" ON public.asset_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write asset_flags" ON public.asset_flags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update asset_flags" ON public.asset_flags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete asset_flags" ON public.asset_flags FOR DELETE TO authenticated USING (true);

-- VA Questions: VAs can submit questions
CREATE TABLE public.va_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  va_account_id UUID REFERENCES public.va_accounts(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  question TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  admin_response TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  addressed_at TIMESTAMPTZ
);

ALTER TABLE public.va_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read va_questions" ON public.va_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write va_questions" ON public.va_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update va_questions" ON public.va_questions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete va_questions" ON public.va_questions FOR DELETE TO authenticated USING (true);

-- Admin Notes: internal notes on VAs, chapters, assets
CREATE TABLE public.admin_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id UUID NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read admin_notes" ON public.admin_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write admin_notes" ON public.admin_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update admin_notes" ON public.admin_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete admin_notes" ON public.admin_notes FOR DELETE TO authenticated USING (true);

-- Add google_sheet_status to teaching_assets
ALTER TABLE public.teaching_assets ADD COLUMN IF NOT EXISTS google_sheet_status TEXT NOT NULL DEFAULT 'none';
