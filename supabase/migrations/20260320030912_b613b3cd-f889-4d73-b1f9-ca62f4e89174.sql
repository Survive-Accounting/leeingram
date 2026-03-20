
DELETE FROM va_assignments WHERE va_account_id IN (
  SELECT id FROM va_accounts WHERE full_name IN ('Djhoannes', 'Lee Tester')
);
DELETE FROM va_accounts WHERE full_name IN ('Djhoannes', 'Lee Tester');
