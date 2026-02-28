
CREATE TABLE public.chart_of_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'Asset',
  normal_balance text NOT NULL DEFAULT 'Debit',
  keywords text[] DEFAULT '{}',
  is_global_default boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Case-insensitive unique constraint
CREATE UNIQUE INDEX chart_of_accounts_canonical_name_unique ON public.chart_of_accounts (lower(canonical_name));

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read chart_of_accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write chart_of_accounts" ON public.chart_of_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update chart_of_accounts" ON public.chart_of_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete chart_of_accounts" ON public.chart_of_accounts FOR DELETE TO authenticated USING (true);
