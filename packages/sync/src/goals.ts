import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { FireSettingsSchema, GoalSchema, type FireSettings, type Goal } from '@finmanager/schema';

import { uuidv4 } from './ids';

export const GOALS_QUERY = `
  SELECT id, user_id, name, kind, target_amount, target_date, current_amount, expected_return,
    inflation, linked_holding_ids, notes, created_at, updated_at
  FROM goals ORDER BY target_date IS NULL, target_date ASC, name COLLATE NOCASE`;

export const FIRE_SETTINGS_QUERY = `
  SELECT id, user_id, annual_expenses, withdrawal_rate, expected_return, inflation, current_age,
    retirement_age, lean_multiplier, fat_multiplier, monthly_investment, created_at, updated_at
  FROM fire_settings LIMIT 1`;

interface RawRow {
  readonly [key: string]: unknown;
}

interface SqlResult {
  readonly rows?: unknown;
  readonly rowsAffected?: number;
}

interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<SqlResult>;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function integerValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

/**
 * Lean multiplier must be below 1 (the schema enforces `< 1`). Legacy rows may
 * hold 1 or more; coerce those to null so the row still parses and falls back to
 * the default lean multiplier instead of throwing when the page loads.
 */
function leanMultiplierValue(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed !== null && parsed > 0 && parsed < 1 ? parsed : null;
}

function jsonArrayValue(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
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
  if (rows.item && typeof rows.length === 'number')
    return Array.from({ length: rows.length }, (_, index) => rows.item!(index));
  return [];
}

function idFor(id: string | undefined): string {
  return id ?? uuidv4();
}

export function mapGoalRows(rows: readonly RawRow[]): Goal[] {
  return rows.map((row) =>
    GoalSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name ?? ''),
      kind: row.kind,
      targetAmount: numberValue(row.target_amount) ?? 0,
      targetDate: stringValue(row.target_date),
      currentAmount: numberValue(row.current_amount) ?? 0,
      expectedReturn: numberValue(row.expected_return),
      inflation: numberValue(row.inflation),
      linkedHoldingIds: jsonArrayValue(row.linked_holding_ids),
      notes: stringValue(row.notes),
    }),
  );
}

export function mapFireSettingsRows(rows: readonly RawRow[]): FireSettings | null {
  const row = rows[0];
  if (!row) return null;
  return FireSettingsSchema.parse({
    id: String(row.id),
    userId: String(row.user_id),
    annualExpenses: numberValue(row.annual_expenses),
    withdrawalRate: numberValue(row.withdrawal_rate) ?? 4,
    expectedReturn: numberValue(row.expected_return),
    inflation: numberValue(row.inflation),
    currentAge: integerValue(row.current_age),
    retirementAge: integerValue(row.retirement_age),
    leanMultiplier: leanMultiplierValue(row.lean_multiplier),
    fatMultiplier: numberValue(row.fat_multiplier),
    monthlyInvestment: numberValue(row.monthly_investment),
  });
}

async function saveGoalOn(db: SqlExecutor, userId: string, input: Goal): Promise<string> {
  const isNew = !input.id;
  const goal = GoalSchema.parse({ ...input, id: idFor(input.id), userId });
  const id = goal.id!;
  const now = new Date().toISOString();
  const linkedHoldingIds = JSON.stringify(goal.linkedHoldingIds);
  const fields = [
    goal.name,
    goal.kind,
    goal.targetAmount,
    goal.targetDate,
    goal.currentAmount,
    goal.expectedReturn,
    goal.inflation,
    linkedHoldingIds,
    goal.notes,
  ];
  if (isNew) {
    await db.execute(
      `INSERT INTO goals (id, user_id, name, kind, target_amount, target_date, current_amount, expected_return, inflation, linked_holding_ids, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, ...fields, now, now],
    );
  } else {
    await db.execute(
      `UPDATE goals SET name = ?, kind = ?, target_amount = ?, target_date = ?, current_amount = ?, expected_return = ?, inflation = ?, linked_holding_ids = ?, notes = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
      [...fields, now, userId, id],
    );
  }
  return id;
}

export async function saveGoal(
  db: AbstractPowerSyncDatabase,
  userId: string,
  goal: Goal,
): Promise<string> {
  return db.writeTransaction((tx) => saveGoalOn(tx, userId, goal));
}

export async function deleteGoal(
  db: AbstractPowerSyncDatabase,
  userId: string,
  id: string,
): Promise<void> {
  await db.execute('DELETE FROM goals WHERE user_id = ? AND id = ?', [userId, id]);
}

async function saveFireSettingsOn(
  db: SqlExecutor,
  userId: string,
  input: FireSettings,
): Promise<string> {
  const settings = FireSettingsSchema.parse({ ...input, id: idFor(input.id), userId });
  const id = settings.id!;
  const now = new Date().toISOString();
  const fields = [
    settings.annualExpenses,
    settings.withdrawalRate,
    settings.expectedReturn,
    settings.inflation,
    settings.currentAge,
    settings.retirementAge,
    settings.leanMultiplier,
    settings.fatMultiplier,
    settings.monthlyInvestment,
  ];
  // fire_settings is 1:1 per user (unique user_id). Branch on an explicit
  // existence check rather than the UPDATE's rowsAffected, which is not reliably
  // populated on the PowerSync web adapter and would otherwise fall through to a
  // duplicate INSERT (UNIQUE constraint failed on id) on the second save.
  const existing = await db.execute('SELECT id FROM fire_settings WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  if (rowsOf(existing).length > 0) {
    await db.execute(
      `UPDATE fire_settings SET annual_expenses = ?, withdrawal_rate = ?, expected_return = ?, inflation = ?, current_age = ?, retirement_age = ?, lean_multiplier = ?, fat_multiplier = ?, monthly_investment = ?, updated_at = ? WHERE user_id = ?`,
      [...fields, now, userId],
    );
  } else {
    await db.execute(
      `INSERT INTO fire_settings (id, user_id, annual_expenses, withdrawal_rate, expected_return, inflation, current_age, retirement_age, lean_multiplier, fat_multiplier, monthly_investment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, ...fields, now, now],
    );
  }
  return id;
}

export async function saveFireSettings(
  db: AbstractPowerSyncDatabase,
  userId: string,
  settings: FireSettings,
): Promise<string> {
  return db.writeTransaction((tx) => saveFireSettingsOn(tx, userId, settings));
}
