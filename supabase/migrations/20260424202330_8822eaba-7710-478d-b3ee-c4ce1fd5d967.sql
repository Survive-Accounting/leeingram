
-- ──────────────────────────────────────────────────────────
-- org_members: roster of members who joined via invite link
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id uuid NOT NULL REFERENCES public.org_accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending_auto_reup', 'waitlisted', 'removed')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES public.org_license_purchases(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_account_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_account ON public.org_members(org_account_id);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON public.org_members(email);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to org_members"
  ON public.org_members FOR SELECT
  USING (false);

-- ──────────────────────────────────────────────────────────
-- org_pending_auto_reup: queue when seats run out but auto re-up is enabled
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_pending_auto_reup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id uuid NOT NULL REFERENCES public.org_accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'fulfilled', 'cancelled')),
  queued_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  UNIQUE (org_account_id, email)
);

CREATE INDEX IF NOT EXISTS idx_pending_auto_reup_account ON public.org_pending_auto_reup(org_account_id);
CREATE INDEX IF NOT EXISTS idx_pending_auto_reup_status ON public.org_pending_auto_reup(status);

ALTER TABLE public.org_pending_auto_reup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to org_pending_auto_reup"
  ON public.org_pending_auto_reup FOR SELECT
  USING (false);

-- ──────────────────────────────────────────────────────────
-- claim_org_seat(p_org_account_id, p_email)
-- Returns: outcome jsonb { outcome, seats_remaining, purchase_id, auto_reup_enabled }
--   outcome: 'granted' | 'queued_auto_reup' | 'out_of_seats' | 'already_member' | 'org_inactive'
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_org_seat(
  p_org_account_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_account record;
  v_purchase record;
  v_existing record;
  v_remaining int;
BEGIN
  SELECT id, status, auto_reup_enabled
    INTO v_account
    FROM org_accounts
   WHERE id = p_org_account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'org_inactive');
  END IF;

  IF v_account.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'org_inactive', 'status', v_account.status);
  END IF;

  -- Already a member?
  SELECT id, status
    INTO v_existing
    FROM org_members
   WHERE org_account_id = p_org_account_id
     AND lower(email) = v_email;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'outcome', 'already_member',
      'member_status', v_existing.status
    );
  END IF;

  -- Find the most recent paid purchase with seats remaining (locked)
  SELECT id, seats_purchased, seats_used
    INTO v_purchase
    FROM org_license_purchases
   WHERE org_account_id = p_org_account_id
     AND payment_status IN ('paid', 'manual')
     AND seats_used < seats_purchased
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    UPDATE org_license_purchases
       SET seats_used = seats_used + 1
     WHERE id = v_purchase.id;

    INSERT INTO org_members (org_account_id, email, status, purchase_id)
    VALUES (p_org_account_id, v_email, 'active', v_purchase.id);

    SELECT COALESCE(SUM(seats_purchased - seats_used), 0)::int
      INTO v_remaining
      FROM org_license_purchases
     WHERE org_account_id = p_org_account_id
       AND payment_status IN ('paid', 'manual');

    RETURN jsonb_build_object(
      'outcome', 'granted',
      'purchase_id', v_purchase.id,
      'seats_remaining', v_remaining
    );
  END IF;

  -- No seats. Auto re-up?
  IF v_account.auto_reup_enabled THEN
    INSERT INTO org_members (org_account_id, email, status)
    VALUES (p_org_account_id, v_email, 'pending_auto_reup');

    INSERT INTO org_pending_auto_reup (org_account_id, email, status)
    VALUES (p_org_account_id, v_email, 'queued')
    ON CONFLICT (org_account_id, email) DO NOTHING;

    RETURN jsonb_build_object('outcome', 'queued_auto_reup');
  END IF;

  -- Out of seats, no auto re-up
  INSERT INTO org_members (org_account_id, email, status)
  VALUES (p_org_account_id, v_email, 'waitlisted');

  RETURN jsonb_build_object('outcome', 'out_of_seats');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_org_seat(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_org_seat(uuid, text) TO anon, authenticated, service_role;
