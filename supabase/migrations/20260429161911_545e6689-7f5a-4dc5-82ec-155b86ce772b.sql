-- Phase 1: RPC to fetch the first asset + first JE asset for a chapter in a single round-trip.
-- Replaces two sequential client-side queries used by the Study Console.

CREATE OR REPLACE FUNCTION public.get_chapter_entry_assets(p_chapter_id uuid)
RETURNS TABLE(first_asset_name text, first_je_asset_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_any AS (
    SELECT asset_name
      FROM public.teaching_assets
     WHERE chapter_id = p_chapter_id
     ORDER BY source_number ASC NULLS LAST, asset_name ASC
     LIMIT 1
  ),
  first_je AS (
    SELECT asset_name
      FROM public.teaching_assets
     WHERE chapter_id = p_chapter_id
       AND journal_entry_completed_json IS NOT NULL
     ORDER BY source_number ASC NULLS LAST, asset_name ASC
     LIMIT 1
  )
  SELECT
    (SELECT asset_name FROM first_any) AS first_asset_name,
    COALESCE((SELECT asset_name FROM first_je), (SELECT asset_name FROM first_any)) AS first_je_asset_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_chapter_entry_assets(uuid) TO anon, authenticated;


-- Phase 3: dedicated student beta feedback table for AI helper responses.

CREATE TABLE public.student_helper_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text,
  asset_id uuid,
  chapter_id uuid,
  course_id uuid,
  tool_type text,
  action_type text NOT NULL,
  rating smallint NOT NULL CHECK (rating IN (-1, 1)),
  comment text,
  user_id uuid,
  session_id text,
  email text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_helper_feedback_action_created
  ON public.student_helper_feedback(action_type, created_at DESC);
CREATE INDEX idx_student_helper_feedback_asset
  ON public.student_helper_feedback(asset_id);
CREATE INDEX idx_student_helper_feedback_chapter
  ON public.student_helper_feedback(chapter_id);
CREATE INDEX idx_student_helper_feedback_cache_key
  ON public.student_helper_feedback(cache_key);

ALTER TABLE public.student_helper_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous landing-page visitors) can submit feedback.
CREATE POLICY "Anyone can submit helper feedback"
  ON public.student_helper_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Reads are admin/service-role only (no public SELECT policy).
-- Service role bypasses RLS by default; admin reads will go through service-role functions.