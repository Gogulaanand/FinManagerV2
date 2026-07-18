-- FinManager V2 - Phase 5: portfolio FX, quote provenance, and invariants.
-- Phase 4 is already applied; this migration is additive and does not rerun it.

alter table public.holdings
  add column if not exists manual_price_override double precision,
  add column if not exists manual_value_override double precision,
  add column if not exists manual_fx_rate_to_inr double precision,
  add column if not exists automatic_price double precision,
  add column if not exists automatic_price_as_of date,
  add column if not exists automatic_price_source text,
  add column if not exists automatic_price_provider text,
  add column if not exists automatic_price_fx_rate_to_inr double precision;

alter table public.holding_events
  add column if not exists currency text not null default 'INR',
  add column if not exists fx_rate_to_inr double precision,
  add column if not exists import_hash text;

alter table public.valuations
  add column if not exists currency text not null default 'INR',
  add column if not exists fx_rate_to_inr double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'holdings_quantity_nonnegative_ck') then
    alter table public.holdings add constraint holdings_quantity_nonnegative_ck check (quantity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holdings_value_nonnegative_ck') then
    alter table public.holdings add constraint holdings_value_nonnegative_ck check (
      (avg_cost is null or avg_cost >= 0)
      and (current_price is null or current_price >= 0)
      and (current_value is null or current_value >= 0)
      and (manual_price_override is null or manual_price_override >= 0)
      and (manual_value_override is null or manual_value_override >= 0)
      and (manual_fx_rate_to_inr is null or manual_fx_rate_to_inr > 0)
      and (automatic_price is null or automatic_price > 0)
      and (automatic_price_fx_rate_to_inr is null or automatic_price_fx_rate_to_inr > 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holdings_type_ck') then
    alter table public.holdings add constraint holdings_type_ck check (
      type in (
        'mutual_fund', 'stock', 'foreign_stock', 'rsu', 'esop', 'epf', 'ppf',
        'nps', 'fd', 'real_estate', 'gold', 'crypto', 'cash'
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holding_events_kind_ck') then
    alter table public.holding_events add constraint holding_events_kind_ck check (
      kind in ('buy', 'sell', 'vest', 'exercise', 'dividend', 'interest', 'contribution', 'withdrawal')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holding_events_sign_ck') then
    alter table public.holding_events add constraint holding_events_sign_ck check (
      (kind in ('buy', 'contribution', 'exercise') and amount < 0)
      or (kind = 'vest' and amount = 0)
      or (kind in ('sell', 'dividend', 'interest', 'withdrawal') and amount > 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holding_events_quantity_price_ck') then
    alter table public.holding_events add constraint holding_events_quantity_price_ck check (
      (quantity is null or quantity > 0) and (price is null or price > 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holding_events_currency_ck') then
    alter table public.holding_events add constraint holding_events_currency_ck check (currency in ('INR', 'USD', 'EUR', 'GBP'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holding_events_fx_ck') then
    alter table public.holding_events add constraint holding_events_fx_ck check (
      (currency = 'INR' and (fx_rate_to_inr is null or fx_rate_to_inr = 1))
      or (currency <> 'INR' and fx_rate_to_inr > 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'valuations_currency_ck') then
    alter table public.valuations add constraint valuations_currency_ck check (currency in ('INR', 'USD', 'EUR', 'GBP'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'valuations_fx_ck') then
    alter table public.valuations add constraint valuations_fx_ck check (
      (currency = 'INR' and (fx_rate_to_inr is null or fx_rate_to_inr = 1))
      or (currency <> 'INR' and fx_rate_to_inr > 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'valuations_positive_value_ck') then
    alter table public.valuations add constraint valuations_positive_value_ck check (value > 0);
  end if;
end
$$;

create unique index if not exists accounts_id_user_uidx on public.accounts (id, user_id);
create unique index if not exists holdings_id_user_uidx on public.holdings (id, user_id);

do $$
begin
  if exists (
    select 1
    from public.holdings h
    join public.accounts a on a.id = h.account_id
    where h.account_id is not null and h.user_id <> a.user_id
  ) then
    raise exception 'Phase 5 preflight failed: holdings reference an account owned by another user';
  end if;
  if exists (
    select 1
    from public.holding_events e
    join public.holdings h on h.id = e.holding_id
    where e.user_id <> h.user_id
  ) then
    raise exception 'Phase 5 preflight failed: holding events have a mismatched owner';
  end if;
  if exists (
    select 1
    from public.valuations v
    join public.holdings h on h.id = v.holding_id
    where v.user_id <> h.user_id
  ) then
    raise exception 'Phase 5 preflight failed: valuations have a mismatched owner';
  end if;
  if exists (
    select user_id, holding_id, as_of
    from public.valuations
    group by user_id, holding_id, as_of
    having count(*) > 1
  ) then
    raise exception 'Phase 5 preflight failed: duplicate holding valuation dates exist';
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'holdings_account_same_user_fk') then
    alter table public.holdings add constraint holdings_account_same_user_fk
      foreign key (account_id, user_id) references public.accounts (id, user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holding_events_holding_same_user_fk') then
    alter table public.holding_events add constraint holding_events_holding_same_user_fk
      foreign key (holding_id, user_id) references public.holdings (id, user_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'valuations_holding_same_user_fk') then
    alter table public.valuations add constraint valuations_holding_same_user_fk
      foreign key (holding_id, user_id) references public.holdings (id, user_id) on delete cascade;
  end if;
end
$$;

create index if not exists holdings_user_type_idx on public.holdings (user_id, type);
create index if not exists holding_events_user_occurred_idx on public.holding_events (user_id, occurred_on desc);
create index if not exists holding_events_holding_occurred_idx on public.holding_events (holding_id, occurred_on desc);
create index if not exists valuations_holding_as_of_idx on public.valuations (holding_id, as_of desc);
create unique index if not exists holding_events_user_import_hash_uidx
  on public.holding_events (user_id, import_hash) where import_hash is not null;
create unique index if not exists valuations_user_holding_as_of_uidx
  on public.valuations (user_id, holding_id, as_of);
