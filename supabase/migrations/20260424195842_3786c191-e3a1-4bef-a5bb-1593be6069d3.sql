
-- Extend campuses with optional fields used by Greek licensing
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS email_domain text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Greek orgs (verified + user-added)
CREATE TABLE IF NOT EXISTS public.greek_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  org_name text NOT NULL,
  org_slug text NOT NULL,
  council text,
  org_type text,
  aliases text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified','unverified','user_added')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, org_slug)
);
CREATE INDEX IF NOT EXISTS idx_greek_orgs_campus ON public.greek_orgs(campus_id);
CREATE INDEX IF NOT EXISTS idx_greek_orgs_status ON public.greek_orgs(status);

-- Org licensing accounts
CREATE TABLE IF NOT EXISTS public.org_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE RESTRICT,
  greek_org_id uuid REFERENCES public.greek_orgs(id) ON DELETE SET NULL,
  org_name_manual text,
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_payment','active','pending_manual_payment')),
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_accounts_campus ON public.org_accounts(campus_id);
CREATE INDEX IF NOT EXISTS idx_org_accounts_greek_org ON public.org_accounts(greek_org_id);
CREATE INDEX IF NOT EXISTS idx_org_accounts_email ON public.org_accounts(contact_email);

-- Org admins
CREATE TABLE IF NOT EXISTS public.org_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id uuid NOT NULL REFERENCES public.org_accounts(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','billing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_account_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_org_admins_account ON public.org_admins(org_account_id);
CREATE INDEX IF NOT EXISTS idx_org_admins_email ON public.org_admins(user_email);

-- License purchases
CREATE TABLE IF NOT EXISTS public.org_license_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id uuid NOT NULL REFERENCES public.org_accounts(id) ON DELETE CASCADE,
  seats_purchased int NOT NULL CHECK (seats_purchased > 0),
  seats_used int NOT NULL DEFAULT 0 CHECK (seats_used >= 0),
  price_per_seat int NOT NULL,
  total_paid int NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded','failed','manual')),
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_license_purchases_account ON public.org_license_purchases(org_account_id);
CREATE INDEX IF NOT EXISTS idx_org_license_purchases_status ON public.org_license_purchases(payment_status);

-- RLS
ALTER TABLE public.greek_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_license_purchases ENABLE ROW LEVEL SECURITY;

-- Public can read verified/user_added Greek orgs (for the directory picker)
CREATE POLICY "Public read greek orgs"
  ON public.greek_orgs FOR SELECT
  USING (true);

-- Org accounts / admins / purchases: no public access; service role bypasses RLS.
-- Future authenticated policies will be added when the Greek portal auth flow lands.
CREATE POLICY "Deny anon access to org_accounts"
  ON public.org_accounts FOR SELECT USING (false);

CREATE POLICY "Deny anon access to org_admins"
  ON public.org_admins FOR SELECT USING (false);

CREATE POLICY "Deny anon access to org_license_purchases"
  ON public.org_license_purchases FOR SELECT USING (false);
