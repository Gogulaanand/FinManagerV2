import type { AbstractPowerSyncDatabase } from '@powersync/common';

import { retrySyncTransaction, type SyncFailureClass, type SyncFailureState } from './failures';

export type SyncHealthSnapshot = {
  readonly pendingWrites: number;
  readonly unresolvedFailures: number;
  readonly blockedFailures: number;
  readonly retryableFailures: number;
};

export type SyncFailureSummary = {
  readonly failureClass: SyncFailureClass;
  readonly resolutionState: SyncFailureState;
  readonly count: number;
  readonly safeErrorMessage: string;
};

export type SyncHealthStatus = 'synced' | 'syncing' | 'offline' | 'action-required';

export type SyncHealthStatusInput = {
  readonly hasSession: boolean;
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly hasSynced: boolean | undefined;
  readonly uploading: boolean;
  readonly downloading: boolean;
  readonly hasUploadError: boolean;
  readonly hasDownloadError: boolean;
  readonly unresolvedFailures: number;
};

type SyncHealthCounts = {
  readonly unresolved_failures: number | string | null;
  readonly blocked_failures: number | string | null;
  readonly retryable_failures: number | string | null;
};

type SyncFailureSummaryRow = {
  readonly failure_class: SyncFailureClass;
  readonly resolution_state: SyncFailureState;
  readonly count: number | string | null;
  readonly safe_error_message: string;
};

type RetryableFailureRow = {
  readonly client_instance_id: string;
  readonly transaction_id: number | string;
};

const SYNC_HEALTH_COUNTS_QUERY = `
  SELECT
    COUNT(DISTINCT CASE
      WHEN resolution_state IN ('retryable', 'blocked', 'resolving') THEN transaction_id
    END) AS unresolved_failures,
    COUNT(DISTINCT CASE
      WHEN resolution_state IN ('blocked', 'resolving') THEN transaction_id
    END) AS blocked_failures,
    COUNT(DISTINCT CASE
      WHEN resolution_state = 'retryable' THEN transaction_id
    END) AS retryable_failures
  FROM sync_failures
  WHERE user_id = ?`;

const SYNC_FAILURE_SUMMARIES_QUERY = `
  SELECT failure_class, resolution_state, safe_error_message,
    COUNT(DISTINCT transaction_id) AS count
  FROM sync_failures
  WHERE user_id = ?
    AND resolution_state IN ('retryable', 'blocked', 'resolving')
  GROUP BY failure_class, resolution_state, safe_error_message
  ORDER BY count DESC, failure_class ASC`;

const RETRYABLE_FAILURES_QUERY = `
  SELECT DISTINCT client_instance_id, transaction_id
  FROM sync_failures
  WHERE user_id = ?
    AND resolution_state IN ('retryable', 'blocked')
  ORDER BY transaction_id ASC`;

function count(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Return sync counts without reading or exposing operation payloads. The
 * durable failure journal remains the source of truth for action-required UI.
 */
export async function getSyncHealthSnapshot(
  database: AbstractPowerSyncDatabase,
  userId: string,
): Promise<SyncHealthSnapshot> {
  const [queue, rows] = await Promise.all([
    database.getUploadQueueStats(),
    database.getAll<SyncHealthCounts>(SYNC_HEALTH_COUNTS_QUERY, [userId]),
  ]);
  const row = rows[0];
  return {
    pendingWrites: count(queue.count),
    unresolvedFailures: count(row?.unresolved_failures),
    blockedFailures: count(row?.blocked_failures),
    retryableFailures: count(row?.retryable_failures),
  };
}

/**
 * Read grouped, user-safe failure details. Payloads and row values are never
 * returned to the UI; only the journal's sanitized message is exposed.
 */
export async function getSyncFailureSummaries(
  database: AbstractPowerSyncDatabase,
  userId: string,
): Promise<readonly SyncFailureSummary[]> {
  const rows = await database.getAll<SyncFailureSummaryRow>(SYNC_FAILURE_SUMMARIES_QUERY, [userId]);
  return rows.map((row) => ({
    failureClass: row.failure_class,
    resolutionState: row.resolution_state,
    count: count(row.count),
    safeErrorMessage: row.safe_error_message,
  }));
}

/**
 * Move all retryable or blocked journal entries back to retryable state. The
 * caller reconnects PowerSync afterwards so its existing upload worker drains
 * the still-queued CRUD transactions.
 */
export async function retrySyncFailures(
  database: AbstractPowerSyncDatabase,
  userId: string,
): Promise<void> {
  const rows = await database.getAll<RetryableFailureRow>(RETRYABLE_FAILURES_QUERY, [userId]);
  for (const row of rows) {
    await retrySyncTransaction(database, userId, row.client_instance_id, count(row.transaction_id));
  }
}

export function resolveSyncHealthStatus(input: SyncHealthStatusInput): SyncHealthStatus {
  if (!input.hasSession) return 'offline';
  if (input.unresolvedFailures > 0 || input.hasUploadError || input.hasDownloadError) {
    return 'action-required';
  }
  if (input.connecting || input.uploading || input.downloading) return 'syncing';
  if (input.connected && input.hasSynced) return 'synced';
  return 'offline';
}
