-- Phase 7: metered AI requests and offline monthly summaries.

create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  input_tokens  bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  updated_at    timestamptz not null default now(),
  unique (user_id, month)
);
create index ai_usage_user_id_idx on public.ai_usage (user_id);
create trigger ai_usage_set_updated_at before update on public.ai_usage
  for each row execute function public.set_updated_at();
alter table public.ai_usage enable row level security;
create policy "users can read their own ai usage" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);
grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;

create table public.ai_summaries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  month        text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  scope        text not null default 'everything'
               check (scope in ('everything', 'expenses', 'budget', 'portfolio', 'goals', 'tax')),
  content      text not null check (length(btrim(content)) > 0),
  generated_at timestamptz not null default now(),
  unique (user_id, month, scope)
);
create index ai_summaries_user_id_idx on public.ai_summaries (user_id);
create index ai_summaries_user_month_idx on public.ai_summaries (user_id, month desc);
alter table public.ai_summaries enable row level security;
create policy "ai summaries are private" on public.ai_summaries
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.ai_summaries to authenticated, service_role;
