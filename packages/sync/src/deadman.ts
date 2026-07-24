import type { AbstractPowerSyncDatabase } from '@powersync/common';
import {
  DeadmanSettingsSchema,
  EscalationEventSchema,
  TrustedContactSchema,
  type DeadmanSettings,
  type EscalationEvent,
  type TrustedContact,
} from '@finmanager/schema';

import { uuidv4 } from './ids';

export const DEADMAN_SETTINGS_QUERY = `SELECT id, user_id, is_enabled, threshold_days, disclosure_note, created_at, updated_at FROM deadman_settings LIMIT 1`;
export const TRUSTED_CONTACTS_QUERY = `SELECT id, user_id, name, email, phone, relationship, disclosure_scope, notify_after_days, priority, is_active, created_at, updated_at FROM trusted_contacts ORDER BY priority ASC, name COLLATE NOCASE`;
export const ESCALATION_EVENTS_QUERY = `SELECT id, user_id, kind, status, recipient, detail, created_at, sent_at FROM escalation_events ORDER BY created_at DESC`;

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
  if (rows.item && typeof rows.length === 'number')
    return Array.from({ length: rows.length }, (_, i) => rows.item!(i));
  return [];
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}
function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function parseDetail(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function mapDeadmanSettingsRows(rows: readonly RawRow[]): DeadmanSettings | null {
  const row = rows[0];
  if (!row) return null;
  return DeadmanSettingsSchema.parse({
    id: String(row.id),
    userId: String(row.user_id),
    isEnabled: booleanValue(row.is_enabled),
    thresholdDays: numberValue(row.threshold_days, 30),
    disclosureNote: nullableString(row.disclosure_note),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapTrustedContactRows(rows: readonly RawRow[]): TrustedContact[] {
  return rows.map((row) =>
    TrustedContactSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      name: row.name,
      email: nullableString(row.email),
      phone: nullableString(row.phone),
      relationship: nullableString(row.relationship),
      disclosureScope: row.disclosure_scope ?? 'existence',
      notifyAfterDays: numberValue(row.notify_after_days, 30),
      priority: numberValue(row.priority, 0),
      isActive: booleanValue(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export function mapEscalationEventRows(rows: readonly RawRow[]): EscalationEvent[] {
  return rows.map((row) =>
    EscalationEventSchema.parse({
      id: String(row.id),
      userId: String(row.user_id),
      kind: row.kind,
      status: row.status,
      recipient: nullableString(row.recipient),
      detail: parseDetail(row.detail),
      createdAt: row.created_at,
      sentAt: row.sent_at,
    }),
  );
}

async function saveDeadmanSettingsOn(
  db: SqlExecutor,
  userId: string,
  input: DeadmanSettings,
): Promise<string> {
  const settings = DeadmanSettingsSchema.parse({ ...input, userId });
  const id = settings.id ?? uuidv4();
  const now = new Date().toISOString();
  const existing = await db.execute('SELECT id FROM deadman_settings WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  const fields = [
    settings.isEnabled ? 1 : 0,
    settings.thresholdDays,
    settings.disclosureNote,
    now,
    userId,
  ];
  if (rowsOf(existing).length > 0) {
    await db.execute(
      'UPDATE deadman_settings SET is_enabled = ?, threshold_days = ?, disclosure_note = ?, updated_at = ? WHERE user_id = ?',
      fields,
    );
  } else {
    await db.execute(
      'INSERT INTO deadman_settings (id, user_id, is_enabled, threshold_days, disclosure_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, ...fields.slice(0, 3), now, now],
    );
  }
  return id;
}

export async function saveDeadmanSettings(
  db: AbstractPowerSyncDatabase,
  userId: string,
  settings: DeadmanSettings,
): Promise<string> {
  return db.writeTransaction((tx) => saveDeadmanSettingsOn(tx, userId, settings));
}

async function saveTrustedContactOn(
  db: SqlExecutor,
  userId: string,
  input: TrustedContact,
): Promise<string> {
  const contact = TrustedContactSchema.parse({ ...input, userId });
  const id = contact.id ?? uuidv4();
  const now = new Date().toISOString();
  const fields = [
    contact.name,
    contact.email,
    contact.phone,
    contact.relationship,
    contact.disclosureScope,
    contact.notifyAfterDays,
    contact.priority,
    contact.isActive ? 1 : 0,
  ];
  if (contact.id) {
    await db.execute(
      'UPDATE trusted_contacts SET name = ?, email = ?, phone = ?, relationship = ?, disclosure_scope = ?, notify_after_days = ?, priority = ?, is_active = ?, updated_at = ? WHERE user_id = ? AND id = ?',
      [...fields, now, userId, id],
    );
  } else {
    await db.execute(
      'INSERT INTO trusted_contacts (id, user_id, name, email, phone, relationship, disclosure_scope, notify_after_days, priority, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, ...fields, now, now],
    );
  }
  return id;
}

export async function saveTrustedContact(
  db: AbstractPowerSyncDatabase,
  userId: string,
  contact: TrustedContact,
): Promise<string> {
  return db.writeTransaction((tx) => saveTrustedContactOn(tx, userId, contact));
}

export async function deleteTrustedContact(
  db: AbstractPowerSyncDatabase,
  userId: string,
  id: string,
): Promise<void> {
  await db.execute('DELETE FROM trusted_contacts WHERE user_id = ? AND id = ?', [userId, id]);
}
