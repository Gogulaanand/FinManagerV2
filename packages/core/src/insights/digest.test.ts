import {
  BudgetSchema,
  CategorySchema,
  FireSettingsSchema,
  GoalSchema,
  HoldingEventSchema,
  HoldingSchema,
  TransactionSchema,
} from '@finmanager/schema';
import { describe, expect, it } from 'vitest';

import { buildFinancialDigest } from './digest.js';

const foodId = '11111111-1111-4111-8111-111111111111';
const holdingId = '22222222-2222-4222-8222-222222222222';

const category = CategorySchema.parse({
  id: foodId,
  name: 'Food',
  kind: 'expense',
});
const transaction = TransactionSchema.parse({
  amount: 6_000,
  direction: 'debit',
  categoryId: foodId,
  occurredOn: '2026-07-18',
});
const budget = BudgetSchema.parse({
  categoryId: foodId,
  periodStart: '2026-07-01',
  amount: 5_000,
});
const holding = HoldingSchema.parse({
  id: holdingId,
  name: 'Reliance Industries',
  type: 'stock',
  quantity: 10,
  avgCost: 1_000,
  currentValue: 11_000,
});
const event = HoldingEventSchema.parse({
  holdingId,
  kind: 'buy',
  occurredOn: '2025-01-01',
  quantity: 10,
  price: 1_000,
  amount: -10_000,
});
const goal = GoalSchema.parse({
  name: 'Education',
  kind: 'education',
  targetAmount: 2_000_000,
  targetDate: '2030-07-19',
  currentAmount: 200_000,
});

const completeInput = {
  transactions: [transaction],
  categories: [category],
  budgets: [budget],
  holdings: [holding],
  events: [event],
  valuations: [],
  accounts: [],
  goals: [goal],
  fireSettings: FireSettingsSchema.parse({
    annualExpenses: 600_000,
    currentAge: 32,
    retirementAge: 50,
    monthlyInvestment: 50_000,
  }),
  month: '2026-07',
  generatedAt: '2026-07-19T12:00:00.000Z',
};

describe('buildFinancialDigest', () => {
  it('composes existing analytics into a compact everything digest', () => {
    const digest = buildFinancialDigest('everything', completeInput);

    expect(digest.expenses).toMatchObject({ debit: 6_000, transactionCount: 1 });
    expect(digest.expenses?.topCategories[0]).toMatchObject({ name: 'Food', amount: 6_000 });
    expect(digest.budget?.categories[0]).toMatchObject({
      name: 'Food',
      budget: 5_000,
      actual: 6_000,
      status: 'overspent',
    });
    expect(digest.portfolio).toMatchObject({ currentValue: 11_000, gainLoss: 1_000 });
    expect(digest.goals?.goals[0]?.name).toBe('Education');
    expect(digest.missingSections).toEqual(['tax']);
    expect(JSON.stringify(digest).length).toBeLessThan(8_000);
  });

  it('includes only the section selected by a narrow scope', () => {
    const digest = buildFinancialDigest('budget', completeInput);

    expect(digest.budget).toBeDefined();
    expect(digest.expenses).toBeUndefined();
    expect(digest.portfolio).toBeUndefined();
    expect(digest.goals).toBeUndefined();
    expect(digest.tax).toBeUndefined();
  });

  it('uses explicit no-data signals instead of presenting absent values as zero', () => {
    const digest = buildFinancialDigest('everything', {
      transactions: [],
      categories: [],
      budgets: [],
      holdings: [],
      events: [],
      valuations: [],
      accounts: [],
      goals: [],
      fireSettings: null,
      month: '2026-07',
      generatedAt: '2026-07-19T12:00:00.000Z',
    });

    expect(digest.expenses).toMatchObject({
      hasData: false,
      debit: null,
      credit: null,
      net: null,
    });
    expect(digest.budget).toMatchObject({
      hasData: false,
      totalBudget: null,
      totalSpent: null,
    });
    expect(digest.portfolio).toMatchObject({ hasData: false, netWorth: null });
    expect(digest.goals).toMatchObject({ hasData: false, fire: null, retirementCorpus: null });
    expect(digest.missingSections).toEqual(['expenses', 'budget', 'portfolio', 'goals', 'tax']);
  });

  it('is deterministic when generatedAt is supplied', () => {
    expect(buildFinancialDigest('everything', completeInput)).toEqual(
      buildFinancialDigest('everything', completeInput),
    );
  });
});
