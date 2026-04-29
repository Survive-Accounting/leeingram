-- Remove test user data from beta dashboard tables.
-- Targets exactly three accounts: lee+test@survivestudios.com,
-- lee@surviveaccounting.com, lee@survivestudios.com.
-- Keeps real student beta signups intact.

WITH test_users AS (
  SELECT id, email FROM auth.users
  WHERE lower(email) IN (
    'lee+test@survivestudios.com',
    'lee@surviveaccounting.com',
    'lee@survivestudios.com'
  )
)
DELETE FROM public.student_onboarding
WHERE user_id IN (SELECT id FROM test_users)
   OR lower(email) IN (SELECT lower(email) FROM test_users);

DELETE FROM public.student_events
WHERE lower(email) IN (
  'lee+test@survivestudios.com',
  'lee@surviveaccounting.com',
  'lee@survivestudios.com'
);

DELETE FROM public.student_helper_feedback
WHERE lower(email) IN (
  'lee+test@survivestudios.com',
  'lee@surviveaccounting.com',
  'lee@survivestudios.com'
);

DELETE FROM public.student_emails
WHERE lower(email) IN (
  'lee+test@survivestudios.com',
  'lee@surviveaccounting.com',
  'lee@survivestudios.com'
);