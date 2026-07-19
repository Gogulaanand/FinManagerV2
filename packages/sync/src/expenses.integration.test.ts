import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it } from 'vitest';

import type { Budget, CsvImportRow } from '@finmanager/schema';

import {
  TRANSACTIONS_MONTH_COUNT_QUERY,
  TRANSACTIONS_MONTH_PAGE_QUERY,
  TRANSACTIONS_WINDOW_QUERY,
  commitCsvImport,
  ensureRecurringThrough,
  saveBudget,
} from './expenses';

interface Statement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

const userId = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const categoryId = '44444444-4444-4444-8444-444444444444';
const recurringId = '55555555-5555-4555-8555-555555555555';

function importRow(sourceRow: number, importHash: string): CsvImportRow {
  return {
    sourceRow,
    error: null,
    accountId,
    categoryId,
    amount: 250,
    direction: 'debit',
    currency: 'INR',
    occurredOn: '2026-07-10',
    note: 'Statement row',
    merchant: 'Market',
    importHash,
  };
}

function recurringSource() {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    user_id: userId,
    account_id: accountId,
    category_id: categoryId,
    amount: 500,
    direction: 'debit',
    currency: 'INR',
    occurred_on: '2026-05-31',
    note: null,
    merchant: 'Rent',
    is_recurring: 1,
    recurring_id: recurringId,
    recurrence_frequency: 'monthly',
    recurrence_interval: 1,
    recurrence_end_on: null,
    recurrence_generated_through: null,
    occurrence_key: null,
    import_hash: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  };
}

function fakeDb(initialRows: readonly Record<string, unknown>[] = []) {
  const state = new Map<string, Record<string, unknown>>(
    initialRows.map((row) => [String(row.id), { ...row }]),
  );
  const statements: Statement[] = [];
  const db = {
    statements,
    state,
    execute: async (sql: string, params: readonly unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.startsWith('SELECT id FROM transactions')) {
        const hash = String(params[1]);
        return { rows: [...state.values()].filter((row) => row.import_hash === hash) };
      }
      if (sql === TRANSACTIONS_WINDOW_QUERY) {
        const [start, endExclusive] = params.map(String);
        return {
          rows: [...state.values()]
            .filter(
              (row) => String(row.occurred_on) >= start! && String(row.occurred_on) < endExclusive!,
            )
            .sort((left, right) =>
              `${String(right.occurred_on)}:${String(right.created_at)}`.localeCompare(
                `${String(left.occurred_on)}:${String(left.created_at)}`,
              ),
            ),
        };
      }
      if (sql === TRANSACTIONS_MONTH_PAGE_QUERY) {
        const [start, endExclusive, limit] = params;
        return {
          rows: [...state.values()]
            .filter(
              (row) =>
                String(row.occurred_on) >= String(start) &&
                String(row.occurred_on) < String(endExclusive),
            )
            .sort((left, right) =>
              `${String(right.occurred_on)}:${String(right.created_at)}`.localeCompare(
                `${String(left.occurred_on)}:${String(left.created_at)}`,
              ),
            )
            .slice(0, Number(limit)),
        };
      }
      if (sql === TRANSACTIONS_MONTH_COUNT_QUERY) {
        const [start, endExclusive] = params;
        const count = [...state.values()].filter(
          (row) =>
            String(row.occurred_on) >= String(start) &&
            String(row.occurred_on) < String(endExclusive),
        ).length;
        return { rows: [{ count }] };
      }
      if (sql.startsWith('SELECT occurrence_key')) {
        const requestedRecurringId = String(params[1]);
        return {
          rows: [...state.values()]
            .filter((row) => row.recurring_id === requestedRecurringId && row.occurrence_key)
            .map((row) => ({ occurrence_key: row.occurrence_key })),
        };
      }
      if (sql.includes('WHERE is_recurring = 1')) {
        return {
          rows: [...state.values()].filter((row) => row.is_recurring === 1),
        };
      }
      if (sql.startsWith('SELECT id FROM budgets')) {
        return {
          rows: [...state.values()]
            .filter(
              (row) =>
                row.table === 'budget' &&
                row.user_id === params[0] &&
                row.category_id === params[1] &&
                row.period === params[2] &&
                row.period_start === params[3],
            )
            .map((row) => ({ id: row.id })),
        };
      }
      if (sql.startsWith('UPDATE transactions')) {
        if (params.length === 3 && state.has(String(params[2]))) {
          const row = state.get(String(params[2]))!;
          row.recurrence_generated_through = params[0];
          return { rowsAffected: 1 };
        }
        const id = String(params.at(-1));
        const row = state.get(id);
        if (!row) return { rowsAffected: 0 };
        row.account_id = params[0];
        row.category_id = params[1];
        row.amount = params[2];
        row.direction = params[3];
        row.occurred_on = params[5];
        row.is_recurring = params[8];
        row.recurring_id = params[9];
        row.occurrence_key = params[14];
        row.import_hash = params[15];
        return { rowsAffected: 1 };
      }
      if (sql.startsWith('UPDATE budgets')) {
        const id = String(params.at(-1));
        const row = state.get(id);
        if (!row) return { rowsAffected: 0 };
        row.category_id = params[0];
        row.period = params[1];
        row.period_start = params[2];
        row.amount = params[3];
        return { rowsAffected: 1 };
      }
      if (sql.startsWith('INSERT INTO transactions')) {
        const id = String(params[0]);
        state.set(id, {
          id,
          user_id: params[1],
          account_id: params[2],
          category_id: params[3],
          amount: params[4],
          direction: params[5],
          currency: params[6],
          occurred_on: params[7],
          note: params[8],
          merchant: params[9],
          is_recurring: params[10],
          recurring_id: params[11],
          recurrence_frequency: params[12],
          recurrence_interval: params[13],
          recurrence_end_on: params[14],
          recurrence_generated_through: params[15],
          occurrence_key: params[16],
          import_hash: params[17],
        });
        return { rowsAffected: 1 };
      }
      if (sql.startsWith('INSERT INTO budgets')) {
        const id = String(params[0]);
        state.set(id, {
          table: 'budget',
          id,
          user_id: params[1],
          category_id: params[2],
          period: params[3],
          period_start: params[4],
          amount: params[5],
        });
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0, rows: [] };
    },
  } as unknown as AbstractPowerSyncDatabase & {
    readonly statements: Statement[];
    readonly state: Map<string, Record<string, unknown>>;
  };
  return db;
}

describe('expense repository integration paths', () => {
  it('windows, orders, limits, and counts a large transaction set', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => {
      const month = index < 60 ? '07' : index < 100 ? '06' : '01';
      const day = String((index % 28) + 1).padStart(2, '0');
      return {
        id: `transaction-${String(index).padStart(3, '0')}`,
        occurred_on: `2026-${month}-${day}`,
        created_at: `2026-${month}-${day}T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      };
    });
    const db = fakeDb(rows);

    const window = await db.execute(TRANSACTIONS_WINDOW_QUERY, ['2026-02-01', '2026-08-01']);
    expect(window.rows?._array ?? window.rows).toHaveLength(100);
    const page = await db.execute(TRANSACTIONS_MONTH_PAGE_QUERY, ['2026-07-01', '2026-08-01', 50]);
    const pageRows = (page.rows?._array ?? page.rows) as readonly Record<string, unknown>[];
    expect(pageRows).toHaveLength(50);
    expect(pageRows[0]?.occurred_on).toBe('2026-07-28');
    const count = await db.execute(TRANSACTIONS_MONTH_COUNT_QUERY, ['2026-07-01', '2026-08-01']);
    const countRows = (count.rows?._array ?? count.rows) as readonly Record<string, unknown>[];
    expect(countRows[0]?.count).toBe(60);
  });

  it('imports the same CSV once and skips it on the second pass', async () => {
    const db = fakeDb();
    const rows = [importRow(2, 'bank-row-2'), importRow(3, 'bank-row-3')];
    await expect(commitCsvImport(db, userId, rows)).resolves.toEqual({
      created: 2,
      skipped: 0,
      failed: 0,
    });
    await expect(commitCsvImport(db, userId, rows)).resolves.toEqual({
      created: 0,
      skipped: 2,
      failed: 0,
    });
    expect([...db.state.values()].filter((row) => row.import_hash).length).toBe(2);
  });

  it('materializes a new month and does not recreate a deleted prior occurrence', async () => {
    const db = fakeDb([recurringSource()]);
    await expect(ensureRecurringThrough(db, userId, '2026-06')).resolves.toEqual({ created: 1 });
    const June = [...db.state.values()].find((row) => row.occurred_on === '2026-06-30');
    expect(June?.occurrence_key).toBe(`${recurringId}:2026-06-30`);
    db.state.delete(String(June?.id));
    await expect(ensureRecurringThrough(db, userId, '2026-07')).resolves.toEqual({ created: 1 });
    expect([...db.state.values()].filter((row) => row.occurred_on === '2026-06-30')).toHaveLength(
      0,
    );
    expect([...db.state.values()].filter((row) => row.occurred_on === '2026-07-31')).toHaveLength(
      1,
    );
  });

  it('updates a budget by its natural category-month key', async () => {
    const db = fakeDb([
      {
        table: 'budget',
        id: '77777777-7777-4777-8777-777777777777',
        user_id: userId,
        category_id: categoryId,
        period: 'monthly',
        period_start: '2026-07-01',
        amount: 100,
      },
    ]);
    const budget: Budget = {
      id: '88888888-8888-4888-8888-888888888888',
      userId,
      categoryId,
      period: 'monthly',
      periodStart: '2026-07-01',
      amount: 250,
    };
    await saveBudget(db, userId, budget);
    expect(db.state.get('77777777-7777-4777-8777-777777777777')?.amount).toBe(250);
    expect(db.statements.some((statement) => statement.sql.startsWith('INSERT INTO budgets'))).toBe(
      false,
    );
  });
});
