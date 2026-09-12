-- Server-only arming state. It is deliberately excluded from client sync/export writes.
create table public.deadman_runtime (
  user_id uuid primary key references auth.users(id) on delete cascade,
  armed_at timestamptz,
  last_check_in_at timestamptz,
  cycle_id uuid not null default gen_random_uuid()
);
alter table public.deadman_runtime enable row level security;
create policy "owner may inspect server inactivity state" on public.deadman_runtime
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.deadman_runtime from anon, authenticated;
grant select on public.deadman_runtime to authenticated;
grant all on public.deadman_runtime to service_role;

create schema if not exists finmanager_internal;
revoke all on schema finmanager_internal from public, anon, authenticated;

create function finmanager_internal.arm_deadman_from_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception 'Owner mismatch';
  end if;
  if not new.is_enabled then
    update public.deadman_runtime set armed_at = null, cycle_id = gen_random_uuid()
      where user_id = new.user_id;
  elsif tg_op = 'INSERT' then
    insert into public.deadman_runtime(user_id, armed_at, last_check_in_at)
      values (new.user_id, clock_timestamp(), clock_timestamp())
      on conflict (user_id) do update set armed_at = excluded.armed_at,
        last_check_in_at = excluded.last_check_in_at, cycle_id = gen_random_uuid();
  elsif not old.is_enabled or old.threshold_days is distinct from new.threshold_days
      or old.disclosure_note is distinct from new.disclosure_note
      or not exists(select 1 from public.deadman_runtime where user_id = new.user_id and armed_at is not null) then
    insert into public.deadman_runtime(user_id, armed_at, last_check_in_at)
      values (new.user_id, clock_timestamp(), clock_timestamp())
      on conflict (user_id) do update set armed_at = excluded.armed_at,
        last_check_in_at = excluded.last_check_in_at, cycle_id = gen_random_uuid();
  end if;
  return new;
end;
$$;
revoke all on function finmanager_internal.arm_deadman_from_settings() from public, anon, authenticated;
create trigger deadman_settings_server_arm after insert or update on public.deadman_settings
  for each row execute function finmanager_internal.arm_deadman_from_settings();

create function finmanager_internal.confirm_deadman_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception 'Owner mismatch';
  end if;
  update public.deadman_runtime set last_check_in_at = clock_timestamp(), cycle_id = gen_random_uuid()
    where user_id = new.user_id and armed_at is not null
      and exists(select 1 from public.deadman_settings where user_id = new.user_id and is_enabled);
  return new;
end;
$$;
revoke all on function finmanager_internal.confirm_deadman_activity() from public, anon, authenticated;
create trigger activity_server_check_in after insert on public.activity_log
  for each row execute function finmanager_internal.confirm_deadman_activity();

-- Null keys retain old history. New delivery claims are unique across retries/concurrent runs.
alter table public.escalation_events add column delivery_key text unique;

-- Delivery records, unlike synced history, cannot be forged/restored by clients.
create table public.deadman_deliveries (
  delivery_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null,
  kind text not null,
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sent','attention')),
  provider_id text,
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  delivery_status text,
  delivered_at timestamptz,
  last_error text
);
create index deadman_deliveries_user_cycle on public.deadman_deliveries(user_id,cycle_id);
alter table public.deadman_deliveries enable row level security;
create policy "owner may inspect deliveries" on public.deadman_deliveries
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.deadman_deliveries from anon, authenticated;
grant select on public.deadman_deliveries to authenticated;
grant all on public.deadman_deliveries to service_role;

-- Changing the audience must restart the warning interval; old warnings do not authorize new recipients.
create function finmanager_internal.restart_deadman_for_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  if auth.uid() is not null and auth.uid() <> owner_id then
    raise exception 'Owner mismatch';
  end if;
  update public.deadman_runtime set last_check_in_at = clock_timestamp(), cycle_id = gen_random_uuid()
    where user_id = owner_id and armed_at is not null;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function finmanager_internal.restart_deadman_for_contact() from public, anon, authenticated;
create trigger trusted_contact_restarts_warning after insert or update or delete on public.trusted_contacts
  for each row execute function finmanager_internal.restart_deadman_for_contact();
