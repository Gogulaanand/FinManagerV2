-- Existing assumptions require deliberate owner review; never infer investability from net worth.
alter table public.fire_settings
  add column investable_corpus double precision
    check (investable_corpus >= 0 and investable_corpus < 'Infinity'::double precision),
  add column expenses_confirmed boolean default false;
