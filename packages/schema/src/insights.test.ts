import { describe, expect, it } from 'vitest';

import {
  AiInsightsRequestSchema,
  AiSummarySchema,
  ChatMessageSchema,
  FinancialDigestSchema,
  InsightScopeSchema,
} from './insights';

describe('InsightScopeSchema', () => {
  it('accepts every supported insight scope', () => {
    expect(
      ['everything', 'expenses', 'budget', 'portfolio', 'goals', 'tax'].map((scope) =>
        InsightScopeSchema.parse(scope),
      ),
    ).toHaveLength(6);
  });

  it('rejects unsupported scopes', () => {
    expect(() => InsightScopeSchema.parse('retirement')).toThrow();
  });
});

describe('FinancialDigestSchema', () => {
  it('accepts a compact scope-filtered digest', () => {
    const digest = FinancialDigestSchema.parse({
      version: 1,
      scope: 'budget',
      month: '2026-07',
      generatedAt: '2026-07-19T12:00:00.000Z',
      budget: {
        hasData: true,
        totalBudget: 20_000,
        totalSpent: 17_500,
        overspentCount: 1,
        categories: [{ name: 'Food', budget: 5_000, actual: 6_000, status: 'overspent' }],
      },
      missingSections: [],
    });

    expect(digest.scope).toBe('budget');
    expect(digest.expenses).toBeUndefined();
  });

  it('requires YYYY-MM month keys', () => {
    expect(() =>
      FinancialDigestSchema.parse({
        version: 1,
        scope: 'everything',
        month: 'July 2026',
        generatedAt: '2026-07-19T12:00:00.000Z',
        missingSections: [],
      }),
    ).toThrow();
  });
});

describe('AI insight payloads', () => {
  const digest = {
    version: 1 as const,
    scope: 'expenses' as const,
    month: '2026-07',
    generatedAt: '2026-07-19T12:00:00.000Z',
    expenses: {
      hasData: false,
      debit: null,
      credit: null,
      net: null,
      transactionCount: 0,
      topCategories: [],
      monthlyTrend: [],
    },
    missingSections: ['expenses'] as const,
  };

  it('validates chat history and requests', () => {
    expect(ChatMessageSchema.parse({ role: 'user', content: 'How am I doing?' }).role).toBe('user');
    expect(
      AiInsightsRequestSchema.parse({
        mode: 'chat',
        scope: 'expenses',
        question: 'How am I doing?',
        digest,
        history: [],
      }).question,
    ).toBe('How am I doing?');
  });

  it('requires a question in chat mode', () => {
    expect(() =>
      AiInsightsRequestSchema.parse({ mode: 'chat', scope: 'expenses', digest }),
    ).toThrow();
  });

  it('parses persisted monthly summaries', () => {
    const summary = AiSummarySchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      month: '2026-07',
      scope: 'everything',
      content: 'Spending is within plan.',
      generatedAt: '2026-07-19T12:00:00.000Z',
    });
    expect(summary.content).toContain('within plan');
  });
});
