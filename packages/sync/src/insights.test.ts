import type { AbstractPowerSyncDatabase } from '@powersync/common';
import type { AiSummary } from '@finmanager/schema';
import { describe, expect, it } from 'vitest';

import { AI_SUMMARIES_QUERY, mapAiSummaryRows, saveAiSummary } from './insights';

const userId = '22222222-2222-4222-8222-222222222222';
const summaryId = '33333333-3333-4333-8333-333333333333';

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

const summary: AiSummary = {
  id: summaryId,
  userId,
  month: '2026-07',
  scope: 'everything',
  content: 'Spending is within plan.',
  generatedAt: '2026-07-19T12:00:00.000Z',
};

describe('AI summary repository', () => {
  it('queries newest summaries first', () => {
    expect(AI_SUMMARIES_QUERY).toContain('ORDER BY generated_at DESC');
  });

  it('maps synced rows into validated summaries', () => {
    expect(
      mapAiSummaryRows([
        {
          id: summaryId,
          user_id: userId,
          month: '2026-07',
          scope: 'everything',
          content: 'Spending is within plan.',
          generated_at: '2026-07-19T12:00:00.000Z',
        },
      ])[0],
    ).toEqual(summary);
  });

  it('updates the existing user, month, and scope row', async () => {
    const db = fakeDb([{ id: summaryId }]);
    await saveAiSummary(db, userId, { ...summary, id: undefined });

    expect(db.statements.some((statement) => statement.sql.startsWith('UPDATE ai_summaries'))).toBe(
      true,
    );
    expect(db.statements.some((statement) => statement.sql.startsWith('INSERT'))).toBe(false);
  });

  it('inserts the first summary for a user, month, and scope', async () => {
    const db = fakeDb();
    await saveAiSummary(db, userId, { ...summary, id: undefined });

    expect(
      db.statements.some((statement) => statement.sql.startsWith('INSERT INTO ai_summaries')),
    ).toBe(true);
  });
});
