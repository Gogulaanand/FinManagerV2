-- PowerSync source-database setup for Supabase.
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard -> SQL Editor), after the
-- migrations in supabase/migrations have been applied. It creates the dedicated
-- replication role PowerSync connects as, and the publication it reads from.
--
-- IMPORTANT: replace <POWERSYNC_ROLE_PASSWORD> below with a strong password, and
-- use the SAME password in the PowerSync dashboard when configuring the database
-- connection. Do NOT commit the real password - this file ships a placeholder.
-- (This step lives here, not in a migration, because it creates a login role
-- with a credential and is environment setup, not schema.)

-- BYPASSRLS so the replication role can read every row for the WAL. What each
-- client actually receives is scoped by the Sync Streams (sync-rules.yaml), not
-- by this role.
create role powersync_role with replication bypassrls login password '<POWERSYNC_ROLE_PASSWORD>';

-- Read-only access, including to any tables added by future migrations.
grant select on all tables in schema public to powersync_role;
alter default privileges in schema public grant select on tables to powersync_role;

-- The publication PowerSync replicates from. It must be named exactly "powersync".
create publication powersync for all tables;
