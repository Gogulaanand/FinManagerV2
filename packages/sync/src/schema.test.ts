import { describe, expect, it } from 'vitest';

import { AppSchema, JSON_COLUMNS } from './schema';

// A drift guard: the client schema must mirror the 13 Postgres tables from
// supabase/migrations. If a migration adds or removes a table, this fails until
// packages/sync/schema.ts is updated to match.
const EXPECTED_TABLES = [
  'profiles',
  'trusted_contacts',
  'activity_log',
  'tax_scenarios',
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'holdings',
  'holding_events',
  'valuations',
  'goals',
  'fire_settings',
] as const;

describe('AppSchema', () => {
  it('defines exactly the 13 synced tables', () => {
    const names = AppSchema.tables.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TABLES].sort());
  });

  it('never declares an explicit id column (PowerSync creates it)', () => {
    for (const table of AppSchema.tables) {
      expect(table.columns.map((c) => c.name)).not.toContain('id');
    }
  });

  it('scopes every table with a user_id column for per-user sync', () => {
    for (const table of AppSchema.tables) {
      expect(table.columns.map((c) => c.name)).toContain('user_id');
    }
  });
});

describe('JSON_COLUMNS', () => {
  it('only references tables that exist in the schema', () => {
    const names = new Set(AppSchema.tables.map((t) => t.name));
    for (const table of Object.keys(JSON_COLUMNS)) {
      expect(names.has(table)).toBe(true);
    }
  });
});

describe('Phase 5 portfolio columns', () => {
  it('exposes FX, import, and quote provenance fields locally', () => {
    const columns = (name: string) => {
      const table = AppSchema.tables.find((item) => item.name === name);
      return new Set(table?.columns.map((column) => column.name));
    };
    expect(columns('holdings').has('manual_price_override')).toBe(true);
    expect(columns('holdings').has('automatic_price_provider')).toBe(true);
    expect(columns('holding_events').has('fx_rate_to_inr')).toBe(true);
    expect(columns('holding_events').has('import_hash')).toBe(true);
    expect(columns('valuations').has('fx_rate_to_inr')).toBe(true);
  });
});
