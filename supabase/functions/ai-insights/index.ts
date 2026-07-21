import { createClient } from 'npm:@supabase/supabase-js@2.110.7';

type InsightScope = 'everything' | 'expenses' | 'budget' | 'portfolio' | 'goals' | 'tax';
type RequestMode = 'chat' | 'monthly_summary';

interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

interface InsightsRequest {
  readonly mode: RequestMode;
  readonly scope: InsightScope;
  readonly question?: string;
  readonly digest: unknown;
  readonly history?: readonly ChatMessage[];
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const scopes = new Set<InsightScope>([
  'everything',
  'expenses',
  'budget',
  'portfolio',
  'goals',
  'tax',
]);

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function parseBudget(): number {
  const configured = Number(Deno.env.get('INSIGHTS_MONTHLY_TOKEN_BUDGET') ?? '1000000');
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1_000_000;
}

function parseRequest(value: unknown): InsightsRequest | null {
  if (!value || typeof value !== 'object') return null;
  const request = value as Record<string, unknown>;
  if (request.mode !== 'chat' && request.mode !== 'monthly_summary') return null;
  if (typeof request.scope !== 'string' || !scopes.has(request.scope as InsightScope)) return null;
  if (!request.digest || typeof request.digest !== 'object') return null;
  if (
    request.mode === 'chat' &&
    (typeof request.question !== 'string' || !request.question.trim())
  ) {
    return null;
  }
  const history = Array.isArray(request.history)
    ? request.history
        .filter(
          (message): message is ChatMessage =>
            Boolean(message) &&
            typeof message === 'object' &&
            ((message as ChatMessage).role === 'user' ||
              (message as ChatMessage).role === 'assistant') &&
            typeof (message as ChatMessage).content === 'string',
        )
        .slice(-10)
    : [];
  return {
    mode: request.mode,
    scope: request.scope as InsightScope,
    question: typeof request.question === 'string' ? request.question.trim() : undefined,
    digest: request.digest,
    history,
  };
}

const systemPrompt = `You are FinManager's grounded financial assistant for Indian personal finance.
Use only the supplied financial digest. Never invent a number or imply data exists when it is missing.
Format money in INR using Indian digit grouping. Be concise, practical, and clear about assumptions.
Mention the relevant real numbers in the answer. If a section is absent or marked as no data, say what is missing.
This is educational guidance, not regulated investment or tax advice.`;

function messagesFor(request: InsightsRequest): readonly Record<string, unknown>[] {
  const history = (request.history ?? []).map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const instruction =
    request.mode === 'monthly_summary'
      ? 'Write a short monthly financial health summary with the most important strength, risk, and next action.'
      : request.question!;
  return [
    ...history,
    {
      role: 'user',
      content: `${instruction}\n\nScope: ${request.scope}\nFinancial digest:\n${JSON.stringify(request.digest)}`,
    },
  ];
}

async function recordUsage(
  admin: ReturnType<typeof createClient>,
  userId: string,
  inputTokens: number,
  outputTokens: number,
  requestCount: number,
  budgetTokens: number,
  enforceBudget: boolean,
): Promise<boolean> {
  const { data, error } = await admin.rpc('record_ai_usage', {
    p_user_id: userId,
    p_month: monthKey(),
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_request_count: requestCount,
    p_budget_tokens: budgetTokens,
    p_enforce_budget: enforceBudget,
  });
  if (error) throw error;
  return data === true;
}

function meteredStream(
  body: ReadableStream<Uint8Array>,
  reservedInputTokens: number,
  reservedOutputTokens: number,
  onUsage: (inputTokens: number, outputTokens: number) => Promise<void>,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let settled = false;

  async function settle(actualInput: number, actualOutput: number): Promise<void> {
    if (settled) return;
    settled = true;
    await onUsage(actualInput - reservedInputTokens, actualOutput - reservedOutputTokens);
  }

  function inspect(text: string): void {
    pending += text;
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6)) as {
          readonly message?: { readonly usage?: { readonly input_tokens?: number } };
          readonly usage?: { readonly output_tokens?: number };
        };
        inputTokens = Math.max(inputTokens, Number(event.message?.usage?.input_tokens ?? 0));
        outputTokens = Math.max(outputTokens, Number(event.usage?.output_tokens ?? 0));
      } catch {
        // Ignore non-JSON SSE data such as keepalive frames.
      }
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        inspect(decoder.decode());
        const accounting = settle(inputTokens, outputTokens);
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(accounting);
        else await accounting;
        controller.close();
        return;
      }
      inspect(decoder.decode(value, { stream: true }));
      controller.enqueue(value);
    },
    cancel(reason) {
      const accounting = settle(0, 0);
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(accounting);
      return reader.cancel(reason);
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonError(405, 'invalid_request', 'Use POST.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !anthropicKey) {
    return jsonError(500, 'upstream', 'AI Insights is not configured yet.');
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonError(401, 'unauthorized', 'Sign in to use AI Insights.');
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonError(401, 'unauthorized', 'Your session expired. Please sign in again.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'The request body must be valid JSON.');
  }
  const insightsRequest = parseRequest(body);
  if (!insightsRequest) {
    return jsonError(400, 'invalid_request', 'Choose a valid scope and enter a question.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const messages = messagesFor(insightsRequest);
  const maxTokens = insightsRequest.mode === 'chat' ? 4096 : 1024;
  const reservedInputTokens = Math.max(1, Math.ceil(JSON.stringify(messages).length / 4));
  const reservedOutputTokens = maxTokens;
  let reserved = false;
  try {
    reserved = await recordUsage(
      admin,
      authData.user.id,
      reservedInputTokens,
      reservedOutputTokens,
      1,
      parseBudget(),
      true,
    );
  } catch {
    return jsonError(500, 'upstream', 'AI Insights metering is temporarily unavailable.');
  }
  if (!reserved) {
    return jsonError(
      429,
      'budget_exceeded',
      'Your AI Insights allowance is used for this month. Your saved summary remains available.',
    );
  }

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: insightsRequest.mode === 'chat' ? 4096 : 1024,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!anthropicResponse.ok || !anthropicResponse.body) {
    await recordUsage(
      admin,
      authData.user.id,
      -reservedInputTokens,
      -reservedOutputTokens,
      -1,
      0,
      false,
    );
    return jsonError(
      anthropicResponse.status >= 400 && anthropicResponse.status < 500
        ? anthropicResponse.status
        : 502,
      'upstream',
      'AI Insights is temporarily unavailable. Your financial data is still safe locally.',
    );
  }

  return new Response(
    meteredStream(
      anthropicResponse.body,
      reservedInputTokens,
      reservedOutputTokens,
      (inputTokens, outputTokens) =>
        recordUsage(admin, authData.user.id, inputTokens, outputTokens, 0, 0, false),
    ),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    },
  );
});
