ALTER TABLE public.viral_passes
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_2hr_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_viral_passes_pass_code ON public.viral_passes(pass_code);
CREATE INDEX IF NOT EXISTS idx_video_request_upvotes_request ON public.video_request_upvotes(video_request_id);