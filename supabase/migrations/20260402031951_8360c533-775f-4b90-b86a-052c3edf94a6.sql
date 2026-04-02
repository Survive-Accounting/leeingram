
-- Add new columns
ALTER TABLE public.chapter_questions
  ADD COLUMN IF NOT EXISTS responded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS respond_by_at timestamptz;

-- Function: calculate respond-by deadline (2 business days, 5 PM Central)
CREATE OR REPLACE FUNCTION public.calculate_respond_by(p_created_at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  base_date date;
  dow int;
  result_date date;
  days_added int := 0;
BEGIN
  -- Convert to Chicago date
  base_date := (p_created_at AT TIME ZONE 'America/Chicago')::date;
  result_date := base_date;

  -- Add 2 business days
  WHILE days_added < 2 LOOP
    result_date := result_date + 1;
    dow := EXTRACT(ISODOW FROM result_date);
    IF dow <= 5 THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;

  -- Return as 5:00 PM Chicago time
  RETURN (result_date || ' 17:00:00')::timestamp AT TIME ZONE 'America/Chicago';
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_respond_by_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.respond_by_at := public.calculate_respond_by(NEW.created_at);
  RETURN NEW;
END;
$$;

-- Trigger on insert
CREATE TRIGGER trg_set_respond_by_at
  BEFORE INSERT ON public.chapter_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_respond_by_at();

-- Backfill existing rows
UPDATE public.chapter_questions
SET respond_by_at = public.calculate_respond_by(created_at)
WHERE respond_by_at IS NULL;
