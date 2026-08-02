import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it, vi } from 'vitest';

import {
  assertForcedSignOutAllowed,
  disconnectForSessionLoss,
  getLocalSyncSafetySnapshot,
  reconcileLocalAccount,
  waitForFinalSync,
} from './sign-out';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

type DatabaseOptions = {
  readonly previousUserId?: string | null;
  readonly queues?: readonly number[];
  readonly unresolvedFailures?: number;
  readonly blockedFailures?: number;
};

function fakeDatabase(options: DatabaseOptions = {}) {
  const queues = [...(options.queues ?? [0])];
  const database = {
    getUploadQueueStats: vi.fn(async () => ({ count: queues.shift() ?? queues.at(-1) ?? 0 })),
    getAll: vi.fn(async (sql: string) => {
      if (sql.includes('FROM sync_failures')) {
        return [
          {
            unresolved_failures: options.unresolvedFailures ?? 0,
            blocked_failures: options.blockedFailures ?? 0,
          },
        ];
      }
      return [];
    }),
    execute: vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT value FROM sync_metadata')) {
        return {
          rows: {
            _array: options.previousUserId ? [{ value: options.previousUserId }] : [],
          },
          rowsAffected: 0,
        };
      }
      return { rows: { _array: [] }, rowsAffected: 1 };
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectAndClear: vi.fn().mockResolvedValue(undefined),
  };
  return database as unknown as AbstractPowerSyncDatabase & typeof database;
}

describe('safe sign-out policy', () => {
  it('reports pending and unresolved work without exposing row payloads', async () => {
    const database = fakeDatabase({ queues: [3], unresolvedFailures: 2, blockedFailures: 1 });

    await expect(getLocalSyncSafetySnapshot(database, USER_A)).resolves.toEqual({
      userId: USER_A,
      pendingWrites: 3,
      unresolvedFailures: 2,
      blockedFailures: 1,
    });
    expect(database.getAll).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT'), [
      USER_A,
    ]);
  });

  it('waits for an online queue to drain before allowing sign-out', async () => {
    const database = fakeDatabase({ queues: [2, 1, 0] });
    let time = 0;

    const result = await waitForFinalSync(database, USER_A, {
      timeoutMs: 100,
      pollMs: 10,
      now: () => time,
      wait: async (milliseconds) => {
        time += milliseconds;
      },
    });

    expect(result.status).toBe('ready');
    expect(result.snapshot.pendingWrites).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it('returns the remaining offline work after the bounded wait', async () => {
    const database = fakeDatabase({ queues: [2, 2, 2] });
    let time = 0;

    const result = await waitForFinalSync(database, USER_A, {
      timeoutMs: 20,
      pollMs: 10,
      now: () => time,
      wait: async (milliseconds) => {
        time += milliseconds;
      },
    });

    expect(result).toMatchObject({ status: 'requires-confirmation', timedOut: true });
    expect(result.snapshot.pendingWrites).toBe(2);
  });

  it('does not wait on a failed transaction that already requires user action', async () => {
    const database = fakeDatabase({ queues: [1], unresolvedFailures: 1, blockedFailures: 1 });
    const wait = vi.fn();

    const result = await waitForFinalSync(database, USER_A, { wait });

    expect(result.status).toBe('requires-confirmation');
    expect(result.timedOut).toBe(false);
    expect(wait).not.toHaveBeenCalled();
  });

  it('requires both a recovery export and explicit discard acknowledgement', () => {
    expect(() =>
      assertForcedSignOutAllowed({ recoveryExported: false, discardAcknowledged: true }),
    ).toThrow('recovery export');
    expect(() =>
      assertForcedSignOutAllowed({ recoveryExported: true, discardAcknowledged: false }),
    ).toThrow('acknowledge');
    expect(() =>
      assertForcedSignOutAllowed({ recoveryExported: true, discardAcknowledged: true }),
    ).not.toThrow();
  });

  it('preserves local data for transient auth loss and clears after deliberate sign-out', async () => {
    const database = fakeDatabase();

    await disconnectForSessionLoss(database, 'preserve');
    expect(database.disconnect).toHaveBeenCalledOnce();
    expect(database.disconnectAndClear).not.toHaveBeenCalled();

    await disconnectForSessionLoss(database, 'clear');
    expect(database.disconnectAndClear).toHaveBeenCalledOnce();
  });
});

describe('local account isolation', () => {
  it('reattaches the same account without clearing retained data', async () => {
    const database = fakeDatabase({ previousUserId: USER_A, queues: [4] });

    await expect(reconcileLocalAccount(database, USER_A)).resolves.toEqual({
      status: 'same-account',
    });
    expect(database.disconnectAndClear).not.toHaveBeenCalled();
  });

  it('blocks a different account while the previous account has unsafe work', async () => {
    const database = fakeDatabase({ previousUserId: USER_A, queues: [2] });

    const result = await reconcileLocalAccount(database, USER_B);

    expect(result).toMatchObject({
      status: 'blocked',
      previousUserId: USER_A,
      snapshot: { pendingWrites: 2 },
    });
    expect(database.disconnectAndClear).not.toHaveBeenCalled();
  });

  it('clears clean previous-account data before attaching a different account', async () => {
    const database = fakeDatabase({ previousUserId: USER_A, queues: [0] });

    await expect(reconcileLocalAccount(database, USER_B)).resolves.toEqual({
      status: 'switched-cleanly',
    });
    expect(database.disconnectAndClear).toHaveBeenCalledOnce();
    expect(database.execute).toHaveBeenCalledWith(
      'UPDATE sync_metadata SET value = ? WHERE key = ?',
      [USER_B, 'last_known_user_id'],
    );
  });
});
