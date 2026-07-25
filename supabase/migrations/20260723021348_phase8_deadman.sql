-- Phase 8: dead-man switch settings, trusted-contact disclosure scope, and audit ledger.
-- The Edge Function is the only writer for escalation_events; the client receives
-- the table through PowerSync for history display.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

alter table public.trusted_contacts
  add column disclosure_scope text not null default 'existence';
alter table public.trusted_contacts
  add constraint trusted_contacts_disclosure_scope_check
  check (disclosure_scope in ('existence', 'summary'));

create table public.deadman_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users (id) on delete cascade,
  is_enabled       boolean not null default false,
  threshold_days   integer not null default 30 check (threshold_days between 1 and 365),
  disclosure_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index deadman_settings_user_id_idx on public.deadman_settings (user_id);
create trigger deadman_settings_set_updated_at before update on public.deadman_settings
  for each row execute function public.set_updated_at();
alter table public.deadman_settings enable row level security;
create policy "deadman settings are private" on public.deadman_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.deadman_settings to authenticated, service_role;

create table public.escalation_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('reminder_1', 'reminder_2', 'reminder_3', 'disclosure', 'cancelled', 'test')),
  status      text not null check (status in ('pending', 'sent', 'failed')),
  recipient   text,
  detail      jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index escalation_events_user_created_idx on public.escalation_events (user_id, created_at desc);
alter table public.escalation_events enable row level security;
create policy "escalation events are readable by their owner" on public.escalation_events
  for select to authenticated using (auth.uid() = user_id);
grant select on public.escalation_events to authenticated;
grant select, insert, update, delete on public.escalation_events to service_role;

-- The URL and secret are intentionally read from Supabase Vault at execution
-- time. Configure both Vault secrets alongside the Edge Function secrets before
-- enabling the schedule; no secret is committed to this repository. A fresh
-- project may not have those secrets yet, so do not create a malformed job.
do $phase8$
declare
  has_vault_secrets boolean :=
    exists (select 1 from vault.decrypted_secrets where name = 'deadman_supabase_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'deadman_cron_secret');
begin
  if has_vault_secrets then
    perform cron.schedule(
      'deadman-daily',
      '0 3 * * *',
      $deadman_job$select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'deadman_supabase_url') || '/functions/v1/deadman-check',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'deadman_cron_secret')),
        body := '{}'::jsonb
      );$deadman_job$
    );
  end if;
end;
$phase8$;

