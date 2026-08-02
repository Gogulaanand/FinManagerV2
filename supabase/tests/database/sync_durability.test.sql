begin;

set local search_path = extensions, public;

select extensions.plan(32);

select extensions.has_table(
  'public',
  'sync_upload_transactions',
  'the sync idempotency ledger exists'
);

select extensions.has_function(
  'public',
  'apply_sync_transaction',
  array['text', 'bigint', 'text', 'jsonb'],
  'the atomic sync batch RPC exists with the expected signature'
);

select extensions.function_returns(
  'public',
  'apply_sync_transaction',
  array['text', 'bigint', 'text', 'jsonb'],
  'jsonb',
  'the sync batch RPC returns a status object'
);

select extensions.ok(
  not (
    select prosecdef
    from pg_proc
    where oid = 'public.apply_sync_transaction(text,bigint,text,jsonb)'::regprocedure
  ),
  'the sync batch RPC keeps caller privileges and RLS'
);

select extensions.has_index(
  'public',
  'sync_upload_transactions',
  'sync_upload_transactions_pkey',
  'the sync idempotency key is unique per user and client transaction'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.apply_sync_transaction(text,bigint,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated users can execute the sync RPC'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.apply_sync_transaction(text,bigint,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the sync RPC'
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
    'sync-durability-one@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'sync-durability-two@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select extensions.is(
  public.apply_sync_transaction(
    'client-one',
    1,
    'client-hash-one',
    $json$[
      {
        "clientId": 1,
        "table": "accounts",
        "id": "30000000-0000-4000-8000-000000000003",
        "op": "PUT",
        "data": {
          "id": "30000000-0000-4000-8000-000000000003",
          "user_id": "10000000-0000-4000-8000-000000000001",
          "name": "Primary account",
          "type": "bank",
          "currency": "INR",
          "current_balance": 1000,
          "is_active": true,
          "created_at": "2026-08-01T00:00:00Z",
          "updated_at": "2026-08-01T00:00:00Z"
        }
      }
    ]$json$::jsonb
  ) ->> 'status',
  'applied',
  'an authenticated owner can atomically apply a batch'
);

select extensions.is(
  (select count(*) from public.accounts where id = '30000000-0000-4000-8000-000000000003'),
  1::bigint,
  'the applied row exists exactly once'
);

select extensions.is(
  (
    select payload_hash
    from public.sync_upload_transactions
    where client_instance_id = 'client-one' and transaction_id = 1
  ),
  'client-hash-one',
  'the ledger retains the client payload hash without financial payload data'
);

select extensions.is(
  public.apply_sync_transaction(
    'client-one',
    1,
    'client-hash-one',
    $json$[
      {
        "clientId": 1,
        "table": "accounts",
        "id": "30000000-0000-4000-8000-000000000003",
        "op": "PUT",
        "data": {
          "id": "30000000-0000-4000-8000-000000000003",
          "user_id": "10000000-0000-4000-8000-000000000001",
          "name": "Primary account",
          "type": "bank",
          "currency": "INR",
          "current_balance": 1000,
          "is_active": true,
          "created_at": "2026-08-01T00:00:00Z",
          "updated_at": "2026-08-01T00:00:00Z"
        }
      }
    ]$json$::jsonb
  ) ->> 'status',
  'already_applied',
  'an identical replay is acknowledged without reapplying it'
);

select extensions.is(
  (select count(*) from public.accounts where id = '30000000-0000-4000-8000-000000000003'),
  1::bigint,
  'an identical replay does not duplicate the server row'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 1, 'changed-client-hash',
      '[{"clientId":1,"table":"accounts","id":"30000000-0000-4000-8000-000000000003","op":"DELETE","data":null}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a reused idempotency key rejects a changed client payload hash'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 1, 'client-hash-one',
      '[{"clientId":1,"table":"accounts","id":"30000000-0000-4000-8000-000000000003","op":"DELETE","data":null}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a reused idempotency key rejects changed operations even if the client hash is reused'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 2, 'forbidden-table',
      '[{"clientId":2,"table":"auth.users","id":"30000000-0000-4000-8000-000000000003","op":"DELETE","data":null}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'the RPC rejects tables outside the explicit allowlist'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 3, 'cross-owner',
      '[{"clientId":3,"table":"accounts","id":"31000000-0000-4000-8000-000000000003","op":"PUT","data":{"id":"31000000-0000-4000-8000-000000000003","user_id":"20000000-0000-4000-8000-000000000002","name":"Other user account","type":"bank","currency":"INR","current_balance":0,"is_active":true,"created_at":"2026-08-01T00:00:00Z","updated_at":"2026-08-01T00:00:00Z"}}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'RLS rejects an upload that tries to write another user owner id'
);

select extensions.is(
  (select count(*) from public.accounts where id = '31000000-0000-4000-8000-000000000003'),
  0::bigint,
  'the rejected cross-owner row is absent'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 4, 'atomic-rollback',
      $json$[
        {
          "clientId": 4,
          "table": "accounts",
          "id": "40000000-0000-4000-8000-000000000004",
          "op": "PUT",
          "data": {
            "id": "40000000-0000-4000-8000-000000000004",
            "user_id": "10000000-0000-4000-8000-000000000001",
            "name": "Must roll back",
            "type": "bank",
            "currency": "INR",
            "current_balance": 0,
            "is_active": true,
            "created_at": "2026-08-01T00:00:00Z",
            "updated_at": "2026-08-01T00:00:00Z"
          }
        },
        {
          "clientId": 5,
          "table": "transactions",
          "id": "50000000-0000-4000-8000-000000000005",
          "op": "PUT",
          "data": {
            "id": "50000000-0000-4000-8000-000000000005",
            "user_id": "10000000-0000-4000-8000-000000000001",
            "account_id": "40000000-0000-4000-8000-000000000004",
            "amount": -1,
            "direction": "debit",
            "currency": "INR",
            "occurred_on": "2026-08-01",
            "is_recurring": false,
            "recurrence_interval": 1,
            "created_at": "2026-08-01T00:00:00Z",
            "updated_at": "2026-08-01T00:00:00Z"
          }
        }
      ]$json$::jsonb
    )
  $sql$,
  '23514',
  null,
  'a constraint failure in the second operation aborts the complete batch'
);

select extensions.is(
  (select count(*) from public.accounts where id = '40000000-0000-4000-8000-000000000004'),
  0::bigint,
  'the first operation is rolled back when a later operation fails'
);

select extensions.is(
  (
    select count(*)
    from public.sync_upload_transactions
    where client_instance_id = 'client-one' and transaction_id = 4
  ),
  0::bigint,
  'a failed batch leaves no committed idempotency record'
);

do $block$
begin
  perform public.apply_sync_transaction(
    'client-one',
    40,
    'ambiguous-before-commit',
    '[{"clientId":40,"table":"accounts","id":"41000000-0000-4000-8000-000000000004","op":"PUT","data":{"id":"41000000-0000-4000-8000-000000000004","user_id":"10000000-0000-4000-8000-000000000001","name":"Ambiguous account","type":"bank","currency":"INR","current_balance":50,"is_active":true,"created_at":"2026-08-01T00:00:00Z","updated_at":"2026-08-01T00:00:00Z"}}]'::jsonb
  );
  raise exception 'simulate response loss before commit';
exception
  when others then
    if sqlerrm <> 'simulate response loss before commit' then
      raise;
    end if;
end;
$block$;

select extensions.is(
  (
    select count(*)
    from public.sync_upload_transactions
    where client_instance_id = 'client-one' and transaction_id = 40
  ),
  0::bigint,
  'a response loss before commit leaves no idempotency record'
);

select extensions.is(
  public.apply_sync_transaction(
    'client-one',
    40,
    'ambiguous-before-commit',
    '[{"clientId":40,"table":"accounts","id":"41000000-0000-4000-8000-000000000004","op":"PUT","data":{"id":"41000000-0000-4000-8000-000000000004","user_id":"10000000-0000-4000-8000-000000000001","name":"Ambiguous account","type":"bank","currency":"INR","current_balance":50,"is_active":true,"created_at":"2026-08-01T00:00:00Z","updated_at":"2026-08-01T00:00:00Z"}}]'::jsonb
  ) ->> 'status',
  'applied',
  'retry after a pre-commit response loss applies the transaction'
);

select extensions.is(
  (select count(*) from public.accounts where id = '41000000-0000-4000-8000-000000000004'),
  1::bigint,
  'retry after a pre-commit response loss applies exactly once'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 5, 'delete-then-patch',
      '[{"clientId":6,"table":"accounts","id":"30000000-0000-4000-8000-000000000003","op":"DELETE","data":null},{"clientId":7,"table":"accounts","id":"30000000-0000-4000-8000-000000000003","op":"PATCH","data":{"name":"Impossible rename"}}]'::jsonb
    )
  $sql$,
  '40001',
  null,
  'delete followed by update fails deterministically inside one batch'
);

select extensions.is(
  (select count(*) from public.accounts where id = '30000000-0000-4000-8000-000000000003'),
  1::bigint,
  'the failed delete-update batch rolls the delete back'
);

select extensions.is(
  public.apply_sync_transaction(
    'client-one',
    6,
    'patch-account',
    '[{"clientId":8,"table":"accounts","id":"30000000-0000-4000-8000-000000000003","op":"PATCH","data":{"name":"Renamed account"}}]'::jsonb
  ) ->> 'status',
  'applied',
  'a partial PATCH applies through the typed RPC'
);

select extensions.is(
  (select name from public.accounts where id = '30000000-0000-4000-8000-000000000003'),
  'Renamed account',
  'PATCH updates the requested field'
);

select extensions.is(
  (select current_balance from public.accounts where id = '30000000-0000-4000-8000-000000000003'),
  1000::double precision,
  'PATCH preserves fields that were not present in the operation data'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 7, 'mismatched-row-id',
      '[{"clientId":9,"table":"accounts","id":"60000000-0000-4000-8000-000000000006","op":"PUT","data":{"id":"61000000-0000-4000-8000-000000000006","user_id":"10000000-0000-4000-8000-000000000001"}}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'operation identity cannot diverge from the row id in PUT data'
);

select extensions.throws_ok(
  $sql$
    select public.apply_sync_transaction(
      'client-one', 8, 'unique-conflict',
      '[{"clientId":10,"table":"profiles","id":"70000000-0000-4000-8000-000000000007","op":"PUT","data":{"id":"70000000-0000-4000-8000-000000000007","user_id":"10000000-0000-4000-8000-000000000001","default_fy":"2026-27","currency":"INR","onboarded":false,"csv_mappings":{},"created_at":"2026-08-01T00:00:00Z","updated_at":"2026-08-01T00:00:00Z"}}]'::jsonb
    )
  $sql$,
  '23505',
  null,
  'a non-primary unique conflict rejects the batch for explicit resolution'
);

select extensions.is(
  (
    select count(*)
    from public.sync_upload_transactions
    where client_instance_id = 'client-one' and transaction_id = 8
  ),
  0::bigint,
  'a unique-conflict batch does not leave an applied ledger row'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*) from public.sync_upload_transactions),
  0::bigint,
  'RLS hides the first user idempotency ledger from a second user'
);

reset role;
select * from extensions.finish();
rollback;
