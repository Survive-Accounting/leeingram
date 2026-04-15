
CREATE TABLE public.student_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  last_login_at TIMESTAMPTZ DEFAULT now(),
  first_login_at TIMESTAMPTZ DEFAULT now(),
  login_count INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_student_devices_student ON public.student_devices(student_id);
CREATE INDEX idx_student_devices_email ON public.student_devices(email);
CREATE INDEX idx_student_devices_fingerprint ON public.student_devices(device_fingerprint);
CREATE INDEX idx_student_devices_flagged ON public.student_devices(is_flagged) WHERE is_flagged = true;

CREATE OR REPLACE FUNCTION public.count_student_devices(p_student_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.student_devices
  WHERE student_id = p_student_id AND is_active = true;
$$;
