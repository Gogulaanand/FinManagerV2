-- R1.1: upload PowerSync transactions atomically and make retries idempotent.
--
-- This table is deliberately not part of the PowerSync schema. It is written by
-- the SECURITY INVOKER RPC below, so the caller's auth.uid() and RLS policies
-- remain the tenancy boundary.

create table public.sync_upload_transactions (
  user_id              uuid not null references auth.users (id) on delete cascade,
  client_instance_id   text not null check (length(client_instance_id) > 0),
  transaction_id       bigint not null,
  payload_hash         text not null check (length(payload_hash) > 0),
  server_payload_hash  text not null check (length(server_payload_hash) > 0),
  operation_count      integer not null check (operation_count > 0),
  applied_at           timestamptz not null default now(),
  primary key (user_id, client_instance_id, transaction_id)
);

alter table public.sync_upload_transactions enable row level security;
create policy "sync upload transactions are private" on public.sync_upload_transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert on public.sync_upload_transactions to authenticated;

create or replace function public.apply_sync_transaction(
  p_client_instance_id text,
  p_transaction_id bigint,
  p_payload_hash text,
  p_operations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing public.sync_upload_transactions%rowtype;
  v_operation jsonb;
  v_table_name text;
  v_operation_type text;
  v_row_id text;
  v_data jsonb;
  v_server_payload_hash text := encode(
    extensions.digest(convert_to(p_operations::text, 'UTF8'), 'sha256'),
    'hex'
  );
  v_columns text;
  v_patch_columns text;
  v_excluded_columns text;
  v_row_count integer;
  v_operation_count integer;
  v_allowed_tables constant text[] := array[
    'profiles',
    'trusted_contacts',
    'activity_log',
    'tax_scenarios',
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'holdings',
    'holding_events',
    'valuations',
    'goals',
    'fire_settings',
    'ai_summaries',
    'deadman_settings',
    'escalation_events'
  ];
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required for sync upload';
  end if;

  if p_client_instance_id is null or length(trim(p_client_instance_id)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Sync client instance id is required';
  end if;

  if p_transaction_id is null or p_transaction_id < 0 then
    raise exception using
      errcode = '22023',
      message = 'Sync transaction id is invalid';
  end if;

  if p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Sync payload hash is required';
  end if;

  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Sync operations must be an array';
  end if;

  v_operation_count := jsonb_array_length(p_operations);
  if v_operation_count = 0 or v_operation_count > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Sync operation count is outside the allowed range';
  end if;

  insert into public.sync_upload_transactions (
    user_id,
    client_instance_id,
    transaction_id,
    payload_hash,
    server_payload_hash,
    operation_count
  )
  values (
    v_user_id,
    p_client_instance_id,
    p_transaction_id,
    p_payload_hash,
    v_server_payload_hash,
    v_operation_count
  )
  on conflict (user_id, client_instance_id, transaction_id) do nothing;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    select *
    into strict v_existing
    from public.sync_upload_transactions
    where user_id = v_user_id
      and client_instance_id = p_client_instance_id
      and transaction_id = p_transaction_id;

    if v_existing.payload_hash <> p_payload_hash
       or v_existing.server_payload_hash <> v_server_payload_hash then
      raise exception using
        errcode = '22023',
        message = 'Sync transaction payload changed during retry';
    end if;
    return jsonb_build_object(
      'status', 'already_applied',
      'operationCount', v_existing.operation_count,
      'appliedAt', v_existing.applied_at
    );
  end if;

  for v_operation in select value from jsonb_array_elements(p_operations)
  loop
    v_table_name := v_operation ->> 'table';
    v_operation_type := v_operation ->> 'op';
    v_row_id := v_operation ->> 'id';
    v_data := v_operation -> 'data';

    if v_table_name is null or not (v_table_name = any(v_allowed_tables)) then
      raise exception using
        errcode = '42501',
        message = 'Sync table is not allowed';
    end if;

    if v_operation_type not in ('PUT', 'PATCH', 'DELETE') then
      raise exception using
        errcode = '22023',
        message = 'Sync operation type is invalid';
    end if;

    if v_operation_type in ('PUT', 'PATCH')
       and (v_data is null or jsonb_typeof(v_data) <> 'object') then
      raise exception using
        errcode = '22023',
        message = 'Sync write data must be an object';
    end if;

    if v_row_id is null or v_row_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using
        errcode = '22023',
        message = 'Sync row id is invalid';
    end if;

    if v_operation_type = 'PUT' and v_data ->> 'id' is distinct from v_row_id then
      raise exception using
        errcode = '22023',
        message = 'Sync PUT data id does not match the operation row id';
    end if;

    if v_operation_type = 'PATCH'
       and v_data ? 'id'
       and v_data ->> 'id' is distinct from v_row_id then
      raise exception using
        errcode = '22023',
        message = 'Sync PATCH data id does not match the operation row id';
    end if;

    select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum),
           string_agg(format('patch.%I', attribute.attname), ', ' order by attribute.attnum),
           string_agg(format('excluded.%I', attribute.attname), ', ' order by attribute.attnum)
    into v_columns, v_patch_columns, v_excluded_columns
    from pg_attribute as attribute
    join pg_class as relation on relation.oid = attribute.attrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = v_table_name
      and attribute.attnum > 0
      and not attribute.attisdropped;

    if v_columns is null then
      raise exception using
        errcode = '42501',
        message = 'Sync table definition is unavailable';
    end if;

    if v_operation_type = 'PUT' then
      execute format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1::jsonb)
         on conflict (id) do update set (%s) = (%s)',
        v_table_name,
        v_table_name,
        v_columns,
        v_excluded_columns
      ) using v_data;
    elsif v_operation_type = 'PATCH' then
      execute format(
        'update public.%I as target
         set (%s) = (
           select %s
           from jsonb_populate_record(
             null::public.%I,
             to_jsonb(target) || $1::jsonb
           ) as patch
         )
         where target.id = $2::uuid',
        v_table_name,
        v_columns,
        v_patch_columns,
        v_table_name
      ) using v_data, v_row_id;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        raise exception using
          errcode = '40001',
          message = 'Sync patch target was not found';
      end if;
    else
      execute format(
        'delete from public.%I where id = $1::uuid',
        v_table_name
      ) using v_row_id;
      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        raise exception using
          errcode = '40001',
          message = 'Sync delete target was not found';
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'applied',
    'operationCount', v_operation_count,
    'appliedAt', now()
  );
end;
$function$;

revoke all on function public.apply_sync_transaction(text, bigint, text, jsonb) from public, anon;
grant execute on function public.apply_sync_transaction(text, bigint, text, jsonb) to authenticated;
