-- Create profiles table for user data + sharing-monitor fields
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  last_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id link to student_purchases (email link stays for back-compat)
ALTER TABLE public.student_purchases
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_purchases_user_id ON public.student_purchases(user_id);

-- Backfill user_id by matching email
UPDATE public.student_purchases sp
SET user_id = u.id
FROM auth.users u
WHERE sp.user_id IS NULL
  AND lower(sp.email) = lower(u.email);

-- RLS so authenticated users can read their own purchases
DROP POLICY IF EXISTS "Users can view own purchases by user_id or email" ON public.student_purchases;
CREATE POLICY "Users can view own purchases by user_id or email"
  ON public.student_purchases FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );