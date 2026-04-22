-- Survive AI response cache
CREATE TABLE public.survive_ai_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  prompt_type text NOT NULL,
  response_text text NOT NULL,
  model_used text,
  helpful_count integer DEFAULT 0,
  not_helpful_count integer DEFAULT 0,
  video_requested_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(asset_id, prompt_type)
);

-- Video requests
CREATE TABLE public.video_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  student_email text,
  question text NOT NULL,
  prompt_type text,
  is_accounting_major boolean DEFAULT false,
  upvote_count integer DEFAULT 0,
  status text DEFAULT 'pending',
  video_url text,
  is_priority boolean DEFAULT false,
  priority_paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Upvotes for video requests
CREATE TABLE public.video_request_upvotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_request_id uuid REFERENCES public.video_requests(id) ON DELETE CASCADE,
  student_email text,
  created_at timestamptz DEFAULT now()
);

-- Viral passes
CREATE TABLE public.viral_passes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_request_id uuid REFERENCES public.video_requests(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.teaching_assets(id) ON DELETE CASCADE,
  recipient_email text,
  pass_code text UNIQUE NOT NULL,
  trial_type text DEFAULT '2hr',
  opened_at timestamptz,
  trial_started_at timestamptz,
  converted_at timestamptz,
  conversion_window text,
  created_at timestamptz DEFAULT now()
);

-- Referrals
CREATE TABLE public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_email text NOT NULL,
  referred_email text NOT NULL,
  pass_code text REFERENCES public.viral_passes(pass_code),
  converted boolean DEFAULT false,
  revenue_cents integer DEFAULT 0,
  balance_cents integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Priority queue sessions
CREATE TABLE public.priority_queue_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clocked_in_at timestamptz,
  clocked_out_at timestamptz,
  cutoff_time time,
  submissions_count integer DEFAULT 0,
  revenue_cents integer DEFAULT 0
);

-- Priority queue config (singleton)
CREATE TABLE public.priority_queue_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active boolean DEFAULT false,
  price_cents integer DEFAULT 1500,
  cutoff_time time DEFAULT '14:00:00',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.priority_queue_config (is_active, price_cents, cutoff_time)
VALUES (false, 1500, '14:00:00');

-- Enable RLS
ALTER TABLE public.survive_ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_request_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_queue_config ENABLE ROW LEVEL SECURITY;

-- Service role has implicit full access; no policies needed for it.
-- Anon SELECT only on priority_queue_config:
CREATE POLICY "Anyone can read priority queue config"
  ON public.priority_queue_config
  FOR SELECT
  USING (true);
