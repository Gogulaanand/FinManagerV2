import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it } from 'vitest';

import type { FireSettings, Goal } from '@finmanager/schema';

import { mapFireSettingsRows, mapGoalRows, saveFireSettings, saveGoal } from './goals';

const userId = '22222222-2222-4222-8222-222222222222';
const goalId = '33333333-3333-4333-8333-333333333333';
const holdingId = '44444444-4444-4444-8444-444444444444';

function fakeDb(selectRows: unknown[] = []) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const db = {
    statements,
    execute: async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.startsWith('SELECT')) return { rows: selectRows };
      return { rows: [], rowsAffected: 1 };
    },
    writeTransaction: async <T>(callback: (tx: { execute: typeof db.execute }) => Promise<T>) =>
      callback(db),
  } as unknown as AbstractPowerSyncDatabase & {
    readonly statements: { sql: string; params: unknown[] }[];
  };
  return db;
}

describe('goal mappers', () => {
  it('parses a goal row and its linked holding ids', () => {
    const [goal] = mapGoalRows([
      {
        id: goalId,
        user_id: userId,
        name: 'Child education',
        kind: 'education',
        target_amount: 2_000_000,
        target_date: '2035-06-01',
        current_amount: 500_000,
        expected_return: 12,
        inflation: 6,
        linked_holding_ids: JSON.stringify([holdingId]),
        notes: null,
      },
    ]);
    expect(goal?.name).toBe('Child education');
    expect(goal?.linkedHoldingIds).toEqual([holdingId]);
    expect(goal?.targetAmount).toBe(2_000_000);
  });

  it('defaults missing linked holding ids to an empty array', () => {
    const [goal] = mapGoalRows([
      {
        id: goalId,
        user_id: userId,
        name: 'x',
        kind: 'custom',
        target_amount: 1,
        target_date: null,
        current_amount: 0,
        expected_return: null,
        inflation: null,
        linked_holding_ids: null,
        notes: null,
      },
    ]);
    expect(goal?.linkedHoldingIds).toEqual([]);
  });

  it('returns null fire settings when there is no row', () => {
    expect(mapFireSettingsRows([])).toBeNull();
  });

  it('parses a fire settings row', () => {
    const settings = mapFireSettingsRows([
      {
        id: goalId,
        user_id: userId,
        annual_expenses: 1_200_000,
        withdrawal_rate: 4,
        expected_return: 10,
        inflation: 6,
        current_age: 32,
        retirement_age: 50,
        lean_multiplier: 0.7,
        fat_multiplier: 1.5,
        monthly_investment: 45_000,
      },
    ]);
    expect(settings?.annualExpenses).toBe(1_200_000);
    expect(settings?.retirementAge).toBe(50);
    expect(settings?.monthlyInvestment).toBe(45_000);
  });
});

describe('goal repositories', () => {
  const goal: Goal = {
    id: goalId,
    userId,
    name: 'Marriage',
    kind: 'marriage',
    targetAmount: 1_500_000,
    targetDate: '2032-01-01',
    currentAmount: 200_000,
    expectedReturn: 12,
    inflation: 6,
    linkedHoldingIds: [holdingId],
    notes: null,
  };

  it('updates an existing goal and serialises linked holding ids to JSON', async () => {
    const db = fakeDb();
    await saveGoal(db, userId, goal);
    const update = db.statements.find((s) => s.sql.startsWith('UPDATE goals'));
    expect(update).toBeDefined();
    expect(update!.params).toContain(JSON.stringify([holdingId]));
  });

  it('inserts a new goal when it has no id', async () => {
    const db = fakeDb();
    await saveGoal(db, userId, { ...goal, id: undefined });
    expect(db.statements.some((s) => s.sql.startsWith('INSERT INTO goals'))).toBe(true);
  });

  it('updates fire settings in place when a row exists', async () => {
    const db = fakeDb([{ id: goalId }]);
    const settings: FireSettings = {
      userId,
      annualExpenses: 1_200_000,
      withdrawalRate: 4,
      expectedReturn: 10,
      inflation: 6,
      currentAge: 32,
      retirementAge: 50,
      leanMultiplier: 0.7,
      fatMultiplier: 1.5,
      monthlyInvestment: 45_000,
    };
    await saveFireSettings(db, userId, settings);
    expect(db.statements.some((s) => s.sql.startsWith('UPDATE fire_settings'))).toBe(true);
    expect(db.statements.some((s) => s.sql.startsWith('INSERT'))).toBe(false);
  });

  it('inserts fire settings when no row exists', async () => {
    const db = fakeDb([]);
    const settings: FireSettings = {
      userId,
      annualExpenses: null,
      withdrawalRate: 4,
      expectedReturn: null,
      inflation: null,
      currentAge: null,
      retirementAge: null,
      leanMultiplier: null,
      fatMultiplier: null,
      monthlyInvestment: null,
    };
    await saveFireSettings(db, userId, settings);
    expect(db.statements.some((s) => s.sql.startsWith('INSERT INTO fire_settings'))).toBe(true);
  });
});
