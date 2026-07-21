const baseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.AI_USAGE_TEST_USER_ID;

if (!baseUrl || !serviceRoleKey || !userId) {
  throw new Error(
    'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AI_USAGE_TEST_USER_ID to run this integration test.',
  );
}

const month = new Date().toISOString().slice(0, 7);
const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
};
const increments = 8;
const inputTokens = 10;
const outputTokens = 20;
const requestCount = 1;
let successfulIncrements = 0;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function usage() {
  const rows = await request(
    `/rest/v1/ai_usage?select=input_tokens,output_tokens,request_count&user_id=eq.${userId}&month=eq.${month}`,
  );
  return rows[0] ?? { input_tokens: 0, output_tokens: 0, request_count: 0 };
}

const before = await usage();
try {
  const results = await Promise.allSettled(
    Array.from({ length: increments }, () =>
      request('/rest/v1/rpc/record_ai_usage', {
        method: 'POST',
        body: JSON.stringify({
          p_user_id: userId,
          p_month: month,
          p_input_tokens: inputTokens,
          p_output_tokens: outputTokens,
          p_request_count: requestCount,
          p_budget_tokens: 1_000_000_000,
          p_enforce_budget: false,
        }),
      }),
    ),
  );
  successfulIncrements = results.filter(
    (result) => result.status === 'fulfilled' && result.value === true,
  ).length;
  if (successfulIncrements !== increments) {
    throw new Error(`Expected every concurrent increment to succeed: ${JSON.stringify(results)}`);
  }

  const delta = {
    input_tokens: successfulIncrements * inputTokens,
    output_tokens: successfulIncrements * outputTokens,
    request_count: successfulIncrements * requestCount,
  };
  const after = await usage();
  for (const [key, expectedDelta] of Object.entries(delta)) {
    const actualDelta = Number(after[key]) - Number(before[key]);
    if (actualDelta !== expectedDelta) {
      throw new Error(`Lost update for ${key}: expected ${expectedDelta}, got ${actualDelta}`);
    }
  }
  console.log(`PASS: ${increments} concurrent AI usage increments were aggregated atomically.`);
} finally {
  if (successfulIncrements > 0) {
    await request('/rest/v1/rpc/record_ai_usage', {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: userId,
        p_month: month,
        p_input_tokens: -successfulIncrements * inputTokens,
        p_output_tokens: -successfulIncrements * outputTokens,
        p_request_count: -successfulIncrements * requestCount,
        p_budget_tokens: 0,
        p_enforce_budget: false,
      }),
    });
  }
}
