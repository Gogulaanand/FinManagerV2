-- Repo-wide improvements: make AI allowance accounting atomic.

create or replace function public.record_ai_usage(
  p_user_id uuid,
  p_month text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_request_count bigint,
  p_budget_tokens bigint,
  p_enforce_budget boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recorded boolean;
  updated_rows integer;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
     or p_input_tokens < 0 and p_enforce_budget
     or p_output_tokens < 0 and p_enforce_budget
     or p_request_count < 0 and p_enforce_budget then
    raise exception 'invalid ai usage increment';
  end if;

  if p_enforce_budget then
    insert into public.ai_usage (
      user_id, month, input_tokens, output_tokens, request_count, updated_at
    )
    select p_user_id, p_month, p_input_tokens, p_output_tokens, p_request_count, now()
    where p_input_tokens + p_output_tokens <= p_budget_tokens
    on conflict (user_id, month) do update set
      input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
      output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
      request_count = public.ai_usage.request_count + excluded.request_count,
      updated_at = now()
    where public.ai_usage.input_tokens + public.ai_usage.output_tokens
      + excluded.input_tokens + excluded.output_tokens <= p_budget_tokens
    returning true into recorded;
    return coalesce(recorded, false);
  end if;

  if p_input_tokens < 0 or p_output_tokens < 0 or p_request_count < 0 then
    update public.ai_usage
    set input_tokens = input_tokens + p_input_tokens,
        output_tokens = output_tokens + p_output_tokens,
        request_count = request_count + p_request_count,
        updated_at = now()
    where user_id = p_user_id
      and month = p_month
      and input_tokens + p_input_tokens >= 0
      and output_tokens + p_output_tokens >= 0
      and request_count + p_request_count >= 0;
    get diagnostics updated_rows = row_count;
    if updated_rows = 0 then
      raise exception 'ai usage release exceeds recorded usage';
    end if;
    return true;
  end if;

  insert into public.ai_usage (
    user_id, month, input_tokens, output_tokens, request_count, updated_at
  )
  values (p_user_id, p_month, p_input_tokens, p_output_tokens, p_request_count, now())
  on conflict (user_id, month) do update set
    input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
    output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
    request_count = public.ai_usage.request_count + excluded.request_count,
    updated_at = now();
  return true;
end;
$$;

revoke all on function public.record_ai_usage(uuid, text, bigint, bigint, bigint, bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, text, bigint, bigint, bigint, bigint, boolean)
  to service_role;
