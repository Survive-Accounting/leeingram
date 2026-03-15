
CREATE TABLE generation_debug_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  teaching_asset_id uuid NOT NULL REFERENCES teaching_assets(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  error_field text NOT NULL,
  error_type text NOT NULL,
  ai_output_raw text,
  correct_answer text,
  admin_note text NOT NULL,
  generation_prompt text,
  activity_log_run_id uuid,
  activity_log_snapshot jsonb DEFAULT '[]'::jsonb,
  annotated_by text,
  debug_session_id uuid,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolution_note text
);

CREATE INDEX ON generation_debug_notes(teaching_asset_id);
CREATE INDEX ON generation_debug_notes(chapter_id);
CREATE INDEX ON generation_debug_notes(debug_session_id);
CREATE INDEX ON generation_debug_notes(error_field);
CREATE INDEX ON generation_debug_notes(error_type);

ALTER TABLE teaching_assets
  ADD COLUMN IF NOT EXISTS debug_session_id uuid,
  ADD COLUMN IF NOT EXISTS debug_annotated_at timestamptz;

ALTER TABLE generation_debug_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access"
  ON generation_debug_notes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
