begin;

set local search_path = extensions, public;

select extensions.plan(11);

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
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'default-categories-one@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"User One"}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'default-categories-two@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"User Two"}'::jsonb,
    now(),
    now()
  );

select extensions.is(
  (select count(*) from public.profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'signup creates the first user profile'
);

select extensions.is(
  (select count(*) from public.profiles where user_id = '20000000-0000-0000-0000-000000000002'),
  1::bigint,
  'signup creates the second user profile'
);

select extensions.is(
  (select count(*) from public.categories where user_id = '10000000-0000-0000-0000-000000000001'),
  21::bigint,
  'the first user receives exactly 21 categories'
);

select extensions.is(
  (select count(*) from public.categories where user_id = '20000000-0000-0000-0000-000000000002'),
  21::bigint,
  'the second user receives an independent set of 21 categories'
);

select extensions.is(
  (
    select count(distinct (name, kind))
    from public.categories
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  21::bigint,
  'the first user has no duplicate defaults'
);

update public.categories
set name = 'Household Groceries'
where user_id = '10000000-0000-0000-0000-000000000001'
  and name = 'Groceries'
  and kind = 'expense';

delete from public.categories
where user_id = '10000000-0000-0000-0000-000000000001'
  and name = 'Entertainment'
  and kind = 'expense';

select extensions.is(
  (
    select count(*)
    from public.categories
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  20::bigint,
  'a user can delete one of their initial categories'
);

select extensions.ok(
  exists (
    select 1
    from public.categories
    where user_id = '10000000-0000-0000-0000-000000000001'
      and name = 'Household Groceries'
      and kind = 'expense'
  ),
  'a user can rename one of their initial categories'
);

select extensions.ok(
  not exists (
    select 1
    from public.categories
    where user_id = '10000000-0000-0000-0000-000000000001'
      and name = 'Groceries'
      and kind = 'expense'
  ),
  'renaming does not recreate the original category'
);

select extensions.is(
  (
    select count(*)
    from public.categories
    where user_id = '20000000-0000-0000-0000-000000000002'
  ),
  21::bigint,
  'the second user is unaffected by the first user changes'
);

select extensions.ok(
  exists (
    select 1
    from public.categories
    where user_id = '20000000-0000-0000-0000-000000000002'
      and name = 'Groceries'
      and kind = 'expense'
  )
  and exists (
    select 1
    from public.categories
    where user_id = '20000000-0000-0000-0000-000000000002'
      and name = 'Entertainment'
      and kind = 'expense'
  ),
  'the second user retains their original categories'
);

select extensions.is(
  (select count(*) from public.categories where user_id in (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  )),
  41::bigint,
  'user category rows remain independently owned after customization'
);

select * from extensions.finish();
rollback;
