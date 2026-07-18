import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it } from 'vitest';

import type { Holding, HoldingEvent, PortfolioImportRow } from '@finmanager/schema';

import {
  commitPortfolioImport,
  mapHoldingEventRows,
  mapHoldingRows,
  saveHolding,
} from './portfolio';

const userId = '22222222-2222-4222-8222-222222222222';
const holdingId = '33333333-3333-4333-8333-333333333333';

const holding: Holding = {
  id: holdingId,
  userId,
  name: 'Reliance',
  type: 'stock',
  identifier: 'RELIANCE.NS',
  accountId: null,
  currency: 'INR',
  quantity: 2,
  avgCost: 1400,
  currentPrice: 1450,
  currentValue: 2900,
  manualPriceOverride: null,
  manualValueOverride: null,
  manualFxRateToInr: null,
  automaticPrice: null,
  automaticPriceAsOf: null,
  automaticPriceSource: null,
  automaticPriceProvider: null,
  automaticPriceFxRateToInr: null,
  metadata: null,
  isActive: true,
};

const event: HoldingEvent = {
  id: '44444444-4444-4444-8444-444444444444',
  userId,
  holdingId,
  kind: 'buy',
  occurredOn: '2026-07-17',
  quantity: 2,
  price: 1400,
  amount: -2800,
  currency: 'INR',
  fxRateToInr: 1,
  note: null,
  importHash: 'hash-1',
};

function fakeDb(updateRowsAffected = 0) {
  const statements: string[] = [];
  const db = {
    statements,
    execute: async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith('UPDATE')) return { rowsAffected: updateRowsAffected };
      return { rows: [], rowsAffected: 1 };
    },
    writeTransaction: async <T>(callback: (tx: { execute: typeof db.execute }) => Promise<T>) =>
      callback(db),
  } as unknown as AbstractPowerSyncDatabase & { readonly statements: string[] };
  return db;
}

describe('portfolio mappers and repositories', () => {
  it('maps JSON metadata and new quote columns through the shared schemas', () => {
    expect(
      mapHoldingRows([
        {
          ...holding,
          user_id: userId,
          account_id: null,
          avg_cost: 1400,
          current_price: 1450,
          current_value: 2900,
          manual_price_override: null,
          manual_value_override: null,
          manual_fx_rate_to_inr: null,
          automatic_price: null,
          automatic_price_as_of: null,
          automatic_price_source: null,
          automatic_price_provider: null,
          automatic_price_fx_rate_to_inr: null,
          metadata: null,
          is_active: 1,
        },
      ])[0]?.identifier,
    ).toBe('RELIANCE.NS');
    expect(
      mapHoldingEventRows([
        {
          ...event,
          user_id: userId,
          holding_id: holdingId,
          occurred_on: event.occurredOn,
          import_hash: event.importHash,
        },
      ])[0]?.importHash,
    ).toBe('hash-1');
  });

  it('uses UPDATE-then-INSERT for a holding and never attempts an UPSERT', async () => {
    const db = fakeDb(1);
    await saveHolding(db, userId, holding);
    expect(db.statements[0]).toMatch(/^UPDATE holdings/);
    expect(db.statements.some((sql) => sql.includes('ON CONFLICT'))).toBe(false);
    expect(db.statements.some((sql) => sql.startsWith('INSERT'))).toBe(false);
  });
});

describe('commitPortfolioImport', () => {
  it('deduplicates semantic hashes and commits through one write transaction', async () => {
    const db = fakeDb();
    const row = {
      source: 'zerodha' as const,
      accountId: null,
      name: 'Reliance',
      type: 'stock' as const,
      identifier: 'RELIANCE.NS',
      currency: 'INR' as const,
      occurredOn: '2026-07-17',
      kind: 'buy' as const,
      quantity: 2,
      price: 1450,
      amount: -2900,
      fxRateToInr: 1,
      note: 'T123',
      importHash: 'hash-portfolio-1',
    };
    await expect(commitPortfolioImport(db, userId, [row, row])).resolves.toEqual({
      created: 1,
      skipped: 1,
      failed: 0,
    });
    expect(db.statements.some((sql) => sql.includes('ON CONFLICT'))).toBe(false);
  });

  it('rejects an invalid statement before opening a write transaction', async () => {
    const db = fakeDb();
    await expect(
      commitPortfolioImport(db, userId, [
        { ...event, source: 'zerodha' } as unknown as PortfolioImportRow,
      ]),
    ).resolves.toEqual({ created: 0, skipped: 0, failed: 1 });
    expect(db.statements).toEqual([]);
  });
});
