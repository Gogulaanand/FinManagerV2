-- Phase 9: durable outcomes and an independent checker for the dead-man cron.
-- pg_cron only proves that pg_net accepted a request; this table records what
-- the Edge Function itself observed after it actually ran.

create table public.cron_runs (
  id            uuid primary key default gen_random_uuid(),
  job_name      text not null default 'deadman-daily',
  ran_at        timestamptz not null default now(),
  enabled       integer not null default 0 check (enabled >= 0),
  processed     integer not null default 0 check (processed >= 0),
  failed        integer not null default 0 check (failed >= 0),
  detail        jsonb not null default '{}'::jsonb,
  alert_sent_at timestamptz
);

create index cron_runs_job_ran_at_idx on public.cron_runs (job_name, ran_at desc);

alter table public.cron_runs enable row level security;
grant select, insert, update, delete on public.cron_runs to service_role;

-- Schedule the independent checker only when the Phase 8 Vault secrets exist.
-- It runs after the daily check and alerts on a missing or failed latest run.
do $phase9$
declare
  has_vault_secrets boolean :=
    exists (select 1 from vault.decrypted_secrets where name = 'deadman_supabase_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'deadman_cron_secret')
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'deadman_monitor_enabled' and decrypted_secret = 'true'
    );
begin
  if has_vault_secrets then
    perform cron.schedule(
      'deadman-monitor-daily',
      '30 3 * * *',
      $monitor_job$select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'deadman_supabase_url') || '/functions/v1/deadman-monitor',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'deadman_cron_secret')),
        body := '{}'::jsonb
      );$monitor_job$
    );
  end if;
end;
$phase9$;
