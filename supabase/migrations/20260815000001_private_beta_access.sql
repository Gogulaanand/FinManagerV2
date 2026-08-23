-- FinManager V2 - private beta access.
--
-- This migration is safe to apply before the Supabase Auth Before User Created
-- hook is enabled. The hook is configured manually in the Supabase dashboard
-- only after the owner has seeded approved accounts (see docs/PRIVATE_BETA_ROLLOUT.md).

create table public.beta_access (
  email         text primary key,
  user_id       uuid references auth.users (id) on delete set null,
  status        text not null default 'requested',
  access_kind   text not null default 'beta',
  requested_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  constraint beta_access_email_normalized_ck check (
    email = lower(btrim(email))
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint beta_access_status_ck check (status in ('requested', 'approved', 'revoked')),
  constraint beta_access_access_kind_ck check (access_kind in ('beta', 'complimentary'))
);

create unique index beta_access_user_id_uidx
  on public.beta_access (user_id)
  where user_id is not null;
create index beta_access_requested_at_idx
  on public.beta_access (requested_at)
  where status = 'requested';

alter table public.beta_access enable row level security;
create policy "beta_access is never public"
  on public.beta_access
  for all to anon, authenticated
  using (false)
  with check (false);

-- The dashboard/service role is the only normal admin surface. The request RPC
-- and Auth Hook are SECURITY DEFINER functions and do not expose table access.
revoke all on table public.beta_access from anon, authenticated;
grant select, insert, update, delete on table public.beta_access to service_role;

comment on table public.beta_access is
  'Private beta allowlist and manual review state; managed in the Supabase dashboard only.';
comment on column public.beta_access.email is
  'Lowercase, trimmed email address; the primary key is the normalized public identity.';
comment on column public.beta_access.access_kind is
  'beta is the normal reviewed path; complimentary is manually assigned to friends or family.';

create or replace function public.request_beta_access(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
begin
  if normalized_email = ''
     or length(normalized_email) > 320
     or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  insert into public.beta_access (email, status, access_kind, requested_at, reviewed_at)
  values (normalized_email, 'requested', 'beta', now(), null)
  on conflict (email) do update
  set requested_at = now(), reviewed_at = null
  where public.beta_access.status = 'requested'
    and public.beta_access.access_kind = 'beta';

  -- Keep this response identical for new, pending, approved, complimentary,
  -- and revoked rows so the public form cannot enumerate the allowlist.
  return '{"ok":true}'::jsonb;
end;
$$;

grant execute on function public.request_beta_access(text) to anon;
revoke execute on function public.request_beta_access(text) from public, authenticated;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  normalized_email text := lower(btrim(coalesce(event->'user'->>'email', '')));
begin
  if exists (
    select 1
    from public.beta_access
    where email = normalized_email
      and status = 'approved'
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'FinManager is currently in a private beta. Request access first, then try again after approval.'
    )
  );
end;
$$;

-- Supabase Auth executes a configured Postgres Auth Hook as supabase_auth_admin.
-- The function is SECURITY DEFINER so this role can read the private allowlist
-- without receiving Data API table access.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

comment on function public.request_beta_access(text) is
  'Accepts a normalized private-beta request without revealing allowlist state.';
comment on function public.hook_before_user_created(jsonb) is
  'Supabase Before User Created hook: permits only approved beta_access emails.';

-- Extend the existing post-create provisioning trigger so an approved auth
-- user is linked to the private-beta row that admitted the signup. The
-- profile/category provisioning remains intentionally unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.beta_access
  set user_id = new.id
  where email = lower(btrim(new.email))
    and status = 'approved'
    and user_id is null;

  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;

  insert into public.categories (
    user_id,
    name,
    kind,
    icon,
    color,
    is_system,
    sort_order
  )
  values
    (new.id, 'Rent & Housing', 'expense', 'home', '#7c3aed', true, 10),
    (new.id, 'Food & Dining', 'expense', 'utensils', '#f97316', true, 20),
    (new.id, 'Groceries', 'expense', 'shopping-basket', '#16a34a', true, 30),
    (new.id, 'Utilities', 'expense', 'zap', '#2563eb', true, 40),
    (new.id, 'Transport', 'expense', 'car', '#0891b2', true, 50),
    (new.id, 'Health', 'expense', 'heart-pulse', '#e11d48', true, 60),
    (new.id, 'Insurance', 'expense', 'shield', '#0f766e', true, 70),
    (new.id, 'Shopping', 'expense', 'shopping-bag', '#db2777', true, 80),
    (new.id, 'Entertainment', 'expense', 'clapperboard', '#9333ea', true, 90),
    (new.id, 'Education', 'expense', 'book-open', '#ca8a04', true, 100),
    (new.id, 'Personal Care', 'expense', 'sparkles', '#c026d3', true, 110),
    (new.id, 'Travel', 'expense', 'plane', '#0284c7', true, 120),
    (new.id, 'EMI & Loans', 'expense', 'landmark', '#475569', true, 130),
    (new.id, 'Taxes', 'expense', 'receipt-text', '#b91c1c', true, 140),
    (new.id, 'Gifts & Donations', 'expense', 'gift', '#be123c', true, 150),
    (new.id, 'Salary', 'income', 'banknote', '#047857', true, 210),
    (new.id, 'Freelance', 'income', 'briefcase-business', '#15803d', true, 220),
    (new.id, 'Interest', 'income', 'percent', '#0f766e', true, 230),
    (new.id, 'Dividends', 'income', 'chart-no-axes-combined', '#166534', true, 240),
    (new.id, 'Refunds', 'income', 'undo-2', '#65a30d', true, 250),
    (new.id, 'Other Income', 'income', 'plus-circle', '#15803d', true, 260);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
comment on function public.handle_new_user() is
  'Links approved private-beta access and creates a profile plus one initial set of private categories.';
