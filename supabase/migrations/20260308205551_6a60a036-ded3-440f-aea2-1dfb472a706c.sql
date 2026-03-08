
-- VA test accounts table
CREATE TABLE public.va_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'va_test',
  assigned_course_id uuid REFERENCES public.courses(id),
  assigned_chapter_id uuid REFERENCES public.chapters(id),
  account_status text NOT NULL DEFAULT 'active',
  test_assigned_at timestamptz NOT NULL DEFAULT now(),
  first_login_at timestamptz,
  first_action_at timestamptz,
  last_action_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.va_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read va_accounts" ON public.va_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert va_accounts" ON public.va_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update va_accounts" ON public.va_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete va_accounts" ON public.va_accounts FOR DELETE TO authenticated USING (true);

-- VA activity log table
CREATE TABLE public.va_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id),
  action_type text NOT NULL,
  asset_id uuid,
  payload_json jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.va_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read va_activity_log" ON public.va_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert va_activity_log" ON public.va_activity_log FOR INSERT TO authenticated WITH CHECK (true);
