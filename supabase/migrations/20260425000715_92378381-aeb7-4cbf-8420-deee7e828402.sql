
CREATE TABLE public.web_dev_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  bullet_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Not Started',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.web_dev_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view web dev features"
ON public.web_dev_features FOR SELECT
USING (true);

CREATE POLICY "Only Lee can insert web dev features"
ON public.web_dev_features FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'email') = 'lee@survivestudios.com'
);

CREATE POLICY "Only Lee can update web dev features"
ON public.web_dev_features FOR UPDATE
USING (
  (auth.jwt() ->> 'email') = 'lee@survivestudios.com'
);

CREATE POLICY "Only Lee can delete web dev features"
ON public.web_dev_features FOR DELETE
USING (
  (auth.jwt() ->> 'email') = 'lee@survivestudios.com'
);

CREATE TRIGGER update_web_dev_features_updated_at
BEFORE UPDATE ON public.web_dev_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.web_dev_features (title, status, description, bullet_points, sort_order) VALUES
  ('Greek Org Self-Serve Bulk Orders', 'Testing', 'Let chapter treasurers buy seats for their entire house in one checkout.', '["Treasurer dashboard","Bulk seat purchase flow","Auto-invite members via email"]'::jsonb, 1),
  ('Auto-Add Seats', 'Testing', 'When an org runs out of seats, automatically queue an auto re-up so new members aren''t blocked.', '["Detects exhausted seat pools","Queues pending members","Charges org on next billing cycle"]'::jsonb, 2),
  ('Greek Cross-Sell Engine', 'In Progress', 'Surface relevant Survive products to Greek members based on their course load.', '["Course-based recommendations","In-portal upsell cards","Discount codes for org members"]'::jsonb, 3),
  ('Advanced Checkout System', 'Testing', 'Embedded Stripe checkout with .edu validation and dynamic campus pricing.', '["Embedded Stripe","edu enforcement","Campus price overrides"]'::jsonb, 4),
  ('Campus Detection', 'Live', 'Map student .edu domains to specific campuses for routing and pricing.', '["HIPOLABS auto-resolution","Manual override table","Confidence scoring"]'::jsonb, 5),
  ('Campus Landing Pages', 'In Progress', 'School-specific landing pages with dynamic SEO, mascots, and local pricing.', '["Dynamic mascot + colors","Local course codes","Campus-specific pricing"]'::jsonb, 6),
  ('Video Requests & Queue', 'Not Started', 'Let students request walkthrough videos and let staff process them in a queue.', '["Student request form","Priority queue","Status notifications"]'::jsonb, 7);
