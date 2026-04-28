-- Referral codes: one per user
CREATE TABLE public.referral_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_codes_user_id ON public.referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral code"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Anyone can look up a code by string (needed when validating ?ref= on landing)
CREATE POLICY "Public can resolve a code to its referrer"
  ON public.referral_codes FOR SELECT
  USING (true);

-- Referral attributions: one row per landing/signup event
CREATE TABLE public.referral_attributions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id uuid NOT NULL,
  referral_code text NOT NULL,
  referred_email text,
  referred_user_id uuid,
  landing_at timestamptz NOT NULL DEFAULT now(),
  signup_at timestamptz,
  status text NOT NULL DEFAULT 'landed' CHECK (status IN ('landed', 'signed_up', 'rewarded')),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_attributions_referrer ON public.referral_attributions(referrer_user_id);
CREATE INDEX idx_referral_attributions_code ON public.referral_attributions(referral_code);
CREATE INDEX idx_referral_attributions_referred_user ON public.referral_attributions(referred_user_id);

ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can record a landing — tracking pixel use case
CREATE POLICY "Anyone can record a referral landing"
  ON public.referral_attributions FOR INSERT
  WITH CHECK (true);

-- Referrers can see their own attributions
CREATE POLICY "Referrers can view their attributions"
  ON public.referral_attributions FOR SELECT
  USING (auth.uid() = referrer_user_id);
