CREATE TABLE public.problem_referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id text NOT NULL,
  problem_id uuid,
  problem_code text,
  visitor_id text,
  visitor_email text,
  event_type text NOT NULL DEFAULT 'share_click' CHECK (event_type IN ('share_click', 'visit')),
  converted boolean NOT NULL DEFAULT false,
  converted_at timestamptz,
  referrer_url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_problem_referrals_referrer_id ON public.problem_referrals (referrer_id);
CREATE INDEX idx_problem_referrals_problem_id ON public.problem_referrals (problem_id);
CREATE INDEX idx_problem_referrals_visitor_id ON public.problem_referrals (visitor_id);
CREATE INDEX idx_problem_referrals_converted ON public.problem_referrals (converted) WHERE converted = true;
CREATE INDEX idx_problem_referrals_created_at ON public.problem_referrals (created_at DESC);

ALTER TABLE public.problem_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create problem referrals"
  ON public.problem_referrals
  FOR INSERT
  WITH CHECK (true);