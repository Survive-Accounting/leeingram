CREATE POLICY "Public read problem_instructions"
ON public.problem_instructions
FOR SELECT
TO anon
USING (true);