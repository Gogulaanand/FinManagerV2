import type { AbstractPowerSyncDatabase } from '@powersync/common';
import {
  AccountSchema,
  BudgetSchema,
  CategorySchema,
  CsvImportRowSchema,
  CsvMappingSetSchema,
  TransactionSchema,
  type Account,
  type Budget,
  type Category,
  type CsvImportRow,
  type CsvMappingSet,
  type Transaction,
} from '@finmanager/schema';
import {
  DEFAULT_CATEGORIES,
  endOfMonthDate,
  expandOccurrences,
  type ExpandedOccurrence,
} from '@finmanager/core';

import { uuidv4 } from './ids';

export const ACCOUNTS_QUERY = `
  SELECT id, user_id, name, type, institution, currency, current_balance, is_active, created_at, updated_at
  FROM accounts ORDER BY name COLLATE NOCASE`;

export const CATEGORIES_QUERY = `
  SELECT id, user_id, name, kind, icon, color, parent_id, is_system, sort_order, created_at, updated_at
  FROM categories ORDER BY sort_order, name COLLATE NOCASE`;

export const TRANSACTIONS_QUERY = `
  SELECT id, user_id, account_id, category_id, amount, direction, currency, occurred_on,
    note, merchant, is_recurring, recurring_id, recurrence_frequency, recurrence_interval,
    recurrence_end_on, recurrence_generated_through, occurrence_key, import_hash, created_at, updated_at
  FROM transactions ORDER BY occurred_on DESC, created_at DESC`;

const RECURRING_SOURCES_QUERY = `
  SELECT id, user_id, account_id, category_id, amount, direction, currency, occurred_on,
    note, merchant, is_recurring, recurring_id, recurrence_frequency, recurrence_interval,
    recurrence_end_on, recurrence_generated_through, occurrence_key, import_hash, created_at, updated_at
  FROM transactions
  WHERE is_recurring = 1 AND recurring_id IS NOT NULL
  ORDER BY occurred_on ASC`;

export const BUDGETS_QUERY = `
  SELECT id, user_id, category_id, period, period_start, amount, created_at, updated_at
  FROM budgets ORDER BY period_start DESC`;

export const PROFILE_MAPPINGS_QUERY = 'SELECT csv_mappings FROM profiles LIMIT 1';

interface RawRow {
  readonly [key: string]: unknown;
}

interface SqlRowsObject {
  readonly _array: readonly RawRow[];
  readonly length: number;
  item(index: number): RawRow;
}

interface SqlResult {
  readonly rows?: readonly RawRow[] | SqlRowsObject;
  readonly rowsAffected?: number;
}

function rowsOf(result: SqlResult): readonly RawRow[] {
  if (!result.rows) return [];
  if (Array.isArray(result.rows)) return result.rows;
  const objectRows = result.rows as SqlRowsObject;
  return objectRows._array.length > 0
    ? objectRows._array
    : Array.from({ length: objectRows.length }, (_, index) => objectRows.item(index));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function idFor(id: string | undefined): string {
  return id ?? uuidv4();
}

export function mapAccountRows(rows: readonly RawRow[]): Account[] {
  return rows.map((row) =>
    AccountSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name ?? ''),
      type: row.type,
      institution: stringValue(row.institution),
      currency: row.currency ?? 'INR',
      currentBalance: numberValue(row.current_balance),
      isActive: booleanValue(row.is_active),
    }),
  );
}

export function mapCategoryRows(rows: readonly RawRow[]): Category[] {
  return rows.map((row) =>
    CategorySchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name ?? ''),
      kind: row.kind,
      icon: stringValue(row.icon),
      color: stringValue(row.color),
      parentId: stringValue(row.parent_id),
      isSystem: booleanValue(row.is_system),
      sortOrder: numberValue(row.sort_order),
    }),
  );
}

export function mapTransactionRows(rows: readonly RawRow[]): Transaction[] {
  return rows.map((row) =>
    TransactionSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      accountId: stringValue(row.account_id),
      categoryId: stringValue(row.category_id),
      amount: numberValue(row.amount),
      direction: row.direction,
      currency: row.currency ?? 'INR',
      occurredOn: String(row.occurred_on),
      note: stringValue(row.note),
      merchant: stringValue(row.merchant),
      isRecurring: booleanValue(row.is_recurring),
      recurringId: stringValue(row.recurring_id),
      recurrenceFrequency: stringValue(row.recurrence_frequency),
      recurrenceInterval: numberValue(row.recurrence_interval, 1),
      recurrenceEndOn: stringValue(row.recurrence_end_on),
      recurrenceGeneratedThrough: stringValue(row.recurrence_generated_through),
      importHash: stringValue(row.import_hash),
      occurrenceKey: stringValue(row.occurrence_key),
    }),
  );
}

export function mapBudgetRows(rows: readonly RawRow[]): Budget[] {
  return rows.map((row) =>
    BudgetSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      categoryId: stringValue(row.category_id),
      period: row.period ?? 'monthly',
      periodStart: String(row.period_start),
      amount: numberValue(row.amount),
    }),
  );
}

export async function saveAccount(
  db: AbstractPowerSyncDatabase,
  userId: string,
  account: Account,
): Promise<void> {
  const isNew = !account.id;
  const id = idFor(account.id);
  const now = new Date().toISOString();
  if (isNew) {
    await db.execute(
      `INSERT INTO accounts (id, user_id, name, type, institution, currency, current_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, account.name, account.type, account.institution, account.currency, account.currentBalance, account.isActive ? 1 : 0, now, now],
    );
  } else {
    await db.execute(
      `UPDATE accounts SET name = ?, type = ?, institution = ?, currency = ?, current_balance = ?, is_active = ?, updated_at = ? WHERE id = ?`,
      [account.name, account.type, account.institution, account.currency, account.currentBalance, account.isActive ? 1 : 0, now, id],
    );
  }
}

export async function deleteAccount(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute('DELETE FROM accounts WHERE id = ?', [id]);
}

export async function seedDefaultCategories(
  db: AbstractPowerSyncDatabase,
  userId: string,
): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    const result = (await db.execute(
      'SELECT id FROM categories WHERE user_id = ? AND name = ? AND kind = ? LIMIT 1',
      [userId, category.name, category.kind],
    )) as unknown as SqlResult;
    if (rowsOf(result).length > 0) continue;
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO categories (id, user_id, name, kind, icon, color, is_system, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        userId,
        category.name,
        category.kind,
        category.icon,
        category.color,
        1,
        category.sortOrder,
        now,
        now,
      ],
    );
  }
}

export async function saveCategory(
  db: AbstractPowerSyncDatabase,
  userId: string,
  category: Category,
): Promise<void> {
  const isNew = !category.id;
  const id = idFor(category.id);
  const now = new Date().toISOString();
  if (isNew) {
    await db.execute(
      `INSERT INTO categories (id, user_id, name, kind, icon, color, parent_id, is_system, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, category.name, category.kind, category.icon, category.color, category.parentId, category.isSystem ? 1 : 0, category.sortOrder, now, now],
    );
  } else {
    await db.execute(
      `UPDATE categories SET name = ?, kind = ?, icon = ?, color = ?, parent_id = ?, is_system = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [category.name, category.kind, category.icon, category.color, category.parentId, category.isSystem ? 1 : 0, category.sortOrder, now, id],
    );
  }
}

export async function deleteCategory(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute('DELETE FROM categories WHERE id = ?', [id]);
}

export async function saveTransaction(
  db: AbstractPowerSyncDatabase,
  userId: string,
  transaction: Transaction,
): Promise<void> {
  const id = idFor(transaction.id);
  const now = new Date().toISOString();
  let exists = false;
  if (transaction.id) {
    const check = (await db.execute('SELECT id FROM transactions WHERE id = ? LIMIT 1', [
      transaction.id,
    ])) as unknown as SqlResult;
    exists = rowsOf(check).length > 0;
  }
  if (!exists) {
    await db.execute(
      `INSERT INTO transactions (id, user_id, account_id, category_id, amount, direction, currency, occurred_on, note, merchant,
        is_recurring, recurring_id, recurrence_frequency, recurrence_interval, recurrence_end_on, recurrence_generated_through,
        occurrence_key, import_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, transaction.accountId, transaction.categoryId, transaction.amount, transaction.direction, transaction.currency, transaction.occurredOn, transaction.note, transaction.merchant, transaction.isRecurring ? 1 : 0, transaction.recurringId, transaction.recurrenceFrequency, transaction.recurrenceInterval, transaction.recurrenceEndOn, transaction.recurrenceGeneratedThrough, transaction.occurrenceKey, transaction.importHash, now, now],
    );
  } else {
    await db.execute(
      `UPDATE transactions SET account_id = ?, category_id = ?, amount = ?, direction = ?, currency = ?, occurred_on = ?,
        note = ?, merchant = ?, is_recurring = ?, recurring_id = ?, recurrence_frequency = ?, recurrence_interval = ?,
        recurrence_end_on = ?, recurrence_generated_through = ?, occurrence_key = ?, import_hash = ?, updated_at = ? WHERE id = ?`,
      [transaction.accountId, transaction.categoryId, transaction.amount, transaction.direction, transaction.currency, transaction.occurredOn, transaction.note, transaction.merchant, transaction.isRecurring ? 1 : 0, transaction.recurringId, transaction.recurrenceFrequency, transaction.recurrenceInterval, transaction.recurrenceEndOn, transaction.recurrenceGeneratedThrough, transaction.occurrenceKey, transaction.importHash, now, id],
    );
  }
}

export async function deleteTransaction(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function commitCsvImport(
  db: AbstractPowerSyncDatabase,
  userId: string,
  rows: readonly CsvImportRow[],
): Promise<{ readonly created: number; readonly skipped: number; readonly failed: number }> {
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const seenHashes = new Set<string>();
  for (const input of rows) {
    try {
      const row = CsvImportRowSchema.parse(input);
      if (!row.importHash || seenHashes.has(row.importHash)) {
        skipped += 1;
        continue;
      }
      seenHashes.add(row.importHash);
      const existing = (await db.execute(
        'SELECT id FROM transactions WHERE user_id = ? AND import_hash = ? LIMIT 1',
        [userId, row.importHash],
      )) as unknown as SqlResult;
      if (rowsOf(existing).length > 0) {
        skipped += 1;
        continue;
      }
      await saveTransaction(db, userId, {
        accountId: row.accountId,
        categoryId: row.categoryId,
        amount: row.amount,
        direction: row.direction,
        currency: row.currency,
        occurredOn: row.occurredOn,
        note: row.note,
        merchant: row.merchant,
        isRecurring: false,
        recurringId: null,
        recurrenceFrequency: null,
        recurrenceInterval: 1,
        recurrenceEndOn: null,
        recurrenceGeneratedThrough: null,
        importHash: row.importHash,
        occurrenceKey: null,
      });
      created += 1;
    } catch {
      failed += 1;
    }
  }
  return { created, skipped, failed };
}

export async function saveBudget(
  db: AbstractPowerSyncDatabase,
  userId: string,
  budget: Budget,
): Promise<void> {
  const id = idFor(budget.id);
  const now = new Date().toISOString();
  const updateSql = `UPDATE budgets SET category_id = ?, period = ?, period_start = ?, amount = ?, updated_at = ? WHERE id = ?`;
  const updateParams = [
    budget.categoryId,
    budget.period,
    budget.periodStart,
    budget.amount,
    now,
    id,
  ];
  const updated = (await db.execute(updateSql, updateParams)) as unknown as SqlResult;
  if (updated.rowsAffected) return;
  const existing = (await db.execute(
    'SELECT id FROM budgets WHERE user_id = ? AND category_id IS ? AND period = ? AND period_start = ? LIMIT 1',
    [userId, budget.categoryId, budget.period, budget.periodStart],
  )) as unknown as SqlResult;
  const existingId = stringValue(rowsOf(existing)[0]?.id);
  if (existingId) {
    await db.execute(updateSql, [...updateParams.slice(0, -1), existingId]);
    return;
  }
  await db.execute(
    `INSERT INTO budgets (id, user_id, category_id, period, period_start, amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, budget.categoryId, budget.period, budget.periodStart, budget.amount, now, now],
  );
}

export async function deleteBudget(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute('DELETE FROM budgets WHERE id = ?', [id]);
}

export async function saveCsvMappings(
  db: AbstractPowerSyncDatabase,
  userId: string,
  mappings: CsvMappingSet,
): Promise<void> {
  const value = CsvMappingSetSchema.parse(mappings);
  const now = new Date().toISOString();
  const updated = (await db.execute(
    'UPDATE profiles SET csv_mappings = ?, updated_at = ? WHERE user_id = ?',
    [JSON.stringify(value), now, userId],
  )) as unknown as SqlResult;
  if (!updated.rowsAffected) {
    await db.execute(
      `INSERT INTO profiles (id, user_id, csv_mappings, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), userId, JSON.stringify(value), now, now],
    );
  }
}

export async function readCsvMappings(db: AbstractPowerSyncDatabase): Promise<CsvMappingSet> {
  const result = (await db.execute(PROFILE_MAPPINGS_QUERY)) as unknown as SqlResult;
  const raw = rowsOf(result)[0]?.csv_mappings;
  if (typeof raw !== 'string' || raw.length === 0) return { mappings: [] };
  try {
    return CsvMappingSetSchema.parse(JSON.parse(raw));
  } catch {
    return { mappings: [] };
  }
}

function isAtOrAfter(left: string, right: string): boolean {
  return left >= right;
}

export async function materializeRecurringTransactions(
  db: AbstractPowerSyncDatabase,
  userId: string,
  source: Transaction,
  throughMonth: string,
): Promise<{ readonly created: number }> {
  if (!source.isRecurring || !source.recurringId || !source.recurrenceFrequency)
    return { created: 0 };
  const through = endOfMonthDate(throughMonth);
  if (
    source.recurrenceGeneratedThrough &&
    isAtOrAfter(source.recurrenceGeneratedThrough, through)
  ) {
    return { created: 0 };
  }
  const result = (await db.execute(
    'SELECT occurrence_key FROM transactions WHERE user_id = ? AND recurring_id = ?',
    [userId, source.recurringId],
  )) as unknown as SqlResult;
  const existing = new Set(
    rowsOf(result)
      .map((row) => stringValue(row.occurrence_key))
      .filter((key): key is string => key !== null),
  );
  const occurrences = expandOccurrences({
    recurringId: source.recurringId,
    amount: source.amount,
    direction: source.direction,
    sourceDate: source.occurredOn,
    frequency: source.recurrenceFrequency,
    interval: source.recurrenceInterval,
    endOn: source.recurrenceEndOn,
    throughMonth,
  });
  let created = 0;
  for (const occurrence of occurrences.filter(
    (item) =>
      !source.recurrenceGeneratedThrough || item.occurredOn > source.recurrenceGeneratedThrough,
  )) {
    if (existing.has(occurrence.occurrenceKey)) continue;
    await saveTransaction(db, userId, occurrenceTransaction(source, occurrence));
    created += 1;
  }
  await db.execute(
    'UPDATE transactions SET recurrence_generated_through = ?, updated_at = ? WHERE id = ?',
    [through, new Date().toISOString(), source.id],
  );
  return { created };
}

export async function ensureRecurringThrough(
  db: AbstractPowerSyncDatabase,
  userId: string,
  throughMonth: string,
): Promise<{ readonly created: number }> {
  const result = (await db.execute(RECURRING_SOURCES_QUERY)) as unknown as SqlResult;
  let created = 0;
  for (const source of mapTransactionRows(rowsOf(result))) {
    const materialized = await materializeRecurringTransactions(db, userId, source, throughMonth);
    created += materialized.created;
  }
  return { created };
}

function occurrenceTransaction(source: Transaction, occurrence: ExpandedOccurrence): Transaction {
  return {
    ...source,
    id: uuidv4(),
    occurredOn: occurrence.occurredOn,
    amount: occurrence.amount,
    direction: occurrence.direction,
    isRecurring: false,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndOn: null,
    recurrenceGeneratedThrough: null,
    occurrenceKey: occurrence.occurrenceKey,
    importHash: null,
  };
}
