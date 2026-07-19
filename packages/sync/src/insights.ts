import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { AiSummarySchema, type AiSummary } from '@finmanager/schema';

import { uuidv4 } from './ids';

export const AI_SUMMARIES_QUERY = `
  SELECT id, user_id, month, scope, content, generated_at
  FROM ai_summaries ORDER BY generated_at DESC`;

interface RawRow {
  readonly [key: string]: unknown;
}

interface SqlResult {
  readonly rows?: unknown;
}

interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<SqlResult>;
}

function rowsOf(result: SqlResult): readonly RawRow[] {
  if (!result.rows) return [];
  if (Array.isArray(result.rows)) return result.rows as readonly RawRow[];
  const rows = result.rows as {
    readonly _array?: readonly RawRow[];
    readonly length?: number;
    item?: (index: number) => RawRow;
  };
  if (rows._array) return rows._array;
  if (rows.item && typeof rows.length === 'number') {
    return Array.from({ length: rows.length }, (_, index) => rows.item!(index));
  }
  return [];
}

export function mapAiSummaryRows(rows: readonly RawRow[]): AiSummary[] {
  return rows.map((row) =>
    AiSummarySchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      month: row.month,
      scope: row.scope ?? 'everything',
      content: row.content,
      generatedAt: row.generated_at,
    }),
  );
}

async function saveAiSummaryOn(db: SqlExecutor, userId: string, input: AiSummary): Promise<string> {
  const summary = AiSummarySchema.parse({ ...input, userId });
  const existing = await db.execute(
    'SELECT id FROM ai_summaries WHERE user_id = ? AND month = ? AND scope = ? LIMIT 1',
    [userId, summary.month, summary.scope],
  );
  const existingId = rowsOf(existing)[0]?.id;
  if (typeof existingId === 'string' && existingId.length > 0) {
    await db.execute(
      'UPDATE ai_summaries SET content = ?, generated_at = ? WHERE user_id = ? AND month = ? AND scope = ?',
      [summary.content, summary.generatedAt, userId, summary.month, summary.scope],
    );
    return existingId;
  }

  const id = summary.id ?? uuidv4();
  await db.execute(
    'INSERT INTO ai_summaries (id, user_id, month, scope, content, generated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, summary.month, summary.scope, summary.content, summary.generatedAt],
  );
  return id;
}

export async function saveAiSummary(
  db: AbstractPowerSyncDatabase,
  userId: string,
  summary: AiSummary,
): Promise<string> {
  return db.writeTransaction((transaction) => saveAiSummaryOn(transaction, userId, summary));
}
