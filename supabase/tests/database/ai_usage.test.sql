begin;

set local search_path = extensions, public;

select extensions.plan(4);

select extensions.has_table(
  'public',
  'ai_usage',
  'the AI usage table exists'
);

select extensions.has_function(
  'public',
  'record_ai_usage',
  array['uuid', 'text', 'bigint', 'bigint', 'bigint', 'bigint', 'boolean'],
  'the atomic AI usage RPC exists with the expected signature'
);

select extensions.function_returns(
  'public',
  'record_ai_usage',
  array['uuid', 'text', 'bigint', 'bigint', 'bigint', 'bigint', 'boolean'],
  'boolean',
  'the usage RPC returns an admission result'
);

select extensions.is_definer(
  'public',
  'record_ai_usage',
  array['uuid', 'text', 'bigint', 'bigint', 'bigint', 'bigint', 'boolean'],
  'the usage RPC runs with security definer privileges'
);

select * from extensions.finish();
rollback;
