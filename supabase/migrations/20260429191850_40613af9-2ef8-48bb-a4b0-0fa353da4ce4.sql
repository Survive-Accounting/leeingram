
-- Templates
CREATE TABLE public.beta_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  preheader text,
  html_body text NOT NULL,
  text_body text,
  from_name text NOT NULL DEFAULT 'Survive Accounting',
  from_email text NOT NULL DEFAULT 'lee@mail.surviveaccounting.com',
  reply_to text NOT NULL DEFAULT 'lee@surviveaccounting.com',
  enabled boolean NOT NULL DEFAULT false,
  is_managed boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid
);

ALTER TABLE public.beta_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lee can view beta email templates"
  ON public.beta_email_templates FOR SELECT
  USING (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'));

CREATE POLICY "Lee can insert beta email templates"
  ON public.beta_email_templates FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'));

CREATE POLICY "Lee can update beta email templates"
  ON public.beta_email_templates FOR UPDATE
  USING (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'));

CREATE TRIGGER update_beta_email_templates_updated_at
  BEFORE UPDATE ON public.beta_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sends log
CREATE TABLE public.beta_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug text NOT NULL,
  recipient_email text NOT NULL,
  student_id uuid,
  subject text,
  status text NOT NULL CHECK (status IN ('queued','sent','failed','skipped')),
  is_test boolean NOT NULL DEFAULT false,
  resend_id text,
  error text,
  triggered_by text NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual','cron','system')),
  sent_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_beta_email_sends_slug ON public.beta_email_sends (template_slug, created_at DESC);
CREATE INDEX idx_beta_email_sends_recipient ON public.beta_email_sends (recipient_email);
CREATE UNIQUE INDEX uniq_beta_email_sends_real_sent
  ON public.beta_email_sends (template_slug, lower(recipient_email))
  WHERE is_test = false AND status = 'sent';

ALTER TABLE public.beta_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lee can view beta email sends"
  ON public.beta_email_sends FOR SELECT
  USING (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'));

-- Schedule (Phase 2 config)
CREATE TABLE public.beta_email_schedule (
  template_slug text PRIMARY KEY REFERENCES public.beta_email_templates(slug) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'manual_only'
    CHECK (trigger_type IN ('manual_only','days_after_signup','days_after_inactive')),
  trigger_value int,
  enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_email_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lee can view beta email schedule"
  ON public.beta_email_schedule FOR SELECT
  USING (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'));

CREATE POLICY "Lee can upsert beta email schedule"
  ON public.beta_email_schedule FOR ALL
  USING (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('lee@survivestudios.com','lee@surviveaccounting.com'));

-- Seed the 6 templates
INSERT INTO public.beta_email_templates (slug, name, description, subject, preheader, html_body, text_body, is_managed, sort_order, enabled) VALUES
('magic_link', 'Signup / Magic Link',
 'Login link sent by resend-login-link. Preview only — actual send happens in resend-login-link.',
 'Your Survive Accounting login link',
 'One-click access to learn.surviveaccounting.com',
 '<p>Hey {{first_name}},</p><p>Click the link below to log in. It expires in 15 minutes and only works on this device.</p><p><a href="{{magic_link_url}}" style="background:#14213D;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Log in to Survive Accounting</a></p><p>— Lee</p>',
 'Hey {{first_name}}, log in here: {{magic_link_url}} (expires in 15 minutes, this device only). — Lee',
 true, 1, true),

('welcome_day0', 'Day 0 — Welcome',
 'Sent right after a beta signup. Sets expectations and points to the dashboard.',
 'Welcome to the Survive Accounting beta',
 'You''re in. Here''s how to get the most out of it.',
 '<p>Hey {{first_name}},</p><p>You''re in the Spring ''26 beta — beta #{{beta_number}}.</p><p>Open your dashboard and pick the chapter you have an exam on next:</p><p><a href="{{dashboard_url}}" style="background:#CE1126;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open my dashboard</a></p><p>Reply to this email if anything looks broken or confusing — I read every reply.</p><p>— Lee</p>',
 'Welcome, {{first_name}} — you''re beta #{{beta_number}}. Open your dashboard: {{dashboard_url}}. Reply if anything is broken. — Lee',
 false, 2, false),

('study_tips_day2', 'Day 2 — How to study with the beta',
 'Tactical guide on the best way to use the helpers and walk-throughs.',
 'The fastest way to use Survive Accounting',
 'Walk Me Through It → Full Solution → flashcards.',
 '<p>Hey {{first_name}},</p><p>Quick playbook for the week:</p><ol><li>Pick one chapter from your dashboard.</li><li>On a problem, hit <b>Walk Me Through It</b> first — don''t jump to the full solution.</li><li>When you''re stuck, use <b>Full Solution</b>, then redo it on paper.</li><li>End each session with the chapter''s flashcards.</li></ol><p><a href="{{dashboard_url}}" style="background:#14213D;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Back to my dashboard</a></p><p>— Lee</p>',
 'Playbook: pick a chapter, use Walk Me Through It first, then Full Solution, then flashcards. {{dashboard_url}} — Lee',
 false, 3, false),

('feedback_day4', 'Day 4 — Feedback request',
 'Asks beta users what''s working and what''s not after they''ve had time to use the tool.',
 'How''s the beta going, {{first_name}}?',
 'One reply helps me fix the next thing.',
 '<p>Hey {{first_name}},</p><p>You''ve been in the beta a few days. I''d love to know:</p><ul><li>What''s the most useful thing so far?</li><li>What''s confusing or broken?</li><li>One thing you wish it did?</li></ul><p>Just hit reply. Even one sentence helps.</p><p>— Lee</p>',
 'How''s the beta, {{first_name}}? Reply with: most useful thing, what''s broken, one wish. — Lee',
 false, 4, false),

('inactive_reminder', 'Inactive — Never used the tool',
 'For users who signed up but never opened the dashboard or a helper.',
 'Did you forget about Survive Accounting?',
 '60 seconds to get unstuck on your next exam.',
 '<p>Hey {{first_name}},</p><p>You signed up for the beta but I don''t see you in there yet. No pressure — but if you have an exam coming up, this is the fastest way to drill the chapter you''re weakest on.</p><p><a href="{{dashboard_url}}" style="background:#CE1126;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Take a look</a></p><p>If something blocked you from logging in, reply and tell me what happened.</p><p>— Lee</p>',
 'Hey {{first_name}}, you signed up but haven''t used it. Try it: {{dashboard_url}}. If login broke, reply. — Lee',
 false, 5, false),

('finals_close', 'Finals are close',
 'Late-semester nudge with a share-with-a-friend ask.',
 'Finals are close — start with this chapter',
 'And tell one friend who''s drowning.',
 '<p>Hey {{first_name}},</p><p>Finals are coming. Two asks:</p><ol><li>Open your dashboard and pick the chapter you''re most worried about. <a href="{{dashboard_url}}">{{dashboard_url}}</a></li><li>If a classmate is drowning, send them this link — it''s free during the beta: <a href="https://learn.surviveaccounting.com">learn.surviveaccounting.com</a></li></ol><p>— Lee</p>',
 'Finals are close. Open dashboard: {{dashboard_url}}. Share with a friend: learn.surviveaccounting.com. — Lee',
 false, 6, false);

-- Seed schedule rows (all manual_only initially)
INSERT INTO public.beta_email_schedule (template_slug, trigger_type, trigger_value, enabled) VALUES
('magic_link', 'manual_only', NULL, true),
('welcome_day0', 'days_after_signup', 0, false),
('study_tips_day2', 'days_after_signup', 2, false),
('feedback_day4', 'days_after_signup', 4, false),
('inactive_reminder', 'days_after_inactive', 3, false),
('finals_close', 'manual_only', NULL, false);
