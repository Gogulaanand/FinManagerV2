-- FinManager V2 - Phase 6: explicit monthly investment for FIRE projections.
-- Additive; fire_settings already exists with RLS from the base data model.

alter table public.fire_settings
  add column if not exists monthly_investment double precision;
