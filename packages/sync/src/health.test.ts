import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it, vi } from 'vitest';

import {
  getSyncFailureSummaries,
  getSyncHealthSnapshot,
  resolveSyncHealthStatus,
  retrySyncFailures,
} from './health';

function fakeDatabase(options: {
  readonly counts?: Record<string, unknown>;
  readonly summaries?: readonly Record<string, unknown>[];
  readonly retryRows?: readonly Record<string, unknown>[];
}) {
  const getAll = vi.fn(async (sql: string) => {
    if (sql.includes('GROUP BY failure_class')) return options.summaries ?? [];
    if (sql.includes('DISTINCT client_instance_id')) return options.retryRows ?? [];
    return [options.counts ?? {}];
  });
  const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
  const database = {
    getAll,
    getUploadQueueStats: vi.fn().mockResolvedValue({ count: 4 }),
    execute,
  } as unknown as AbstractPowerSyncDatabase;
  return { database, getAll, execute };
}

describe('sync health', () => {
  it('combines queued writes and safe failure counts', async () => {
    const { database } = fakeDatabase({
      counts: { unresolved_failures: '3', blocked_failures: 2, retryable_failures: 1 },
    });

    await expect(getSyncHealthSnapshot(database, 'user-1')).resolves.toEqual({
      pendingWrites: 4,
      unresolvedFailures: 3,
      blockedFailures: 2,
      retryableFailures: 1,
    });
  });

  it('returns grouped sanitized failure details without payloads', async () => {
    const { database } = fakeDatabase({
      summaries: [
        {
          failure_class: 'validation',
          resolution_state: 'blocked',
          count: '2',
          safe_error_message: 'Review the queued change.',
        },
      ],
    });

    await expect(getSyncFailureSummaries(database, 'user-1')).resolves.toEqual([
      {
        failureClass: 'validation',
        resolutionState: 'blocked',
        count: 2,
        safeErrorMessage: 'Review the queued change.',
      },
    ]);
  });

  it('moves retryable and blocked transactions back to retryable', async () => {
    const { database, execute } = fakeDatabase({
      retryRows: [
        { client_instance_id: 'client-1', transaction_id: '7' },
        { client_instance_id: 'client-1', transaction_id: 8 },
      ],
    });

    await retrySyncFailures(database, 'user-1');

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET resolution_state = 'retryable'"),
      ['user-1', 'client-1', 7],
    );
  });

  it('prioritizes action-required over connection state', () => {
    expect(
      resolveSyncHealthStatus({
        hasSession: true,
        connected: true,
        connecting: false,
        hasSynced: true,
        uploading: false,
        downloading: false,
        hasUploadError: false,
        hasDownloadError: false,
        unresolvedFailures: 1,
      }),
    ).toBe('action-required');
    expect(
      resolveSyncHealthStatus({
        hasSession: true,
        connected: true,
        connecting: false,
        hasSynced: true,
        uploading: false,
        downloading: false,
        hasUploadError: false,
        hasDownloadError: false,
        unresolvedFailures: 0,
      }),
    ).toBe('synced');
  });
});
