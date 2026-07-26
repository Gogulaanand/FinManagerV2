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
          id: 'transaction-1',
          occurred_on: '2026-07-26',
          amount: 850,
          note: 'Lunch',
        },
      ],
      holdings: [{ id: 'holding-1', name: 'Index Fund', metadata: '{"folio":"123"}' }],
    };
    const bundle = createDataExportBundle(collections, '2026-07-26T00:00:00.000Z');
    expect(parseDataExportBundle(serializeDataExportBundle(bundle))).toEqual(bundle);
  });

  it('rejects malformed, incomplete, and future-version backups', () => {
    expect(() => parseDataExportBundle('not json')).toThrow('not valid JSON');
    expect(() =>
      parseDataExportBundle(
        JSON.stringify({ schemaVersion: 2, exportedAt: '2026-07-26T00:00:00.000Z' }),
      ),
    ).toThrow('Unsupported backup schema version');
    expect(() =>
      parseDataExportBundle(
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: '2026-07-26T00:00:00.000Z',
          collections: {},
        }),
      ),
    ).toThrow('profiles');
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
