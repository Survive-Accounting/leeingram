CREATE TABLE public.magic_link_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_magic_link_nonces_nonce ON public.magic_link_nonces(nonce);
CREATE INDEX idx_magic_link_nonces_email_created ON public.magic_link_nonces(email, created_at DESC);

ALTER TABLE public.magic_link_nonces ENABLE ROW LEVEL SECURITY;

-- No policies = no client access. Service role bypasses RLS.
