import type { AbstractPowerSyncDatabase } from '@powersync/common';
import {
  HoldingEventSchema,
  HoldingSchema,
  PortfolioImportRowSchema,
  ValuationSchema,
  type Holding,
  type HoldingEvent,
  type PortfolioImportRow,
  type Valuation,
} from '@finmanager/schema';

import { uuidv4 } from './ids';

export const HOLDINGS_QUERY = `
  SELECT id, user_id, name, type, identifier, account_id, currency, quantity, avg_cost,
    current_price, current_value, manual_price_override, manual_value_override,
    manual_fx_rate_to_inr, automatic_price, automatic_price_as_of, automatic_price_source,
    automatic_price_provider, automatic_price_fx_rate_to_inr, metadata, is_active, created_at, updated_at
  FROM holdings WHERE is_active = 1 ORDER BY name COLLATE NOCASE`;

export const HOLDING_EVENTS_QUERY = `
  SELECT id, user_id, holding_id, kind, occurred_on, quantity, price, amount, currency,
    fx_rate_to_inr, note, import_hash, created_at, updated_at
  FROM holding_events ORDER BY occurred_on ASC, created_at ASC`;

export const VALUATIONS_QUERY = `
  SELECT id, user_id, holding_id, as_of, value, currency, fx_rate_to_inr, source, created_at, updated_at
  FROM valuations ORDER BY as_of DESC`;

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

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1;
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function idFor(id: string | undefined): string {
  return id ?? uuidv4();
}

export function mapHoldingRows(rows: readonly RawRow[]): Holding[] {
  return rows.map((row) =>
    HoldingSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name ?? ''),
      type: row.type,
      identifier: stringValue(row.identifier),
      accountId: stringValue(row.account_id),
      currency: row.currency ?? 'INR',
      quantity: numberValue(row.quantity) ?? 0,
      avgCost: numberValue(row.avg_cost),
      currentPrice: numberValue(row.current_price),
      currentValue: numberValue(row.current_value),
      manualPriceOverride: numberValue(row.manual_price_override),
      manualValueOverride: numberValue(row.manual_value_override),
      manualFxRateToInr: numberValue(row.manual_fx_rate_to_inr),
      automaticPrice: numberValue(row.automatic_price),
      automaticPriceAsOf: stringValue(row.automatic_price_as_of),
      automaticPriceSource: stringValue(row.automatic_price_source),
      automaticPriceProvider: stringValue(row.automatic_price_provider),
      automaticPriceFxRateToInr: numberValue(row.automatic_price_fx_rate_to_inr),
      metadata: jsonValue(row.metadata),
      isActive: booleanValue(row.is_active),
    }),
  );
}

export function mapHoldingEventRows(rows: readonly RawRow[]): HoldingEvent[] {
  return rows.map((row) =>
    HoldingEventSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      holdingId: String(row.holding_id),
      kind: row.kind,
      occurredOn: String(row.occurred_on),
      quantity: numberValue(row.quantity),
      price: numberValue(row.price),
      amount: numberValue(row.amount) ?? 0,
      currency: row.currency ?? 'INR',
      fxRateToInr: numberValue(row.fx_rate_to_inr),
      note: stringValue(row.note),
      importHash: stringValue(row.import_hash),
    }),
  );
}

export function mapValuationRows(rows: readonly RawRow[]): Valuation[] {
  return rows.map((row) =>
    ValuationSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      holdingId: String(row.holding_id),
      asOf: String(row.as_of),
      value: numberValue(row.value) ?? 0,
      currency: row.currency ?? 'INR',
      fxRateToInr: numberValue(row.fx_rate_to_inr),
      source: stringValue(row.source),
    }),
  );
}

async function updateThenInsert(
  db: SqlExecutor,
  updateSql: string,
  updateParams: unknown[],
  insertSql: string,
  insertParams: unknown[],
): Promise<void> {
  const updated = await db.execute(updateSql, updateParams);
  if (!updated.rowsAffected) await db.execute(insertSql, insertParams);
}

async function saveHoldingOn(db: SqlExecutor, userId: string, input: Holding): Promise<string> {
  const resolvedId = idFor(input.id);
  const holding = HoldingSchema.parse({ ...input, id: resolvedId, userId });
  const id = holding.id!;
  const now = new Date().toISOString();
  const fields = [
    holding.name,
    holding.type,
    holding.identifier,
    holding.accountId,
    holding.currency,
    holding.quantity,
    holding.avgCost,
    holding.currentPrice,
    holding.currentValue,
    holding.manualPriceOverride,
    holding.manualValueOverride,
    holding.manualFxRateToInr,
    holding.automaticPrice,
    holding.automaticPriceAsOf,
    holding.automaticPriceSource,
    holding.automaticPriceProvider,
    holding.automaticPriceFxRateToInr,
    holding.metadata ? JSON.stringify(holding.metadata) : null,
    holding.isActive ? 1 : 0,
    now,
    id,
  ];
  await updateThenInsert(
    db,
    `UPDATE holdings SET name = ?, type = ?, identifier = ?, account_id = ?, currency = ?, quantity = ?, avg_cost = ?, current_price = ?, current_value = ?, manual_price_override = ?, manual_value_override = ?, manual_fx_rate_to_inr = ?, automatic_price = ?, automatic_price_as_of = ?, automatic_price_source = ?, automatic_price_provider = ?, automatic_price_fx_rate_to_inr = ?, metadata = ?, is_active = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
    [...fields.slice(0, -1), userId, id],
    `INSERT INTO holdings (id, user_id, name, type, identifier, account_id, currency, quantity, avg_cost, current_price, current_value, manual_price_override, manual_value_override, manual_fx_rate_to_inr, automatic_price, automatic_price_as_of, automatic_price_source, automatic_price_provider, automatic_price_fx_rate_to_inr, metadata, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, ...fields.slice(0, -1), now],
  );
  return id;
}

export async function saveHolding(
  db: AbstractPowerSyncDatabase,
  userId: string,
  holding: Holding,
): Promise<string> {
  return db.writeTransaction((tx) => saveHoldingOn(tx, userId, holding));
}

export async function saveAutomaticQuote(
  db: AbstractPowerSyncDatabase,
  userId: string,
  holdingId: string,
  quote: {
    readonly price: number;
    readonly asOf: string;
    readonly source: string;
    readonly provider: string;
    readonly fxRateToInr: number | null;
  },
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE holdings SET automatic_price = ?, automatic_price_as_of = ?, automatic_price_source = ?, automatic_price_provider = ?, automatic_price_fx_rate_to_inr = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
      [
        quote.price,
        quote.asOf,
        quote.source,
        quote.provider,
        quote.fxRateToInr,
        new Date().toISOString(),
        userId,
        holdingId,
      ],
    );
  });
}

export async function deleteHolding(
  db: AbstractPowerSyncDatabase,
  userId: string,
  id: string,
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute('DELETE FROM holding_events WHERE user_id = ? AND holding_id = ?', [
      userId,
      id,
    ]);
    await tx.execute('DELETE FROM valuations WHERE user_id = ? AND holding_id = ?', [userId, id]);
    await tx.execute('DELETE FROM holdings WHERE user_id = ? AND id = ?', [userId, id]);
  });
}

async function saveHoldingEventOn(
  db: SqlExecutor,
  userId: string,
  input: HoldingEvent,
): Promise<string> {
  const event = HoldingEventSchema.parse({ ...input, id: idFor(input.id), userId });
  const id = event.id!;
  const now = new Date().toISOString();
  const values = [
    event.holdingId,
    event.kind,
    event.occurredOn,
    event.quantity,
    event.price,
    event.amount,
    event.currency,
    event.fxRateToInr,
    event.note,
    event.importHash,
    now,
    id,
  ];
  await updateThenInsert(
    db,
    `UPDATE holding_events SET holding_id = ?, kind = ?, occurred_on = ?, quantity = ?, price = ?, amount = ?, currency = ?, fx_rate_to_inr = ?, note = ?, import_hash = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
    [...values.slice(0, -1), userId, id],
    `INSERT INTO holding_events (id, user_id, holding_id, kind, occurred_on, quantity, price, amount, currency, fx_rate_to_inr, note, import_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, ...values.slice(0, -1), now],
  );
  return id;
}

export async function saveHoldingEvent(
  db: AbstractPowerSyncDatabase,
  userId: string,
  event: HoldingEvent,
): Promise<string> {
  return db.writeTransaction((tx) => saveHoldingEventOn(tx, userId, event));
}

export async function deleteHoldingEvent(
  db: AbstractPowerSyncDatabase,
  userId: string,
  id: string,
): Promise<void> {
  await db.execute('DELETE FROM holding_events WHERE user_id = ? AND id = ?', [userId, id]);
}

async function saveValuationOn(db: SqlExecutor, userId: string, input: Valuation): Promise<string> {
  const valuation = ValuationSchema.parse({ ...input, id: idFor(input.id), userId });
  const id = valuation.id!;
  const now = new Date().toISOString();
  const values = [
    valuation.holdingId,
    valuation.asOf,
    valuation.value,
    valuation.currency,
    valuation.fxRateToInr,
    valuation.source,
    now,
    id,
  ];
  await updateThenInsert(
    db,
    `UPDATE valuations SET holding_id = ?, as_of = ?, value = ?, currency = ?, fx_rate_to_inr = ?, source = ?, updated_at = ? WHERE user_id = ? AND (id = ? OR (holding_id = ? AND as_of = ?))`,
    [...values.slice(0, -1), userId, id, valuation.holdingId, valuation.asOf],
    `INSERT INTO valuations (id, user_id, holding_id, as_of, value, currency, fx_rate_to_inr, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, ...values.slice(0, -1), now],
  );
  return id;
}

async function reconcileImportedPositionOn(
  db: SqlExecutor,
  userId: string,
  holdingId: string,
  row: PortfolioImportRow,
): Promise<void> {
  if (!row.quantity || !['buy', 'sell', 'exercise'].includes(row.kind)) return;
  const delta = row.kind === 'sell' ? -row.quantity : row.quantity;
  await db.execute(
    `UPDATE holdings SET quantity = MAX(0, quantity + ?), avg_cost = CASE WHEN ? = 'buy' AND quantity + ? > 0 THEN ((quantity * COALESCE(avg_cost, 0)) + (? * ?)) / (quantity + ?) ELSE avg_cost END, updated_at = ? WHERE user_id = ? AND id = ?`,
    [
      delta,
      row.kind,
      delta,
      row.quantity,
      row.price ?? 0,
      delta,
      new Date().toISOString(),
      userId,
      holdingId,
    ],
  );
}

export async function saveValuation(
  db: AbstractPowerSyncDatabase,
  userId: string,
  valuation: Valuation,
): Promise<string> {
  return db.writeTransaction((tx) => saveValuationOn(tx, userId, valuation));
}

export async function deleteValuation(
  db: AbstractPowerSyncDatabase,
  userId: string,
  id: string,
): Promise<void> {
  await db.execute('DELETE FROM valuations WHERE user_id = ? AND id = ?', [userId, id]);
}

function deterministicUuid(seed: string): string {
  const chunks: string[] = [];
  for (let round = 0; round < 4; round += 1) {
    let value = 2_166_136_261 ^ round;
    for (const character of `${round}:${seed}`)
      value = Math.imul(value ^ character.charCodeAt(0), 16_777_619);
    chunks.push((value >>> 0).toString(16).padStart(8, '0'));
  }
  const hex = chunks.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function commitPortfolioImport(
  db: AbstractPowerSyncDatabase,
  userId: string,
  rows: readonly PortfolioImportRow[],
): Promise<{ readonly created: number; readonly skipped: number; readonly failed: number }> {
  const parsedRows: PortfolioImportRow[] = [];
  let invalidRows = 0;
  for (const input of rows) {
    const parsed = PortfolioImportRowSchema.safeParse(input);
    if (parsed.success) parsedRows.push(parsed.data);
    else invalidRows += 1;
  }
  if (invalidRows > 0) return { created: 0, skipped: 0, failed: invalidRows };
  return db.writeTransaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    const seen = new Set<string>();
    for (const row of parsedRows) {
      if (seen.has(row.importHash)) {
        skipped += 1;
        continue;
      }
      seen.add(row.importHash);
      const existing = await tx.execute(
        'SELECT id FROM holding_events WHERE user_id = ? AND import_hash = ? LIMIT 1',
        [userId, row.importHash],
      );
      if (rowsOf(existing).length > 0) {
        skipped += 1;
        continue;
      }
      const holdingId = deterministicUuid(
        `holding:${userId}:${row.source}:${row.accountId ?? ''}:${row.identifier ?? row.name}:${row.currency}`,
      );
      const existingHolding = await tx.execute(
        'SELECT id FROM holdings WHERE user_id = ? AND id = ? LIMIT 1',
        [userId, holdingId],
      );
      if (rowsOf(existingHolding).length === 0) {
        await saveHoldingOn(tx, userId, {
          id: holdingId,
          userId,
          name: row.name,
          type: row.type,
          identifier: row.identifier,
          accountId: row.accountId,
          currency: row.currency,
          quantity: 0,
          avgCost: null,
          currentPrice: null,
          currentValue: null,
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
        });
      }
      await saveHoldingEventOn(tx, userId, {
        id: deterministicUuid(`event:${row.importHash}`),
        userId,
        holdingId,
        kind: row.kind,
        occurredOn: row.occurredOn,
        quantity: row.quantity,
        price: row.price,
        amount: row.amount,
        currency: row.currency,
        fxRateToInr: row.fxRateToInr,
        note: row.note,
        importHash: row.importHash,
      });
      await reconcileImportedPositionOn(tx, userId, holdingId, row);
      created += 1;
    }
    return { created, skipped, failed: 0 };
  });
}
