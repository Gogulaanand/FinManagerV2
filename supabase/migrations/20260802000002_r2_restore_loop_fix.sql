-- R2.2 fix: iterate restore table arrays with SELECT unnest(...). The initial
-- function body used FOREACH with a constant array, which the linked linter
-- surfaced as one quoted array identifier in dynamic SQL.

create or replace function public.apply_data_restore(
  p_restore_id text,
  p_payload_hash text,
  p_mode text,
  p_collections jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing public.restore_runs%rowtype;
  v_table text;
  v_row jsonb;
  v_rows jsonb;
  v_mode text := lower(trim(coalesce(p_mode, '')));
  v_total integer := 0;
  v_count integer := 0;
  v_applied integer := 0;
  v_row_counts jsonb := '{}'::jsonb;
  v_applied_counts jsonb := '{}'::jsonb;
  v_allowed constant text[] := array[
    'profiles', 'trusted_contacts', 'activity_log', 'tax_scenarios',
    'accounts', 'categories', 'transactions', 'budgets', 'holdings',
    'holding_events', 'valuations', 'goals', 'fire_settings', 'ai_summaries',
    'deadman_settings', 'escalation_events'
  ];
  v_insert_order constant text[] := array[
    'profiles', 'trusted_contacts', 'activity_log', 'tax_scenarios',
    'accounts', 'categories', 'holdings', 'transactions', 'budgets',
    'holding_events', 'valuations', 'goals', 'fire_settings', 'ai_summaries',
    'deadman_settings', 'escalation_events'
  ];
  v_delete_order constant text[] := array[
    'escalation_events', 'deadman_settings', 'ai_summaries', 'fire_settings',
    'goals', 'valuations', 'holding_events', 'budgets', 'transactions',
    'holdings', 'categories', 'accounts', 'tax_scenarios', 'activity_log',
    'trusted_contacts', 'profiles'
  ];
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required for restore';
  end if;
  if p_restore_id is null or length(trim(p_restore_id)) = 0 then
    raise exception using errcode = '22023', message = 'Restore id is required';
  end if;
  if p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception using errcode = '22023', message = 'Restore payload hash is required';
  end if;
  if v_mode not in ('empty', 'merge', 'replace') then
    raise exception using errcode = '22023', message = 'Restore mode is invalid';
  end if;
  if p_collections is null or jsonb_typeof(p_collections) <> 'object' then
    raise exception using errcode = '22023', message = 'Restore collections must be an object';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_collections) as key
    where key <> all (v_allowed)
  ) then
    raise exception using errcode = '42501', message = 'Restore collection is not allowed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_restore_id, 0));
  select * into v_existing
  from public.restore_runs
  where user_id = v_user_id and restore_id = p_restore_id;
  if found then
    if v_existing.payload_hash <> p_payload_hash or v_existing.mode <> v_mode then
      raise exception using errcode = '22023', message = 'Restore payload changed during retry';
    end if;
    return jsonb_build_object(
      'status', 'already_applied',
      'restoreId', p_restore_id,
      'mode', v_mode,
      'rowCounts', v_existing.row_counts,
      'appliedAt', v_existing.applied_at
    );
  end if;

  for v_table in select unnest(v_insert_order) loop
    v_rows := p_collections -> v_table;
    if v_rows is null or jsonb_typeof(v_rows) <> 'array' then
      raise exception using errcode = '22023', message = 'Every restore collection must be an array';
    end if;
    v_count := jsonb_array_length(v_rows);
    v_total := v_total + v_count;
    if v_total > 10000 then
      raise exception using errcode = '22023', message = 'Restore contains too many rows';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_rows) as item
      where jsonb_typeof(item) <> 'object'
        or item ->> 'id' is null
        or item ->> 'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception using errcode = '22023', message = 'Restore rows must contain UUID ids';
    end if;
    if exists (
      select item ->> 'id'
      from jsonb_array_elements(v_rows) as item
      group by item ->> 'id'
      having count(*) > 1
    ) then
      raise exception using errcode = '22023', message = 'Restore contains duplicate row ids';
    end if;
    v_row_counts := v_row_counts || jsonb_build_object(v_table, v_count);
  end loop;

  if v_mode = 'empty' then
    for v_table in select unnest(v_insert_order) loop
      execute format('select count(*) from public.%I where user_id = $1', v_table)
        into v_count using v_user_id;
      if v_count > 0 then
        raise exception using errcode = '40001', message = 'Empty restore target is not clean';
      end if;
    end loop;
  elsif v_mode = 'replace' then
    for v_table in select unnest(v_delete_order) loop
      execute format('delete from public.%I where user_id = $1', v_table) using v_user_id;
    end loop;
  end if;

  for v_table in select unnest(v_insert_order) loop
    v_rows := p_collections -> v_table;
    for v_row in select value from jsonb_array_elements(v_rows)
    loop
      v_row := v_row || jsonb_build_object('user_id', v_user_id::text);
      if v_mode = 'merge' then
        execute format(
          'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1::jsonb) on conflict do nothing',
          v_table, v_table
        ) using v_row;
      else
        execute format(
          'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1::jsonb)',
          v_table, v_table
        ) using v_row;
      end if;
      get diagnostics v_applied = row_count;
      v_count := coalesce((v_applied_counts ->> v_table)::integer, 0) + v_applied;
      v_applied_counts := v_applied_counts || jsonb_build_object(v_table, v_count);
    end loop;
  end loop;

  insert into public.restore_runs (user_id, restore_id, payload_hash, mode, row_counts)
  values (v_user_id, p_restore_id, p_payload_hash, v_mode, v_applied_counts);

  return jsonb_build_object(
    'status', 'applied',
    'restoreId', p_restore_id,
    'mode', v_mode,
    'rowCounts', v_applied_counts,
    'requestedRowCounts', v_row_counts,
    'appliedAt', now()
  );
end;
$function$;

revoke all on function public.apply_data_restore(text, text, text, jsonb) from public, anon;
grant execute on function public.apply_data_restore(text, text, text, jsonb) to authenticated;
