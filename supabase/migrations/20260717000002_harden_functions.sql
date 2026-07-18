-- Security hardening for the functions created in 20260717000001_full_data_model.sql.
-- Both are flagged by Supabase's security advisor.

-- 1. Pin an immutable search_path so the trigger function cannot be hijacked by a
--    caller-controlled search_path. It only needs now() (pg_catalog, always present).
alter function public.set_updated_at() set search_path = '';

-- 2. handle_new_user is SECURITY DEFINER and only ever runs as an auth.users trigger.
--    Trigger execution does not require the EXECUTE privilege, so revoking it removes
--    the exposed /rest/v1/rpc/handle_new_user surface without breaking signup.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
