ALTER TABLE public.explanation_feedback
  ALTER COLUMN reason TYPE TEXT[] USING CASE WHEN reason IS NULL THEN NULL ELSE ARRAY[reason] END;
