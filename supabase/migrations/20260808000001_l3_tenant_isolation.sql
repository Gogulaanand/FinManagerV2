-- L3.2: keep direct user-owned parent references inside the same tenant.
-- RLS protects the child row's user_id, but a plain UUID foreign key does not
-- prove that its parent belongs to that same user.

create unique index if not exists categories_id_user_uidx
  on public.categories (id, user_id);

do $$
begin
  if exists (
    select 1
    from public.categories child
    join public.categories parent on parent.id = child.parent_id
    where child.parent_id is not null
      and child.user_id <> parent.user_id
  ) then
    raise exception 'L3.2 preflight failed: categories have cross-owner parents';
  end if;

  if exists (
    select 1
    from public.transactions child
    join public.accounts parent on parent.id = child.account_id
    where child.account_id is not null
      and child.user_id <> parent.user_id
  ) then
    raise exception 'L3.2 preflight failed: transactions have cross-owner accounts';
  end if;

  if exists (
    select 1
    from public.transactions child
    join public.categories parent on parent.id = child.category_id
    where child.category_id is not null
      and child.user_id <> parent.user_id
  ) then
    raise exception 'L3.2 preflight failed: transactions have cross-owner categories';
  end if;

  if exists (
    select 1
    from public.budgets child
    join public.categories parent on parent.id = child.category_id
    where child.category_id is not null
      and child.user_id <> parent.user_id
  ) then
    raise exception 'L3.2 preflight failed: budgets have cross-owner categories';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_parent_same_user_fk'
  ) then
    alter table public.categories add constraint categories_parent_same_user_fk
      foreign key (parent_id, user_id)
      references public.categories (id, user_id)
      on delete set null (parent_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_account_same_user_fk'
  ) then
    alter table public.transactions add constraint transactions_account_same_user_fk
      foreign key (account_id, user_id)
      references public.accounts (id, user_id)
      on delete set null (account_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_category_same_user_fk'
  ) then
    alter table public.transactions add constraint transactions_category_same_user_fk
      foreign key (category_id, user_id)
      references public.categories (id, user_id)
      on delete set null (category_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'budgets_category_same_user_fk'
  ) then
    alter table public.budgets add constraint budgets_category_same_user_fk
      foreign key (category_id, user_id)
      references public.categories (id, user_id)
      on delete cascade;
  end if;
end
$$;
