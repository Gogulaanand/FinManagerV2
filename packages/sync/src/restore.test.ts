import {
  DATA_EXPORT_COLLECTIONS,
  createDataExportBundle,
  type DataExportCollections,
} from '@finmanager/core';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it, vi } from 'vitest';

import { applyRecoveryRestore, planRecoveryRestore, RestoreBlockedError } from './restore';

const userId = '00000000-0000-4000-8000-000000000099';
const accountId = '00000000-0000-4000-8000-000000000001';

function emptyCollections(): DataExportCollections {
  return Object.fromEntries(
    DATA_EXPORT_COLLECTIONS.map((name) => [name, []]),
  ) as unknown as DataExportCollections;
}

function bundle(): string {
  return JSON.stringify(
    createDataExportBundle(
      {
        ...emptyCollections(),
        accounts: [
          {
            id: accountId,
            user_id: userId,
            name: 'Bank',
            type: 'bank',
            currency: 'INR',
            current_balance: 100,
            is_active: 1,
          },
        ],
      },
      { exportedAt: '2026-08-02T00:00:00.000Z', syncState: { hasSynced: true } },
    ),
  );
}

function database(): AbstractPowerSyncDatabase {
  return {
    getAll: vi.fn(async () => []),
  } as unknown as AbstractPowerSyncDatabase;
}

describe('restore application boundary', () => {
  it('returns a dry-run report without calling Supabase', async () => {
    const report = await planRecoveryRestore(database(), bundle(), { userId, mode: 'empty' });

    expect(report).toMatchObject({
      kind: 'restore-report',
      dryRun: true,
      applied: false,
      serverStatus: 'dry-run',
    });
    expect(report.operationCount).toBe(1);
  });

  it('requires explicit confirmation for replace and calls the transactional RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: { status: 'applied', appliedAt: '2026-08-02T00:01:00.000Z' },
      error: null,
    }));
    const supabase = { rpc } as never;

    await expect(
      applyRecoveryRestore(supabase, database(), bundle(), { userId, mode: 'replace' }),
    ).rejects.toThrow('explicit destructive confirmation');
    expect(rpc).not.toHaveBeenCalled();

    const report = await applyRecoveryRestore(supabase, database(), bundle(), {
      userId,
      mode: 'replace',
      confirmDestructive: true,
      restoreId: 'restore-test',
    });
    expect(report).toMatchObject({
      applied: true,
      serverStatus: 'applied',
      restoreId: 'restore-test',
    });
    expect(rpc).toHaveBeenCalledWith(
      'apply_data_restore',
      expect.objectContaining({ p_mode: 'replace', p_restore_id: 'restore-test' }),
    );
  });

  it('fails closed when the local dry-run has a blocking conflict', async () => {
    const existingDatabase = {
      getAll: vi.fn(async (sql: string) =>
        sql.includes('FROM accounts')
          ? [
              {
                id: accountId,
                user_id: userId,
                name: 'Existing',
                type: 'bank',
                currency: 'INR',
                current_balance: 100,
                is_active: 1,
              },
            ]
          : [],
      ),
    } as unknown as AbstractPowerSyncDatabase;
    const rpc = vi.fn();
    const supabase = { rpc } as never;

    await expect(
      applyRecoveryRestore(supabase, existingDatabase, bundle(), { userId, mode: 'empty' }),
    ).rejects.toBeInstanceOf(RestoreBlockedError);
    expect(rpc).not.toHaveBeenCalled();
  });
});
