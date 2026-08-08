begin;

set local search_path = extensions, public;

select extensions.plan(19);

select extensions.ok(
  (
    select string_agg(version::text, ',' order by version::text)
    from supabase_migrations.schema_migrations
  ) = '20260717000001,20260717000002,20260718000001,20260718000002,20260718000003,20260719000004,20260721000001,20260721000002,20260723021348,20260725063750,20260726000001,20260801000001,20260802000001,20260802000002,20260808000001',
  'all repository migrations are applied in order'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('profiles'),
        ('trusted_contacts'),
        ('activity_log'),
        ('tax_scenarios'),
        ('accounts'),
        ('categories'),
        ('transactions'),
        ('budgets'),
        ('holdings'),
        ('holding_events'),
        ('valuations'),
        ('goals'),
        ('fire_settings'),
        ('ai_usage'),
        ('ai_summaries'),
        ('deadman_settings'),
        ('escalation_events'),
        ('cron_runs'),
        ('sync_upload_transactions'),
        ('restore_runs')
    ) as expected(table_name)
    where to_regclass('public.' || expected.table_name) is null
  ),
  'all application tables exist'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('profiles_user_id_idx'),
        ('trusted_contacts_user_id_idx'),
        ('activity_log_user_id_idx'),
        ('activity_log_user_occurred_idx'),
        ('tax_scenarios_user_id_idx'),
        ('accounts_user_id_idx'),
        ('categories_user_id_idx'),
        ('categories_parent_id_idx'),
        ('categories_id_user_uidx'),
        ('transactions_user_id_idx'),
        ('transactions_account_id_idx'),
        ('transactions_category_id_idx'),
        ('transactions_user_occurred_idx'),
        ('budgets_user_id_idx'),
        ('budgets_category_id_idx'),
        ('holdings_user_id_idx'),
        ('holdings_account_id_idx'),
        ('holding_events_user_id_idx'),
        ('holding_events_holding_id_idx'),
        ('valuations_user_id_idx'),
        ('valuations_holding_id_idx'),
        ('goals_user_id_idx'),
        ('fire_settings_user_id_idx'),
        ('transactions_user_occurrence_key_uidx'),
        ('transactions_user_account_import_hash_uidx'),
        ('transactions_user_recurring_id_idx'),
        ('budgets_user_category_period_start_uidx'),
        ('accounts_id_user_uidx'),
        ('holdings_id_user_uidx'),
        ('holdings_user_type_idx'),
        ('holding_events_user_occurred_idx'),
        ('holding_events_holding_occurred_idx'),
        ('valuations_holding_as_of_idx'),
        ('holding_events_user_import_hash_uidx'),
        ('valuations_user_holding_as_of_uidx'),
        ('ai_usage_user_id_idx'),
        ('ai_summaries_user_id_idx'),
        ('ai_summaries_user_month_idx'),
        ('deadman_settings_user_id_idx'),
        ('escalation_events_user_created_idx'),
        ('cron_runs_job_ran_at_idx'),
        ('sync_upload_transactions_pkey'),
        ('restore_runs_pkey')
    ) as expected(index_name)
    where to_regclass('public.' || expected.index_name) is null
  ),
  'all required application indexes exist'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('profiles'),
        ('trusted_contacts'),
        ('activity_log'),
        ('tax_scenarios'),
        ('accounts'),
        ('categories'),
        ('transactions'),
        ('budgets'),
        ('holdings'),
        ('holding_events'),
        ('valuations'),
        ('goals'),
        ('fire_settings'),
        ('ai_usage'),
        ('ai_summaries'),
        ('deadman_settings'),
        ('escalation_events'),
        ('cron_runs'),
        ('sync_upload_transactions'),
        ('restore_runs')
    ) as expected(table_name)
    where not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = expected.table_name
        and c.relrowsecurity
    )
  ),
  'RLS is enabled on every application table'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('profiles', 'profiles are private'),
        ('trusted_contacts', 'trusted_contacts are private'),
        ('activity_log', 'activity_log is private'),
        ('tax_scenarios', 'tax_scenarios are private'),
        ('accounts', 'accounts are private'),
        ('categories', 'categories are private'),
        ('transactions', 'transactions are private'),
        ('budgets', 'budgets are private'),
        ('holdings', 'holdings are private'),
        ('holding_events', 'holding_events are private'),
        ('valuations', 'valuations are private'),
        ('goals', 'goals are private'),
        ('fire_settings', 'fire_settings are private'),
        ('ai_usage', 'users can read their own ai usage'),
        ('ai_summaries', 'ai summaries are private'),
        ('deadman_settings', 'deadman settings are private'),
        ('escalation_events', 'escalation events are readable by their owner'),
        ('sync_upload_transactions', 'sync upload transactions are private'),
        ('restore_runs', 'restore runs are private')
    ) as expected(table_name, policy_name)
    where not exists (
      select 1
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = expected.table_name
        and p.polname = expected.policy_name
    )
  ),
  'required authenticated/service policies exist'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values
        ('public', 'profiles', 'profiles_set_updated_at'),
        ('auth', 'users', 'on_auth_user_created'),
        ('public', 'trusted_contacts', 'trusted_contacts_set_updated_at'),
        ('public', 'activity_log', 'activity_log_set_updated_at'),
        ('public', 'tax_scenarios', 'tax_scenarios_set_updated_at'),
        ('public', 'accounts', 'accounts_set_updated_at'),
        ('public', 'categories', 'categories_set_updated_at'),
        ('public', 'transactions', 'transactions_set_updated_at'),
        ('public', 'budgets', 'budgets_set_updated_at'),
        ('public', 'holdings', 'holdings_set_updated_at'),
        ('public', 'holding_events', 'holding_events_set_updated_at'),
        ('public', 'valuations', 'valuations_set_updated_at'),
        ('public', 'goals', 'goals_set_updated_at'),
        ('public', 'fire_settings', 'fire_settings_set_updated_at'),
        ('public', 'ai_usage', 'ai_usage_set_updated_at'),
        ('public', 'deadman_settings', 'deadman_settings_set_updated_at')
    ) as expected(table_schema, table_name, trigger_name)
    where not exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = expected.table_schema
        and c.relname = expected.table_name
        and t.tgname = expected.trigger_name
        and not t.tgisinternal
    )
  ),
  'required application triggers exist'
);

select extensions.ok(
  not exists (
    select 1
    from (
      values ('set_updated_at'), ('handle_new_user')
    ) as expected(function_name)
    where not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = expected.function_name
        and p.pronargs = 0
    )
  ),
  'trigger helper functions exist'
);

select extensions.has_function(
  'public',
  'record_ai_usage',
  array['uuid', 'text', 'bigint', 'bigint', 'bigint', 'bigint', 'boolean'],
  'the AI usage accounting function exists'
);

select extensions.has_function(
  'public',
  'apply_sync_transaction',
  array['text', 'bigint', 'text', 'jsonb'],
  'the sync transaction function exists'
);

select extensions.has_function(
  'public',
  'apply_data_restore',
  array['text', 'text', 'text', 'jsonb'],
  'the restore function exists'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '30000000-0000-4000-8000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'fresh-migration@example.invalid',
  '',
  now(),
  '{}'::jsonb,
  '{"full_name":"Fresh Migration User"}'::jsonb,
  now(),
  now()
);

select extensions.is(
  (select count(*) from public.profiles where user_id = '30000000-0000-4000-8000-000000000003'),
  1::bigint,
  'auth signup creates the required profile'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

insert into public.accounts (
  id,
  user_id,
  name,
  type,
  currency,
  current_balance
)
values (
  '40000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000003',
  'Fresh migration account',
  'bank',
  'INR',
  1250
);

select extensions.is(
  (select count(*) from public.accounts where id = '40000000-0000-4000-8000-000000000004'),
  1::bigint,
  'an authenticated user can create an account'
);

select extensions.is(
  (select name from public.accounts where id = '40000000-0000-4000-8000-000000000004'),
  'Fresh migration account',
  'an authenticated user can read their account'
);

update public.accounts
set name = 'Updated migration account', current_balance = 1500
where id = '40000000-0000-4000-8000-000000000004';

select extensions.is(
  (select current_balance from public.accounts where id = '40000000-0000-4000-8000-000000000004'),
  1500::double precision,
  'an authenticated user can update their account'
);

insert into public.transactions (
  id,
  user_id,
  account_id,
  amount,
  direction,
  occurred_on,
  note
)
values (
  '50000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  250,
  'debit',
  '2026-08-08',
  'Fresh migration transaction'
);

select extensions.is(
  (select count(*) from public.transactions where id = '50000000-0000-4000-8000-000000000005'),
  1::bigint,
  'an authenticated user can create a transaction'
);

select extensions.is(
  (select note from public.transactions where id = '50000000-0000-4000-8000-000000000005'),
  'Fresh migration transaction',
  'an authenticated user can read their transaction'
);

update public.transactions
set note = 'Updated migration transaction'
where id = '50000000-0000-4000-8000-000000000005';

select extensions.is(
  (select note from public.transactions where id = '50000000-0000-4000-8000-000000000005'),
  'Updated migration transaction',
  'an authenticated user can update their transaction'
);

delete from public.transactions
where id = '50000000-0000-4000-8000-000000000005';

select extensions.is(
  (select count(*) from public.transactions where id = '50000000-0000-4000-8000-000000000005'),
  0::bigint,
  'an authenticated user can delete their transaction'
);

delete from public.accounts
where id = '40000000-0000-4000-8000-000000000004';

select extensions.is(
  (select count(*) from public.accounts where id = '40000000-0000-4000-8000-000000000004'),
  0::bigint,
  'an authenticated user can delete their account'
);

select * from extensions.finish();
rollback;
