-- FinManager V2 - Phase 4: expense recurrence, CSV mapping, and invariants.
-- Existing per-user RLS policies remain unchanged; only columns, checks, and
-- lookup/uniqueness indexes are added to the Phase 3 tables.

alter table public.profiles
  add column if not exists csv_mappings jsonb not null default '{}'::jsonb;

alter table public.transactions
  add column if not exists recurrence_frequency text,
  add column if not exists recurrence_interval integer not null default 1,
  add column if not exists recurrence_end_on date,
  add column if not exists recurrence_generated_through date,
  add column if not exists occurrence_key text;

alter table public.transactions
  add constraint transactions_positive_amount_ck check (amount > 0),
  add constraint transactions_direction_ck check (direction in ('debit', 'credit')),
  add constraint transactions_recurrence_frequency_ck check (
    recurrence_frequency is null or recurrence_frequency in ('daily', 'weekly', 'monthly', 'yearly')
  ),
  add constraint transactions_recurrence_interval_ck check (recurrence_interval > 0);

alter table public.budgets
  add constraint budgets_positive_amount_ck check (amount > 0);

create unique index if not exists transactions_user_occurrence_key_uidx
  on public.transactions (user_id, occurrence_key)
  where occurrence_key is not null;

create unique index if not exists transactions_user_account_import_hash_uidx
  on public.transactions (user_id, account_id, import_hash)
  where import_hash is not null;

create index if not exists transactions_user_recurring_id_idx
  on public.transactions (user_id, recurring_id);

create unique index if not exists budgets_user_category_period_start_uidx
  on public.budgets (user_id, category_id, period, period_start);
