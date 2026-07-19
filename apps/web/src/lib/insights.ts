'use client';

import { buildFinancialDigest, computeTax, createAnthropicSseParser } from '@finmanager/core';
import {
  AiInsightsErrorSchema,
  type Account,
  type AiSummary,
  type Budget,
  type Category,
  type ChatMessage,
  type FinancialDigest,
  type FireSettings,
  type Goal,
  type Holding,
  type HoldingEvent,
  type InsightScope,
  type Transaction,
  type Valuation,
} from '@finmanager/schema';
import {
  ACCOUNTS_QUERY,
  AI_SUMMARIES_QUERY,
  BUDGETS_QUERY,
  CATEGORIES_QUERY,
  FIRE_SETTINGS_QUERY,
  GOALS_QUERY,
  HOLDING_EVENTS_QUERY,
  HOLDINGS_QUERY,
  SCENARIOS_QUERY,
  TRANSACTIONS_QUERY,
  VALUATIONS_QUERY,
  mapAccountRows,
  mapAiSummaryRows,
  mapBudgetRows,
  mapCategoryRows,
  mapFireSettingsRows,
  mapGoalRows,
  mapHoldingEventRows,
  mapHoldingRows,
  mapScenarioRows,
  mapTransactionRows,
  mapValuationRows,
  saveAiSummary,
  toTaxInput,
  type Scenario,
} from '@finmanager/sync';
import { usePowerSync, useQuery, useStatus } from '@powersync/react';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/components/providers';

function rows<T>(value: readonly T[] | undefined): readonly Record<string, unknown>[] {
  return (value ?? []) as unknown as readonly Record<string, unknown>[];
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function responseError(response: Response): Promise<Error> {
  try {
    const parsed = AiInsightsErrorSchema.safeParse(await response.json());
    if (parsed.success)
      return Object.assign(new Error(parsed.data.message), { code: parsed.data.error });
  } catch {
    // Fall through to the friendly generic error.
  }
  return new Error('AI Insights is temporarily unavailable. Please try again.');
}

export interface InsightsApi {
  readonly loading: boolean;
  readonly online: boolean;
  readonly canChat: boolean;
  readonly summaries: readonly AiSummary[];
  readonly latestSummary: AiSummary | null;
  readonly buildDigest: (scope: InsightScope) => FinancialDigest;
  readonly sendMessage: (
    question: string,
    scope: InsightScope,
    history: readonly ChatMessage[],
    onDelta: (text: string) => void,
  ) => Promise<string>;
  readonly generateMonthlySummary: (onDelta?: (text: string) => void) => Promise<string>;
}

export function useInsights(): InsightsApi {
  const db = usePowerSync();
  const status = useStatus();
  const { session } = useAuth();
  const accountRows = useQuery<Account>(ACCOUNTS_QUERY);
  const categoryRows = useQuery<Category>(CATEGORIES_QUERY);
  const transactionRows = useQuery<Transaction>(TRANSACTIONS_QUERY);
  const budgetRows = useQuery<Budget>(BUDGETS_QUERY);
  const holdingRows = useQuery<Holding>(HOLDINGS_QUERY);
  const eventRows = useQuery<HoldingEvent>(HOLDING_EVENTS_QUERY);
  const valuationRows = useQuery<Valuation>(VALUATIONS_QUERY);
  const goalRows = useQuery<Goal>(GOALS_QUERY);
  const fireRows = useQuery<FireSettings>(FIRE_SETTINGS_QUERY);
  const scenarioRows = useQuery<Scenario>(SCENARIOS_QUERY);
  const summaryRows = useQuery<AiSummary>(AI_SUMMARIES_QUERY);

  const loading = [
    accountRows.data,
    categoryRows.data,
    transactionRows.data,
    budgetRows.data,
    holdingRows.data,
    eventRows.data,
    valuationRows.data,
    goalRows.data,
    fireRows.data,
    scenarioRows.data,
    summaryRows.data,
  ].some((data) => data === undefined);

  const data = useMemo(() => {
    const scenarios = mapScenarioRows(
      rows(scenarioRows.data) as unknown as readonly {
        id: string;
        name: string;
        input: string | null;
      }[],
    );
    const selected = scenarios[0];
    const comparison = selected ? computeTax(toTaxInput(selected.input)) : null;
    const recommended = comparison ? comparison[comparison.better] : null;
    return {
      accounts: mapAccountRows(rows(accountRows.data)),
      categories: mapCategoryRows(rows(categoryRows.data)),
      transactions: mapTransactionRows(rows(transactionRows.data)),
      budgets: mapBudgetRows(rows(budgetRows.data)),
      holdings: mapHoldingRows(rows(holdingRows.data)),
      events: mapHoldingEventRows(rows(eventRows.data)),
      valuations: mapValuationRows(rows(valuationRows.data)),
      goals: mapGoalRows(rows(goalRows.data)),
      fireSettings: mapFireSettingsRows(rows(fireRows.data)),
      tax:
        comparison && recommended
          ? {
              financialYear: comparison.fy,
              preferredRegime: comparison.better,
              taxableIncome: recommended.taxableIncome,
              taxPayable: recommended.totalTax,
              monthlyInHand: recommended.monthlyInHand,
            }
          : null,
      summaries: mapAiSummaryRows(rows(summaryRows.data)),
    };
  }, [
    accountRows.data,
    budgetRows.data,
    categoryRows.data,
    eventRows.data,
    fireRows.data,
    goalRows.data,
    holdingRows.data,
    scenarioRows.data,
    summaryRows.data,
    transactionRows.data,
    valuationRows.data,
  ]);

  const buildDigest = useCallback(
    (scope: InsightScope) =>
      buildFinancialDigest(scope, {
        ...data,
        month: currentMonth(),
      }),
    [data],
  );

  const stream = useCallback(
    async (payload: Record<string, unknown>, onDelta: (text: string) => void): Promise<string> => {
      if (!session?.access_token) throw new Error('Sign in to use AI Insights.');
      if (!status.connected || !navigator.onLine) {
        throw Object.assign(
          new Error('Connect to the internet to chat. Your saved summary is still available.'),
          {
            code: 'offline',
          },
        );
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-insights`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw await responseError(response);
      if (!response.body) throw new Error('AI Insights returned an empty response.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createAnthropicSseParser();
      let answer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const delta of parser.push(decoder.decode(value, { stream: true }))) {
          answer += delta;
          onDelta(delta);
        }
      }
      for (const delta of parser.push(decoder.decode() + '\n')) {
        answer += delta;
        onDelta(delta);
      }
      if (!answer.trim()) throw new Error('AI Insights returned no text. Please try again.');
      return answer;
    },
    [session, status],
  );

  const sendMessage = useCallback(
    (
      question: string,
      scope: InsightScope,
      history: readonly ChatMessage[],
      onDelta: (text: string) => void,
    ) =>
      stream(
        {
          mode: 'chat',
          scope,
          question,
          digest: buildDigest(scope),
          history: history.slice(-10),
        },
        onDelta,
      ),
    [buildDigest, stream],
  );

  const generateMonthlySummary = useCallback(
    async (onDelta: (text: string) => void = () => undefined) => {
      const content = await stream(
        {
          mode: 'monthly_summary',
          scope: 'everything',
          digest: buildDigest('everything'),
          history: [],
        },
        onDelta,
      );
      if (!session?.user.id) throw new Error('Sign in to save your monthly summary.');
      await saveAiSummary(db, session.user.id, {
        month: currentMonth(),
        scope: 'everything',
        content,
        generatedAt: new Date().toISOString(),
      });
      return content;
    },
    [buildDigest, db, session, stream],
  );

  const latestSummary =
    data.summaries.find((summary) => summary.scope === 'everything') ?? data.summaries[0] ?? null;

  return {
    loading,
    online: status.connected,
    canChat: Boolean(session && status.connected),
    summaries: data.summaries,
    latestSummary,
    buildDigest,
    sendMessage,
    generateMonthlySummary,
  };
}
