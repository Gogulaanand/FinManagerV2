import { describe, expect, it } from 'vitest';

import {
  DATA_EXPORT_COLLECTIONS,
  createDataExportBundle,
  createModuleCsvExports,
  parseDataExportBundle,
  serializeDataExportBundle,
  type DataExportCollections,
} from './data-export';

function emptyCollections(): DataExportCollections {
  return Object.fromEntries(
    DATA_EXPORT_COLLECTIONS.map((name) => [name, []]),
  ) as unknown as DataExportCollections;
}

describe('versioned data export', () => {
  it('round-trips every collection through JSON', () => {
    const collections = {
      ...emptyCollections(),
      transactions: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          user_id: '00000000-0000-4000-8000-000000000099',
          occurred_on: '2026-07-26',
          amount: 850,
          direction: 'debit',
          currency: 'INR',
          note: 'Lunch',
        },
      ],
      holdings: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          user_id: '00000000-0000-4000-8000-000000000099',
          name: 'Index Fund',
          type: 'mutual_fund',
          metadata: null,
          is_active: 1,
        },
      ],
    };
    const bundle = createDataExportBundle(collections, '2026-07-26T00:00:00.000Z');
    expect(parseDataExportBundle(serializeDataExportBundle(bundle))).toEqual(bundle);
  });

  it('rejects malformed, incomplete, and future-version backups', () => {
    expect(() => parseDataExportBundle('not json')).toThrow('not valid JSON');
    expect(() =>
      parseDataExportBundle(
        JSON.stringify({ schemaVersion: 999, exportedAt: '2026-07-26T00:00:00.000Z' }),
      ),
    ).toThrow('Unsupported backup schema version');
    expect(() =>
      parseDataExportBundle(
        JSON.stringify({
          schemaVersion: 2,
          exportedAt: '2026-07-26T00:00:00.000Z',
          collections: {},
        }),
      ),
    ).toThrow('appVersion');
  });

  it('records recovery warnings and gates complete backups', () => {
    const incomplete = createDataExportBundle(emptyCollections(), {
      sourcePlatform: 'web',
      syncState: { hasSynced: false, pendingWrites: 2 },
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.warnings).toEqual(['initial-sync-incomplete', 'pending-writes']);
    expect(incomplete.rowCounts.transactions).toBe(0);
    expect(incomplete.checksums.transactions).toMatch(/^[0-9a-f]{8}$/);
    expect(() =>
      createDataExportBundle(emptyCollections(), {
        requireComplete: true,
        syncState: { hasSynced: false },
      }),
    ).toThrow('one full sync');

    const acknowledged = createDataExportBundle(emptyCollections(), {
      requireComplete: true,
      acknowledgePendingWrites: true,
      syncState: { hasSynced: true, pendingWrites: 1 },
    });
    expect(acknowledged.complete).toBe(true);
    expect(acknowledged.pendingWritesAcknowledged).toBe(true);
    expect(acknowledged.warnings).toEqual(['pending-writes']);
  });

  it('rejects rows that fail their domain adapter', () => {
    expect(() =>
      createDataExportBundle({
        ...emptyCollections(),
        transactions: [{ id: 'not-a-uuid', direction: 'debit', amount: -1 }],
      }),
    ).toThrow('transactions[0]');
  });

  it('creates module CSVs and neutralizes spreadsheet formulas', () => {
    const exports = createModuleCsvExports({
      ...emptyCollections(),
      transactions: [
        {
          id: 'transaction-1',
          occurred_on: '2026-07-26',
          amount: 1,
          note: '=HYPERLINK("bad")',
        },
      ],
    });
    expect(exports['transactions.csv']).toContain('"\'=HYPERLINK(""bad"")"');
    expect(exports['holdings.csv']).toBe(
      'id,name,type,identifier,currency,quantity,avg_cost,current_value,manual_value_override\n',
    );
  });
});
