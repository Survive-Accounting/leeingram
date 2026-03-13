
-- Drop and recreate the INSERT policy to ensure it works correctly
DROP POLICY IF EXISTS "Authenticated write va_assignments" ON public.va_assignments;
CREATE POLICY "Authenticated insert va_assignments"
  ON public.va_assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);
