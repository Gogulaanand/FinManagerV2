-- FinManager V2 - Phase 3: full data model.
--
-- Every user-owned table follows one uniform shape so PowerSync bucket rules and
-- RLS policies are identical across the board:
--   id          uuid  primary key default gen_random_uuid()  (client SDK mirrors this as text `id`)
--   user_id     uuid  not null references auth.users(id) on delete cascade
--   created_at  timestamptz not null default now()
--   updated_at  timestamptz not null default now()  (kept fresh by trigger)
--
-- Money is stored as double precision (float rupees), never numeric: D-014 keeps
-- money as float rupees through roundToPaise, and PowerSync maps numeric -> text
-- but double precision -> real, which is what the client math expects.
--
-- Each table, in the SAME migration that creates it (CLAUDE.md):
--   * enables RLS
--   * gets a "for all to authenticated using (auth.uid() = user_id)" policy
--     (FOR ALL with only USING also applies USING as the INSERT/UPDATE WITH CHECK)
--   * grants CRUD to authenticated + service_role so writes reach Postgres through
--     the Supabase Data API (required now that new projects do not auto-expose tables)
--   * indexes user_id (bucket sync + per-user queries)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users; PAN optional, FY preferences)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users (id) on delete cascade,
  full_name         text,
  pan               text,
  default_fy        text not null default '2026-27',
  preferred_regime  text,             -- 'old' | 'new' | null (let the calculator decide)
  currency          text not null default 'INR',
  onboarded         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_user_id_idx on public.profiles (user_id);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
create policy "profiles are private" on public.profiles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.profiles to authenticated, service_role;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- trusted_contacts (dead-man switch recipients)
-- ---------------------------------------------------------------------------

create table public.trusted_contacts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  email            text,
  phone            text,
  relationship     text,
  notify_after_days integer not null default 30,
  priority         integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index trusted_contacts_user_id_idx on public.trusted_contacts (user_id);
create trigger trusted_contacts_set_updated_at before update on public.trusted_contacts
  for each row execute function public.set_updated_at();
alter table public.trusted_contacts enable row level security;
create policy "trusted_contacts are private" on public.trusted_contacts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.trusted_contacts to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- activity_log (every app open; the inactivity monitor's data source)
-- ---------------------------------------------------------------------------

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind        text not null default 'app_open',   -- app_open | checkin | ...
  platform    text,                               -- web | ios | android
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index activity_log_user_id_idx on public.activity_log (user_id);
create index activity_log_user_occurred_idx on public.activity_log (user_id, occurred_at desc);
create trigger activity_log_set_updated_at before update on public.activity_log
  for each row execute function public.set_updated_at();
alter table public.activity_log enable row level security;
create policy "activity_log is private" on public.activity_log
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.activity_log to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- tax_scenarios (saved calculator configurations; migrated off local storage)
-- ---------------------------------------------------------------------------

create table public.tax_scenarios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  fy         text not null default '2026-27',
  input      jsonb not null default '{}'::jsonb,   -- the ScenarioInput; results are always re-derived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tax_scenarios_user_id_idx on public.tax_scenarios (user_id);
create trigger tax_scenarios_set_updated_at before update on public.tax_scenarios
  for each row execute function public.set_updated_at();
alter table public.tax_scenarios enable row level security;
create policy "tax_scenarios are private" on public.tax_scenarios
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.tax_scenarios to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- accounts (bank / broker / wallet / cash / credit_card)
-- ---------------------------------------------------------------------------

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  type            text not null,                 -- bank | broker | wallet | cash | credit_card
  institution     text,
  currency        text not null default 'INR',
  current_balance double precision not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index accounts_user_id_idx on public.accounts (user_id);
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
alter table public.accounts enable row level security;
create policy "accounts are private" on public.accounts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.accounts to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- categories (seeded Indian defaults in Phase 4; self-referential parent)
-- ---------------------------------------------------------------------------

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null,                       -- expense | income | transfer
  icon       text,
  color      text,
  parent_id  uuid references public.categories (id) on delete set null,
  is_system  boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_user_id_idx on public.categories (user_id);
create index categories_parent_id_idx on public.categories (parent_id);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
alter table public.categories enable row level security;
create policy "categories are private" on public.categories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.categories to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  account_id   uuid references public.accounts (id) on delete set null,
  category_id  uuid references public.categories (id) on delete set null,
  amount       double precision not null,
  direction    text not null,                     -- debit | credit
  currency     text not null default 'INR',
  occurred_on  date not null,
  note         text,
  merchant     text,
  is_recurring boolean not null default false,
  recurring_id uuid,                               -- links to a recurring rule (added in Phase 4)
  import_hash  text,                               -- CSV import dedupe key
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_user_occurred_idx on public.transactions (user_id, occurred_on desc);
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
alter table public.transactions enable row level security;
create policy "transactions are private" on public.transactions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.transactions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- budgets (monthly per category)
-- ---------------------------------------------------------------------------

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete cascade,
  period       text not null default 'monthly',   -- monthly | annual
  period_start date not null,                      -- first day of the budget period
  amount       double precision not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index budgets_user_id_idx on public.budgets (user_id);
create index budgets_category_id_idx on public.budgets (category_id);
create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
alter table public.budgets enable row level security;
create policy "budgets are private" on public.budgets
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.budgets to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- holdings (investments across many asset classes)
-- ---------------------------------------------------------------------------

create table public.holdings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  type          text not null,   -- mutual_fund|stock|foreign_stock|rsu|esop|epf|ppf|nps|fd|real_estate|gold|crypto|cash
  identifier    text,            -- ISIN / ticker / folio
  account_id    uuid references public.accounts (id) on delete set null,
  currency      text not null default 'INR',
  quantity      double precision not null default 0,
  avg_cost      double precision,
  current_price double precision,
  current_value double precision,
  metadata      jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index holdings_user_id_idx on public.holdings (user_id);
create index holdings_account_id_idx on public.holdings (account_id);
create trigger holdings_set_updated_at before update on public.holdings
  for each row execute function public.set_updated_at();
alter table public.holdings enable row level security;
create policy "holdings are private" on public.holdings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.holdings to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- holding_events (buy/sell/vest/dividend cash flows that feed XIRR)
-- ---------------------------------------------------------------------------

create table public.holding_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  holding_id  uuid not null references public.holdings (id) on delete cascade,
  kind        text not null,   -- buy | sell | vest | dividend | interest | contribution | withdrawal
  occurred_on date not null,
  quantity    double precision,
  price       double precision,
  amount      double precision not null,   -- signed cash flow for XIRR
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index holding_events_user_id_idx on public.holding_events (user_id);
create index holding_events_holding_id_idx on public.holding_events (holding_id);
create trigger holding_events_set_updated_at before update on public.holding_events
  for each row execute function public.set_updated_at();
alter table public.holding_events enable row level security;
create policy "holding_events are private" on public.holding_events
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.holding_events to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- valuations (point-in-time marks for illiquid assets like real estate)
-- ---------------------------------------------------------------------------

create table public.valuations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  holding_id uuid not null references public.holdings (id) on delete cascade,
  as_of      date not null,
  value      double precision not null,
  source     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index valuations_user_id_idx on public.valuations (user_id);
create index valuations_holding_id_idx on public.valuations (holding_id);
create trigger valuations_set_updated_at before update on public.valuations
  for each row execute function public.set_updated_at();
alter table public.valuations enable row level security;
create policy "valuations are private" on public.valuations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.valuations to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- goals (education / marriage / custom / retirement)
-- ---------------------------------------------------------------------------

create table public.goals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  kind               text not null,             -- education | marriage | custom | retirement
  target_amount      double precision not null,
  target_date        date,
  current_amount     double precision not null default 0,
  expected_return    double precision,          -- annual %
  inflation          double precision,          -- annual %
  linked_holding_ids jsonb not null default '[]'::jsonb,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index goals_user_id_idx on public.goals (user_id);
create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
alter table public.goals enable row level security;
create policy "goals are private" on public.goals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.goals to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- fire_settings (1:1 per user; expenses baseline, withdrawal rate, variants)
-- ---------------------------------------------------------------------------

create table public.fire_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users (id) on delete cascade,
  annual_expenses  double precision,
  withdrawal_rate  double precision not null default 4,   -- %
  expected_return  double precision,                      -- annual %
  inflation        double precision,                      -- annual %
  current_age      integer,
  retirement_age   integer,
  lean_multiplier  double precision,
  fat_multiplier   double precision,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index fire_settings_user_id_idx on public.fire_settings (user_id);
create trigger fire_settings_set_updated_at before update on public.fire_settings
  for each row execute function public.set_updated_at();
alter table public.fire_settings enable row level security;
create policy "fire_settings are private" on public.fire_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.fire_settings to authenticated, service_role;
