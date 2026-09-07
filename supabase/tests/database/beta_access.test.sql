begin;

set local search_path = extensions, public;

select extensions.plan(22);

select extensions.has_function(
  'public',
  'request_beta_access',
  array['text'],
  'the anonymous private-beta request RPC exists'
);

select extensions.has_function(
  'public',
  'hook_before_user_created',
  array['jsonb'],
  'the Before User Created hook function exists'
);

insert into public.beta_access (email, status, access_kind)
values
  ('approved@example.invalid', 'approved', 'beta'),
  ('complimentary@example.invalid', 'approved', 'complimentary'),
  ('requested@example.invalid', 'requested', 'beta'),
  ('revoked@example.invalid', 'revoked', 'beta'),
  ('duplicate@example.invalid', 'requested', 'beta');

select extensions.is(
  public.hook_before_user_created(
    jsonb_build_object('user', jsonb_build_object('email', 'APPROVED@EXAMPLE.INVALID'))
  ),
  '{}'::jsonb,
  'approval is case-insensitive and allows an approved beta email'
);

select extensions.is(
  public.hook_before_user_created(
    jsonb_build_object('user', jsonb_build_object('email', 'COMPLIMENTARY@EXAMPLE.INVALID'))
  ),
  '{}'::jsonb,
  'complimentary approval allows a signup'
);

select extensions.is(
  public.hook_before_user_created(
    jsonb_build_object('user', jsonb_build_object('email', 'requested@example.invalid'))
  )->'error'->>'message',
  'FinManager is currently in a private beta. Request access first, then try again after approval.',
  'requested access is denied with friendly private-beta copy'
);

select extensions.is(
  public.hook_before_user_created(
    jsonb_build_object('user', jsonb_build_object('email', 'revoked@example.invalid'))
  )->'error'->>'message',
  'FinManager is currently in a private beta. Request access first, then try again after approval.',
  'revoked access is denied with the same non-enumerating copy'
);

select extensions.is(
  public.hook_before_user_created(
    jsonb_build_object('user', jsonb_build_object('email', 'unlisted@example.invalid'))
  )->'error'->>'message',
  'FinManager is currently in a private beta. Request access first, then try again after approval.',
  'unlisted access is denied with the same non-enumerating copy'
);

set local role anon;

select extensions.is(
  public.request_beta_access('APPROVED@EXAMPLE.INVALID'),
  '{"ok":true}'::jsonb,
  'an approved email receives the generic request result'
);

select extensions.is(
  public.request_beta_access('unlisted@example.invalid'),
  '{"ok":true}'::jsonb,
  'an unlisted email receives the identical generic request result'
);

select extensions.is(
  public.request_beta_access('DUPLICATE@EXAMPLE.INVALID'),
  '{"ok":true}'::jsonb,
  'the first duplicate request is accepted'
);

select extensions.is(
  public.request_beta_access(' duplicate@example.invalid '),
  '{"ok":true}'::jsonb,
  'a duplicate request is idempotent after normalization'
);

select extensions.throws_ok(
  $sql$select public.request_beta_access('not-an-email')$sql$,
  '22023',
  null,
  'the anonymous RPC validates email format without exposing table state'
);

reset role;

select extensions.is(
  (select count(*) from public.beta_access where email = 'duplicate@example.invalid'),
  1::bigint,
  'duplicate requests do not create duplicate rows'
);

reset role;

select extensions.is(
  (select status from public.beta_access where email = 'approved@example.invalid'),
  'approved',
  'a request cannot downgrade approved access'
);

select extensions.is(
  (select access_kind from public.beta_access where email = 'approved@example.invalid'),
  'beta',
  'a request preserves approved beta access kind'
);

select extensions.is(
  (select status from public.beta_access where email = 'complimentary@example.invalid'),
  'approved',
  'a request cannot downgrade complimentary access status'
);

select extensions.is(
  (select access_kind from public.beta_access where email = 'complimentary@example.invalid'),
  'complimentary',
  'a request cannot downgrade complimentary access kind'
);

set local role anon;

select extensions.throws_ok(
  $sql$select * from public.beta_access$sql$,
  '42501',
  null,
  'anonymous callers cannot read beta_access rows'
);

select extensions.throws_ok(
  $sql$
    insert into public.beta_access (email)
    values ('anonymous-write@example.invalid')
  $sql$,
  '42501',
  null,
  'anonymous callers cannot mutate beta_access directly'
);

select extensions.ok(
  has_function_privilege('anon', 'public.request_beta_access(text)', 'EXECUTE'),
  'anon can execute only the narrow request RPC'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'EXECUTE'),
  'anon cannot execute the Before User Created hook directly'
);

reset role;

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
  '21000000-0000-4000-8000-000000000021',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'approved@example.invalid',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

select extensions.is(
  (select user_id from public.beta_access where email = 'approved@example.invalid'),
  '21000000-0000-4000-8000-000000000021'::uuid,
  'the post-create provisioning trigger links the approved auth user'
);

select * from extensions.finish();
rollback;
