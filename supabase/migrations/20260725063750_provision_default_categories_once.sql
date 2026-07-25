-- Provision default categories exactly once, as part of auth-user creation.
--
-- Before this migration both clients called seedDefaultCategories from a React
-- effect. Concurrent mounts could run SELECT-then-INSERT races, and subsequent
-- mounts recreated defaults that a user had intentionally renamed or deleted.
--
-- Existing users are deduplicated but are not backfilled: a missing category
-- may represent an intentional deletion. New users receive one private copy of
-- each default from the existing on_auth_user_created trigger.

-- Map every redundant system category to the oldest copy for the same user,
-- name and kind. Custom categories are deliberately excluded.
create temporary table category_dedup_map
on commit drop
as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by user_id, name, kind
      order by created_at, id
    ) as keeper_id,
    row_number() over (
      partition by user_id, name, kind
      order by created_at, id
    ) as duplicate_rank
  from public.categories
  where is_system
)
select id as duplicate_id, keeper_id
from ranked
where duplicate_rank > 1;

-- Duplicate categories can create budget-key collisions after their references
-- are consolidated. Keep the most recently updated budget in each resulting
-- user/category/period group before moving the remaining references.
create temporary table duplicate_budget_ids
on commit drop
as
with normalized as (
  select
    b.id,
    coalesce(m.keeper_id, b.category_id) as target_category_id,
    row_number() over (
      partition by
        b.user_id,
        coalesce(m.keeper_id, b.category_id),
        b.period,
        b.period_start
      order by b.updated_at desc, b.created_at desc, b.id
    ) as budget_rank
  from public.budgets b
  left join category_dedup_map m on m.duplicate_id = b.category_id
  where m.duplicate_id is not null
    or exists (
      select 1
      from category_dedup_map affected
      where affected.keeper_id = b.category_id
    )
)
select id
from normalized
where budget_rank > 1;

delete from public.budgets b
using duplicate_budget_ids d
where b.id = d.id;

update public.transactions t
set category_id = m.keeper_id
from category_dedup_map m
where t.category_id = m.duplicate_id;

update public.budgets b
set category_id = m.keeper_id
from category_dedup_map m
where b.category_id = m.duplicate_id;

update public.categories child
set parent_id = m.keeper_id
from category_dedup_map m
where child.parent_id = m.duplicate_id;

delete from public.categories c
using category_dedup_map m
where c.id = m.duplicate_id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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

-- Trigger execution does not require callers to execute this security-definer
-- function directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

comment on function public.handle_new_user() is
  'Creates a profile and one initial set of private categories for each new auth user.';
