begin;

set local search_path = extensions, public;

select extensions.plan(33);

select extensions.has_index(
  'public',
  'categories',
  'categories_id_user_uidx',
  'categories have a composite key for same-owner references'
);

select extensions.is(
  (
    select count(*)
    from pg_constraint
    where conname in (
      'categories_parent_same_user_fk',
      'transactions_account_same_user_fk',
      'transactions_category_same_user_fk',
      'budgets_category_same_user_fk'
    )
  ),
  4::bigint,
  'direct child references enforce same-owner foreign keys'
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
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tenant-one@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Tenant One"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tenant-two@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Tenant Two"}'::jsonb,
    now(),
    now()
  );

insert into public.accounts (id, user_id, name, type, current_balance)
values
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'A account', 'bank', 1000),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'B account', 'bank', 2000);

insert into public.categories (id, user_id, name, kind)
values
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'A category', 'expense'),
  ('60000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 'B category', 'expense');

insert into public.transactions (
  id, user_id, account_id, category_id, amount, direction, occurred_on
)
values
  (
    '70000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000005',
    10,
    'debit',
    '2026-08-01'
  ),
  (
    '80000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000006',
    20,
    'debit',
    '2026-08-01'
  );

insert into public.budgets (id, user_id, category_id, period_start, amount)
values
  (
    '90000000-0000-4000-8000-000000000009',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000005',
    '2026-08-01',
    100
  ),
  (
    'a0000000-0000-4000-8000-00000000000a',
    '20000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000006',
    '2026-08-01',
    200
  );

insert into public.holdings (id, user_id, name, type, account_id, quantity)
values
  (
    'b0000000-0000-4000-8000-00000000000b',
    '10000000-0000-4000-8000-000000000001',
    'A holding',
    'stock',
    '30000000-0000-4000-8000-000000000003',
    1
  ),
  (
    'c0000000-0000-4000-8000-00000000000c',
    '20000000-0000-4000-8000-000000000002',
    'B holding',
    'stock',
    '40000000-0000-4000-8000-000000000004',
    1
  );

insert into public.holding_events (
  id, user_id, holding_id, kind, occurred_on, amount
)
values
  (
    'd0000000-0000-4000-8000-00000000000d',
    '10000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-00000000000b',
    'buy',
    '2026-08-01',
    -100
  ),
  (
    'e0000000-0000-4000-8000-00000000000e',
    '20000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-00000000000c',
    'buy',
    '2026-08-01',
    -200
  );

insert into public.valuations (id, user_id, holding_id, as_of, value)
values
  (
    'f0000000-0000-4000-8000-00000000000f',
    '10000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-00000000000b',
    '2026-08-01',
    110
  ),
  (
    '11000000-0000-4000-8000-000000000011',
    '20000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-00000000000c',
    '2026-08-01',
    210
  );

insert into public.goals (id, user_id, name, kind, target_amount)
values
  ('12000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 'A goal', 'custom', 1000),
  ('13000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000002', 'B goal', 'custom', 2000);

insert into public.fire_settings (id, user_id)
values
  ('14000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.is((select count(*) from public.accounts where id = '40000000-0000-4000-8000-000000000004'), 0::bigint, 'User A cannot read User B accounts');
select extensions.is((select count(*) from public.categories where id = '60000000-0000-4000-8000-000000000006'), 0::bigint, 'User A cannot read User B categories');
select extensions.is((select count(*) from public.transactions where id = '80000000-0000-4000-8000-000000000008'), 0::bigint, 'User A cannot read User B transactions');
select extensions.is((select count(*) from public.budgets where id = 'a0000000-0000-4000-8000-00000000000a'), 0::bigint, 'User A cannot read User B budgets');
select extensions.is((select count(*) from public.holdings where id = 'c0000000-0000-4000-8000-00000000000c'), 0::bigint, 'User A cannot read User B holdings');
select extensions.is((select count(*) from public.goals where id = '13000000-0000-4000-8000-000000000013'), 0::bigint, 'User A cannot read User B goals');
select extensions.is((select count(*) from public.profiles where user_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B profiles');
select extensions.is((select count(*) from public.fire_settings where user_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'User A cannot read User B private settings');

update public.accounts set name = 'A changed B account'
where id = '40000000-0000-4000-8000-000000000004';
delete from public.transactions
where id = '80000000-0000-4000-8000-000000000008';
update public.goals set name = 'A changed B goal'
where id = '13000000-0000-4000-8000-000000000013';
delete from public.holdings
where id = 'c0000000-0000-4000-8000-00000000000c';

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select extensions.is((select count(*) from public.accounts where id = '30000000-0000-4000-8000-000000000003'), 0::bigint, 'User B cannot read User A accounts');
select extensions.is((select count(*) from public.categories where id = '50000000-0000-4000-8000-000000000005'), 0::bigint, 'User B cannot read User A categories');
select extensions.is((select count(*) from public.transactions where id = '70000000-0000-4000-8000-000000000007'), 0::bigint, 'User B cannot read User A transactions');
select extensions.is((select count(*) from public.budgets where id = '90000000-0000-4000-8000-000000000009'), 0::bigint, 'User B cannot read User A budgets');
select extensions.is((select count(*) from public.holdings where id = 'b0000000-0000-4000-8000-00000000000b'), 0::bigint, 'User B cannot read User A holdings');
select extensions.is((select count(*) from public.goals where id = '12000000-0000-4000-8000-000000000012'), 0::bigint, 'User B cannot read User A goals');
select extensions.is((select count(*) from public.profiles where user_id = '10000000-0000-4000-8000-000000000001'), 0::bigint, 'User B cannot read User A profiles');
select extensions.is((select count(*) from public.fire_settings where user_id = '10000000-0000-4000-8000-000000000001'), 0::bigint, 'User B cannot read User A private settings');

select extensions.is((select name from public.accounts where id = '40000000-0000-4000-8000-000000000004'), 'B account', 'User A cannot update User B accounts');
select extensions.is((select count(*) from public.transactions where id = '80000000-0000-4000-8000-000000000008'), 1::bigint, 'User A cannot delete User B transactions');
select extensions.is((select name from public.goals where id = '13000000-0000-4000-8000-000000000013'), 'B goal', 'User A cannot update User B goals');
select extensions.is((select count(*) from public.holdings where id = 'c0000000-0000-4000-8000-00000000000c'), 1::bigint, 'User A cannot delete User B holdings');

update public.accounts set name = 'B changed A account'
where id = '30000000-0000-4000-8000-000000000003';
delete from public.transactions
where id = '70000000-0000-4000-8000-000000000007';
update public.goals set name = 'B changed A goal'
where id = '12000000-0000-4000-8000-000000000012';
delete from public.holdings
where id = 'b0000000-0000-4000-8000-00000000000b';

reset role;

select extensions.is((select name from public.accounts where id = '30000000-0000-4000-8000-000000000003'), 'A account', 'User B cannot update User A accounts');
select extensions.is((select count(*) from public.transactions where id = '70000000-0000-4000-8000-000000000007'), 1::bigint, 'User B cannot delete User A transactions');
select extensions.is((select name from public.goals where id = '12000000-0000-4000-8000-000000000012'), 'A goal', 'User B cannot update User A goals');
select extensions.is((select count(*) from public.holdings where id = 'b0000000-0000-4000-8000-00000000000b'), 1::bigint, 'User B cannot delete User A holdings');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.throws_ok(
  $sql$
    insert into public.categories (id, user_id, name, kind, parent_id)
    values ('16000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', 'cross-owner child', 'expense', '60000000-0000-4000-8000-000000000006')
  $sql$,
  '23503', null,
  'User A cannot create a category under User B parent'
);

select extensions.throws_ok(
  $sql$
    insert into public.transactions (id, user_id, account_id, amount, direction, occurred_on)
    values ('17000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 1, 'debit', '2026-08-01')
  $sql$,
  '23503', null,
  'User A cannot create a transaction under User B account'
);

select extensions.throws_ok(
  $sql$
    insert into public.transactions (id, user_id, category_id, amount, direction, occurred_on)
    values ('18000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000006', 1, 'debit', '2026-08-01')
  $sql$,
  '23503', null,
  'User A cannot create a transaction under User B category'
);

select extensions.throws_ok(
  $sql$
    insert into public.budgets (id, user_id, category_id, period_start, amount)
    values ('19000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000006', '2026-08-01', 1)
  $sql$,
  '23503', null,
  'User A cannot create a budget under User B category'
);

select extensions.throws_ok(
  $sql$
    insert into public.holdings (id, user_id, name, type, account_id)
    values ('1a000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-000000000001', 'cross-owner holding', 'stock', '40000000-0000-4000-8000-000000000004')
  $sql$,
  '23503', null,
  'User A cannot create a holding under User B account'
);

select extensions.throws_ok(
  $sql$
    insert into public.holding_events (id, user_id, holding_id, kind, occurred_on, amount)
    values ('1b000000-0000-4000-8000-00000000001b', '10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000c', 'buy', '2026-08-01', -1)
  $sql$,
  '23503', null,
  'User A cannot create a holding event under User B holding'
);

select extensions.throws_ok(
  $sql$
    insert into public.valuations (id, user_id, holding_id, as_of, value)
    values ('1c000000-0000-4000-8000-00000000001c', '10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000c', '2026-08-01', 1)
  $sql$,
  '23503', null,
  'User A cannot create a valuation under User B holding'
);

reset role;
select * from extensions.finish();
rollback;
