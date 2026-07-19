import { describe, expect, it } from 'vitest';

import { FireSettingsSchema, GoalSchema } from './goals';

describe('GoalSchema', () => {
  it('applies defaults for optional fields', () => {
    const goal = GoalSchema.parse({
      name: 'Child education',
      kind: 'education',
      targetAmount: 2_000_000,
    });
    expect(goal.currentAmount).toBe(0);
    expect(goal.targetDate).toBeNull();
    expect(goal.expectedReturn).toBeNull();
    expect(goal.inflation).toBeNull();
    expect(goal.linkedHoldingIds).toEqual([]);
    expect(goal.notes).toBeNull();
  });

  it('accepts linked holding ids as uuids', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const goal = GoalSchema.parse({
      name: 'Foreign studies',
      kind: 'foreign_studies',
      targetAmount: 5_000_000,
      targetDate: '2035-06-01',
      currentAmount: 500_000,
      expectedReturn: 12,
      inflation: 6,
      linkedHoldingIds: [id],
    });
    expect(goal.linkedHoldingIds).toEqual([id]);
  });

  it('rejects unknown kinds', () => {
    expect(() => GoalSchema.parse({ name: 'x', kind: 'vacation', targetAmount: 1 })).toThrow();
  });

  it('rejects a negative target amount', () => {
    expect(() => GoalSchema.parse({ name: 'x', kind: 'custom', targetAmount: -1 })).toThrow();
  });

  it('rejects an expected return above 100 percent', () => {
    expect(() =>
      GoalSchema.parse({ name: 'x', kind: 'custom', targetAmount: 1, expectedReturn: 150 }),
    ).toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() =>
      GoalSchema.parse({ name: 'x', kind: 'custom', targetAmount: 1, extra: true }),
    ).toThrow();
  });
});

describe('FireSettingsSchema', () => {
  it('defaults the withdrawal rate to four percent', () => {
    const settings = FireSettingsSchema.parse({});
    expect(settings.withdrawalRate).toBe(4);
    expect(settings.annualExpenses).toBeNull();
    expect(settings.leanMultiplier).toBeNull();
    expect(settings.fatMultiplier).toBeNull();
    expect(settings.monthlyInvestment).toBeNull();
  });

  it('accepts a complete configuration', () => {
    const settings = FireSettingsSchema.parse({
      annualExpenses: 1_200_000,
      withdrawalRate: 3.5,
      expectedReturn: 10,
      inflation: 6,
      currentAge: 32,
      retirementAge: 50,
      leanMultiplier: 0.7,
      fatMultiplier: 1.5,
      monthlyInvestment: 50_000,
    });
    expect(settings.retirementAge).toBe(50);
    expect(settings.fatMultiplier).toBe(1.5);
    expect(settings.monthlyInvestment).toBe(50_000);
  });

  it('rejects a retirement age before the current age', () => {
    expect(() => FireSettingsSchema.parse({ currentAge: 40, retirementAge: 30 })).toThrow();
  });

  it('rejects a fat multiplier below the lean multiplier', () => {
    expect(() => FireSettingsSchema.parse({ leanMultiplier: 1.2, fatMultiplier: 0.8 })).toThrow();
  });
});
