ALTER TABLE chapter_accounts
ADD COLUMN debit_tooltip text,
ADD COLUMN credit_tooltip text,
ADD COLUMN balance_tooltip text,
ADD COLUMN contra_tooltip text,
ADD COLUMN fs_placement_tooltip text,
ADD COLUMN example_beginning_balance numeric,
ADD COLUMN example_debit_amount numeric,
ADD COLUMN example_credit_amount numeric,
ADD COLUMN example_ending_balance numeric,
ADD COLUMN example_date_label text;