
-- ── Beta-launch student feedback tables ─────────────────────────────────
-- Two purpose-built tables for the Practice Problem Helper beta:
--  1) study_tool_response_feedback — thumbs + optional text on a specific
--     generated helper response.
--  2) study_tool_idea_feedback     — votes/suggestions on which beta tools
--     students want, for the "Try new beta tools" lab area.
-- Both accept anonymous inserts (beta phase, not all students authed yet)
-- but lock down read access to admins.

-- ── 1. Response-level feedback ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_tool_response_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  user_id             uuid,
  session_id          text,
  anonymous_id        text,
  course_id           uuid,
  chapter_id          uuid,
  asset_id            uuid,
  problem_id          text,
  tool_type           text NOT NULL,                -- e.g. 'survive_this'
  action_type         text NOT NULL,                -- e.g. 'walk_through'
  response_cache_key  text,
  response_cache_id   uuid,
  rating              text NOT NULL CHECK (rating IN ('up','down','neutral')),
  feedback_text       text,
  page_url            text,
  user_agent          text,
  metadata            jsonb,
  -- Length guardrails (defense in depth — frontend also trims)
  CONSTRAINT study_tool_response_feedback_text_len
    CHECK (feedback_text IS NULL OR char_length(feedback_text) <= 2000),
  CONSTRAINT study_tool_response_feedback_action_len
    CHECK (char_length(action_type) <= 64),
  CONSTRAINT study_tool_response_feedback_tool_len
    CHECK (char_length(tool_type) <= 64)
);

CREATE INDEX IF NOT EXISTS idx_strf_created_at  ON public.study_tool_response_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strf_asset       ON public.study_tool_response_feedback (asset_id);
CREATE INDEX IF NOT EXISTS idx_strf_chapter     ON public.study_tool_response_feedback (chapter_id);
CREATE INDEX IF NOT EXISTS idx_strf_action_type ON public.study_tool_response_feedback (action_type);
CREATE INDEX IF NOT EXISTS idx_strf_rating      ON public.study_tool_response_feedback (rating);

ALTER TABLE public.study_tool_response_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous beta users) can submit feedback. No read access.
CREATE POLICY "Anyone can insert response feedback"
  ON public.study_tool_response_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admin email whitelist mirrors the rest of the project — admins can read.
CREATE POLICY "Admins can read response feedback"
  ON public.study_tool_response_feedback
  FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('lee@surviveaccounting.com','admin@surviveaccounting.com')
  );


-- ── 2. Idea / new-tool feedback ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_tool_idea_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  user_id           uuid,
  session_id        text,
  anonymous_id      text,
  idea_key          text,
  idea_label        text,
  vote              text CHECK (vote IS NULL OR vote IN ('up','down','want','not_for_me')),
  suggestion_text   text,
  course_id         uuid,
  chapter_id        uuid,
  page_url          text,
  metadata          jsonb,
  CONSTRAINT study_tool_idea_feedback_text_len
    CHECK (suggestion_text IS NULL OR char_length(suggestion_text) <= 2000),
  CONSTRAINT study_tool_idea_feedback_idea_key_len
    CHECK (idea_key IS NULL OR char_length(idea_key) <= 64),
  CONSTRAINT study_tool_idea_feedback_idea_label_len
    CHECK (idea_label IS NULL OR char_length(idea_label) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_stif_created_at ON public.study_tool_idea_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stif_idea_key   ON public.study_tool_idea_feedback (idea_key);
CREATE INDEX IF NOT EXISTS idx_stif_chapter    ON public.study_tool_idea_feedback (chapter_id);

ALTER TABLE public.study_tool_idea_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert idea feedback"
  ON public.study_tool_idea_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read idea feedback"
  ON public.study_tool_idea_feedback
  FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('lee@surviveaccounting.com','admin@surviveaccounting.com')
  );
