
CREATE TABLE public.variant_generation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  teaching_tone JSONB NOT NULL DEFAULT '["Neutral but memorable","Mix of playful and professional","No Ole Miss references","No campus-specific language","No fluff or storytelling filler"]'::jsonb,
  exam_realism JSONB NOT NULL DEFAULT '["All generated problems must be exam-style","No bolded numbers","Round all calculations to whole dollars","Use short, concise sentences","No instructional hints embedded in problem text"]'::jsonb,
  variants_per_request INTEGER NOT NULL DEFAULT 3,
  require_different_values BOOLEAN NOT NULL DEFAULT true,
  require_different_company BOOLEAN NOT NULL DEFAULT true,
  require_different_scenario BOOLEAN NOT NULL DEFAULT true,
  je_answer_only BOOLEAN NOT NULL DEFAULT true,
  je_fully_worked BOOLEAN NOT NULL DEFAULT true,
  je_google_sheets_format BOOLEAN NOT NULL DEFAULT true,
  je_canva_export BOOLEAN NOT NULL DEFAULT true,
  default_difficulty TEXT NOT NULL DEFAULT 'standard',
  tricky_partial_period BOOLEAN NOT NULL DEFAULT false,
  tricky_missing_info BOOLEAN NOT NULL DEFAULT false,
  tricky_sign_reversal BOOLEAN NOT NULL DEFAULT false,
  tricky_multi_step_decoy BOOLEAN NOT NULL DEFAULT false,
  tricky_numerical_decoys BOOLEAN NOT NULL DEFAULT false,
  tricky_je_direction_trap BOOLEAN NOT NULL DEFAULT false,
  store_solution_internally BOOLEAN NOT NULL DEFAULT true,
  video_linked_explanation BOOLEAN NOT NULL DEFAULT true,
  no_written_explanation BOOLEAN NOT NULL DEFAULT true,
  use_company_names BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.variant_generation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.variant_generation_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.variant_generation_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.variant_generation_settings FOR UPDATE USING (auth.uid() = user_id);
