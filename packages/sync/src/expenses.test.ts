import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it } from 'vitest';

import type { Transaction } from '@finmanager/schema';

import { commitCsvImport, materializeRecurringTransactions, saveTransaction } from './expenses';

interface Statement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    accountId: '33333333-3333-4333-8333-333333333333',
    categoryId: '44444444-4444-4444-8444-444444444444',
    amount: 500,
    direction: 'debit',
    currency: 'INR',
    occurredOn: '2026-07-01',
    note: null,
    merchant: 'Rent',
    isRecurring: false,
    recurringId: null,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndOn: null,
    recurrenceGeneratedThrough: null,
    importHash: null,
    occurrenceKey: null,
    ...overrides,
  };
}

function fakeDb(
  options: {
    readonly updateRowsAffected?: number;
    readonly existingTransactionIds?: readonly string[];
    readonly existingOccurrenceKeys?: readonly string[];
    readonly existingImportHashes?: readonly string[];
  } = {},
): AbstractPowerSyncDatabase & { readonly statements: Statement[] } {
  const statements: Statement[] = [];
  const db = {
    statements,
    execute: async (sql: string, params: readonly unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.startsWith('UPDATE')) return { rowsAffected: options.updateRowsAffected ?? 0 };
      if (sql.startsWith('SELECT occurrence_key')) {
        return {
          rows: (options.existingOccurrenceKeys ?? []).map((occurrence_key) => ({
            occurrence_key,
          })),
          rowsAffected: 0,
        };
      }
      if (sql.startsWith('SELECT id FROM transactions WHERE id')) {
        return {
          rows: (options.existingTransactionIds ?? []).includes(String(params[0]))
            ? [{ id: String(params[0]) }]
            : [],
          rowsAffected: 0,
        };
      }
      if (sql.startsWith('SELECT id FROM transactions')) {
        return {
          rows: (options.existingImportHashes ?? []).includes(String(params[1]))
            ? [{ id: 'existing' }]
            : [],
          rowsAffected: 0,
        };
      }
      return { rows: [], rowsAffected: 0 };
    },
  } as unknown as AbstractPowerSyncDatabase & { readonly statements: Statement[] };
  return db;
}

describe('expense repositories', () => {
  it('checks existence then updates an existing row without inserting', async () => {
    const txId = '11111111-1111-4111-8111-111111111111';
    const db = fakeDb({ existingTransactionIds: [txId] });
    await saveTransaction(db, '22222222-2222-4222-8222-222222222222', transaction());
    expect(db.statements[0]?.sql).toMatch(/^SELECT id FROM transactions WHERE id/);
    expect(db.statements[1]?.sql).toMatch(/^UPDATE transactions/);
    expect(db.statements.some((statement) => statement.sql.includes('ON CONFLICT'))).toBe(false);
    expect(db.statements.filter((statement) => statement.sql.startsWith('INSERT')).length).toBe(0);
  });

  it('does not materialize an occurrence whose occurrence_key already exists', async () => {
    const db = fakeDb({
      existingOccurrenceKeys: ['66666666-6666-4666-8666-666666666666:2026-07-15'],
    });
    const result = await materializeRecurringTransactions(
      db,
      '22222222-2222-4222-8222-222222222222',
      transaction({
        id: '55555555-5555-4555-8555-555555555555',
        occurredOn: '2026-06-15',
        isRecurring: true,
        recurringId: '66666666-6666-4666-8666-666666666666',
        recurrenceFrequency: 'monthly',
        recurrenceInterval: 1,
        recurrenceEndOn: null,
        recurrenceGeneratedThrough: '2026-06-01',
      }),
      '2026-07',
    );
    expect(result.created).toBe(0);
  });

  it('deduplicates CSV rows by import hash before writing', async () => {
    const db = fakeDb({ existingImportHashes: ['bank-row-2'] });
    const row = {
      sourceRow: 2,
      error: null,
      accountId: '33333333-3333-4333-8333-333333333333',
      categoryId: '44444444-4444-4444-8444-444444444444',
      amount: 250,
      direction: 'debit' as const,
      currency: 'INR' as const,
      occurredOn: '2026-07-10',
      note: 'Statement row',
      merchant: 'Market',
      importHash: 'bank-row-1',
    };
    const result = await commitCsvImport(db, '22222222-2222-4222-8222-222222222222', [
      row,
      { ...row, sourceRow: 3, importHash: 'bank-row-2' },
      { ...row, sourceRow: 4 },
    ]);
    expect(result).toEqual({ created: 1, skipped: 2, failed: 0 });
    expect(
      db.statements.filter((statement) => statement.sql.startsWith('INSERT INTO transactions'))
        .length,
    ).toBe(1);
  });
});
