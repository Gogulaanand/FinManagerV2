import type { AbstractPowerSyncDatabase } from '@powersync/common';

import { uuidv4 } from './ids';

export const SYNC_FAILURE_CLASSES = [
  'transient',
  'auth',
  'validation',
  'authorization',
  'conflict',
  'unknown',
] as const;
export type SyncFailureClass = (typeof SYNC_FAILURE_CLASSES)[number];

export const SYNC_FAILURE_STATES = [
  'retryable',
  'blocked',
  'resolving',
  'resolved',
  'discarded',
] as const;
export type SyncFailureState = (typeof SYNC_FAILURE_STATES)[number];

export const MAX_AUTOMATIC_SYNC_RETRIES = 5;

export type SyncOperation = {
  readonly clientId: number;
  readonly table: string;
  readonly id: string;
  readonly op: string;
  readonly opData?: Record<string, unknown> | undefined;
  readonly previousValues?: Record<string, unknown> | undefined;
};

export type SyncFailureInput = {
  readonly database: AbstractPowerSyncDatabase;
  readonly userId: string;
  readonly clientInstanceId: string;
  readonly transactionId: number;
  readonly operations: readonly SyncOperation[];
  readonly error: unknown;
};

export type SyncFailureClassification = {
  readonly failureClass: SyncFailureClass;
  readonly errorCode: string | null;
  readonly safeMessage: string;
  readonly resolutionState: Extract<SyncFailureState, 'retryable' | 'blocked'>;
};

export type SyncFailureRow = {
  readonly id: string;
  readonly user_id: string;
  readonly client_instance_id: string;
  readonly transaction_id: number;
  readonly client_operation_id: number;
  readonly table_name: string;
  readonly row_id: string;
  readonly operation: string;
  readonly operation_data: string | null;
  readonly previous_values: string | null;
  readonly payload_hash: string;
  readonly failure_class: SyncFailureClass;
  readonly error_code: string | null;
  readonly safe_error_message: string;
  readonly first_failed_at: string;
  readonly last_failed_at: string;
  readonly retry_count: number;
  readonly resolution_state: SyncFailureState;
  readonly resolved_at: string | null;
  readonly resolution_reason: string | null;
};

export const SYNC_FAILURES_QUERY = `
  SELECT id, user_id, client_instance_id, transaction_id, client_operation_id,
    table_name, row_id, operation, operation_data, previous_values, payload_hash,
    failure_class, error_code, safe_error_message, first_failed_at, last_failed_at,
    retry_count, resolution_state, resolved_at, resolution_reason
  FROM sync_failures
  WHERE user_id = ?
  ORDER BY last_failed_at DESC`;

type ErrorLike = {
  readonly code?: unknown;
  readonly status?: unknown;
};

function errorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function classifySyncError(error: unknown): SyncFailureClassification {
  const value = errorLike(error);
  const code = stringValue(value.code);
  const status = numberValue(value.status);

  if (code === 'SYNC_PROTOCOL_ERROR') {
    return {
      failureClass: 'unknown',
      errorCode: code,
      safeMessage: 'The sync protocol response needs review before this change can continue.',
      resolutionState: 'blocked',
    };
  }

  if (code === '42501' || status === 403) {
    return {
      failureClass: 'authorization',
      errorCode: code ?? String(status),
      safeMessage: 'FinManager could not authorize a queued change. Review it before retrying.',
      resolutionState: 'blocked',
    };
  }

  if (status === 401) {
    return {
      failureClass: 'auth',
      errorCode: code ?? String(status),
      safeMessage: 'Your session must be restored before queued changes can sync.',
      resolutionState: 'blocked',
    };
  }

  if (status === 408 || status === 429 || (status !== null && status >= 500)) {
    return {
      failureClass: 'transient',
      errorCode: code ?? String(status),
      safeMessage: 'A temporary sync problem kept this change queued for retry.',
      resolutionState: 'retryable',
    };
  }

  if (code?.startsWith('22')) {
    return {
      failureClass: 'validation',
      errorCode: code,
      safeMessage: 'The server rejected the data in a queued change. Review it before retrying.',
      resolutionState: 'blocked',
    };
  }

  if (code === '23505' || code?.startsWith('40')) {
    return {
      failureClass: 'conflict',
      errorCode: code,
      safeMessage: 'A queued change conflicts with data already on the server.',
      resolutionState: 'blocked',
    };
  }

  if (code?.startsWith('23')) {
    return {
      failureClass: 'validation',
      errorCode: code,
      safeMessage: 'A queued change violates a data rule. Review it before retrying.',
      resolutionState: 'blocked',
    };
  }

  if (status !== null && status >= 400 && status < 500) {
    return {
      failureClass: 'validation',
      errorCode: code ?? String(status),
      safeMessage: 'The server rejected a queued change. Review it before retrying.',
      resolutionState: 'blocked',
    };
  }

  // Fetch failures and thrown network errors have no stable status. They are
  // retryable, but remain journaled so the UI can distinguish queued work from
  // a completely healthy sync state.
  if (error instanceof TypeError || error instanceof Error) {
    return {
      failureClass: 'transient',
      errorCode: code,
      safeMessage: 'A temporary sync problem kept this change queued for retry.',
      resolutionState: 'retryable',
    };
  }

  return {
    failureClass: 'unknown',
    errorCode: code,
    safeMessage: 'An unexpected sync problem needs review before this change can continue.',
    resolutionState: 'blocked',
  };
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

/**
 * A stable, non-secret fingerprint for local diagnostics and failure rows. It
 * is intentionally not used as an authentication primitive.
 */
export function hashSyncOperations(operations: readonly SyncOperation[]): string {
  const input = canonicalJson(operations);
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function jsonValue(value: Record<string, unknown> | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

type FailureRow = {
  readonly id: string;
  readonly first_failed_at: string;
  readonly retry_count: number;
};

function rowsOf<T extends Record<string, unknown>>(result: {
  readonly rows?: { readonly _array?: readonly T[] };
}): readonly T[] {
  return result.rows?._array ?? [];
}

export async function getClientInstanceId(database: AbstractPowerSyncDatabase): Promise<string> {
  const value = await readMetadata(database, 'client_instance_id');
  if (typeof value === 'string' && value.length > 0) return value;

  const clientInstanceId = uuidv4();
  await writeMetadata(database, 'client_instance_id', clientInstanceId);
  return clientInstanceId;
}

export async function getLastKnownUserId(
  database: AbstractPowerSyncDatabase,
): Promise<string | null> {
  return readMetadata(database, 'last_known_user_id');
}

export async function rememberUserId(
  database: AbstractPowerSyncDatabase,
  userId: string,
): Promise<void> {
  await writeMetadata(database, 'last_known_user_id', userId);
}

async function readMetadata(
  database: AbstractPowerSyncDatabase,
  key: string,
): Promise<string | null> {
  const existing = await database.execute('SELECT value FROM sync_metadata WHERE key = ? LIMIT 1', [
    key,
  ]);
  const value = rowsOf<{ value: unknown }>(existing)[0]?.value;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function writeMetadata(
  database: AbstractPowerSyncDatabase,
  key: string,
  value: string,
): Promise<void> {
  const updated = await database.execute('UPDATE sync_metadata SET value = ? WHERE key = ?', [
    value,
    key,
  ]);
  if ((updated.rowsAffected ?? 0) > 0) return;
  await database.execute('INSERT INTO sync_metadata (id, key, value) VALUES (?, ?, ?)', [
    uuidv4(),
    key,
    value,
  ]);
}

export async function recordSyncFailure(input: SyncFailureInput): Promise<void> {
  const classification = classifySyncError(input.error);
  const payloadHash = hashSyncOperations(input.operations);
  const now = new Date().toISOString();

  await input.database.writeTransaction(async (transaction) => {
    for (const operation of input.operations) {
      const existing = await transaction.execute(
        `SELECT id, first_failed_at, retry_count
           FROM sync_failures
          WHERE user_id = ?
            AND client_instance_id = ?
            AND transaction_id = ?
            AND client_operation_id = ?
          LIMIT 1`,
        [input.userId, input.clientInstanceId, input.transactionId, operation.clientId],
      );
      const row = rowsOf<FailureRow>(existing)[0];

      if (row) {
        const retryCount = row.retry_count + 1;
        const resolutionState =
          classification.failureClass === 'transient' && retryCount >= MAX_AUTOMATIC_SYNC_RETRIES
            ? 'blocked'
            : classification.resolutionState;
        await transaction.execute(
          `UPDATE sync_failures
              SET table_name = ?, row_id = ?, operation = ?, operation_data = ?,
                  previous_values = ?, payload_hash = ?, failure_class = ?,
                  error_code = ?, safe_error_message = ?, last_failed_at = ?,
                  retry_count = ?, resolution_state = ?, resolved_at = NULL,
                  resolution_reason = NULL
            WHERE id = ?`,
          [
            operation.table,
            operation.id,
            operation.op,
            jsonValue(operation.opData),
            jsonValue(operation.previousValues),
            payloadHash,
            classification.failureClass,
            classification.errorCode,
            classification.safeMessage,
            now,
            retryCount,
            resolutionState,
            row.id,
          ],
        );
      } else {
        await transaction.execute(
          `INSERT INTO sync_failures (
             id, user_id, client_instance_id, transaction_id, client_operation_id,
             table_name, row_id, operation, operation_data, previous_values,
             payload_hash, failure_class, error_code, safe_error_message,
             first_failed_at, last_failed_at, retry_count, resolution_state
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            input.userId,
            input.clientInstanceId,
            input.transactionId,
            operation.clientId,
            operation.table,
            operation.id,
            operation.op,
            jsonValue(operation.opData),
            jsonValue(operation.previousValues),
            payloadHash,
            classification.failureClass,
            classification.errorCode,
            classification.safeMessage,
            now,
            now,
            1,
            classification.resolutionState,
          ],
        );
      }
    }
  });
}

export async function isSyncTransactionBlocked(
  database: AbstractPowerSyncDatabase,
  clientInstanceId: string,
  transactionId: number,
): Promise<boolean> {
  const result = await database.execute(
    `SELECT id
       FROM sync_failures
      WHERE client_instance_id = ?
        AND transaction_id = ?
        AND resolution_state = 'blocked'
      LIMIT 1`,
    [clientInstanceId, transactionId],
  );
  return rowsOf<{ id: string }>(result).length > 0;
}

export async function markSyncFailuresResolved(
  database: AbstractPowerSyncDatabase,
  userId: string,
  clientInstanceId: string,
  transactionId: number,
  state: Extract<SyncFailureState, 'resolved' | 'discarded'>,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await database.execute(
    `UPDATE sync_failures
        SET resolution_state = ?, resolved_at = ?, resolution_reason = ?
      WHERE user_id = ? AND client_instance_id = ? AND transaction_id = ?`,
    [state, now, reason, userId, clientInstanceId, transactionId],
  );
}

export async function retrySyncTransaction(
  database: AbstractPowerSyncDatabase,
  userId: string,
  clientInstanceId: string,
  transactionId: number,
): Promise<void> {
  await database.execute(
    `UPDATE sync_failures
        SET resolution_state = 'retryable', resolved_at = NULL, resolution_reason = NULL
      WHERE user_id = ? AND client_instance_id = ? AND transaction_id = ?`,
    [userId, clientInstanceId, transactionId],
  );
}

/**
 * Explicitly discard the queue head after the user has acknowledged the data
 * loss. Only the oldest matching transaction can be completed, which prevents
 * an arbitrary later transaction from being removed out of order.
 */
export async function discardSyncTransaction(
  database: AbstractPowerSyncDatabase,
  userId: string,
  clientInstanceId: string,
  transactionId: number,
  reason: string,
): Promise<void> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error('A discard reason is required');

  const transaction = await database.getNextCrudTransaction();
  if (!transaction) throw new Error('The sync queue is empty');
  const headTransactionId = transaction.transactionId ?? transaction.crud[0]?.clientId;
  if (headTransactionId !== transactionId) {
    throw new Error('The requested sync failure is not at the queue head');
  }

  const matchingFailure = await database.execute(
    `SELECT id
       FROM sync_failures
      WHERE user_id = ?
        AND client_instance_id = ?
        AND transaction_id = ?
        AND resolution_state IN ('retryable', 'blocked', 'resolving')
      LIMIT 1`,
    [userId, clientInstanceId, transactionId],
  );
  if (rowsOf<{ id: string }>(matchingFailure).length === 0) {
    throw new Error('No matching sync failure is available to discard');
  }

  await database.execute(
    `UPDATE sync_failures
        SET resolution_state = 'resolving', resolved_at = NULL, resolution_reason = ?
      WHERE user_id = ? AND client_instance_id = ? AND transaction_id = ?`,
    [trimmedReason, userId, clientInstanceId, transactionId],
  );

  try {
    await transaction.complete();
  } catch (error) {
    await database.execute(
      `UPDATE sync_failures
          SET resolution_state = 'blocked', resolved_at = NULL, resolution_reason = ?
        WHERE user_id = ? AND client_instance_id = ? AND transaction_id = ?`,
      [trimmedReason, userId, clientInstanceId, transactionId],
    );
    throw error;
  }

  await markSyncFailuresResolved(
    database,
    userId,
    clientInstanceId,
    transactionId,
    'discarded',
    trimmedReason,
  );
}
