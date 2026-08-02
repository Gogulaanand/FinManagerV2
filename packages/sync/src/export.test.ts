import { DATA_EXPORT_COLLECTIONS, parseDataExportBundle } from '@finmanager/core';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it, vi } from 'vitest';

import { createRecoveryExportArtifact } from './export';

describe('local recovery export', () => {
  it('captures the current local view, including a queued local row', async () => {
    const database = {
      getAll: vi.fn(async (sql: string) =>
        sql.includes('FROM transactions')
          ? [
              {
                id: '00000000-0000-4000-8000-000000000001',
                user_id: '00000000-0000-4000-8000-000000000099',
                amount: 1250,
                direction: 'debit',
                currency: 'INR',
                occurred_on: '2026-08-02',
              },
            ]
          : [],
      ),
      getUploadQueueStats: vi.fn(async () => ({ count: 0, size: null })),
      currentStatus: {
        hasSynced: true,
        connected: true,
        lastSyncedAt: new Date('2026-08-02T00:00:00.000Z'),
        dataFlowStatus: {},
      },
    } as unknown as AbstractPowerSyncDatabase;

    const artifact = await createRecoveryExportArtifact(database, {
      exportedAt: '2026-08-02T00:00:00.000Z',
      userId: '00000000-0000-4000-8000-000000000099',
      sourcePlatform: 'web',
    });
    const bundle = parseDataExportBundle(artifact.contents);

    expect(artifact).toMatchObject({
      filename: 'finmanager-recovery-2026-08-02.json',
      mimeType: 'application/json',
    });
    expect(bundle.collections.transactions).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        user_id: '00000000-0000-4000-8000-000000000099',
        amount: 1250,
        direction: 'debit',
        currency: 'INR',
        occurred_on: '2026-08-02',
      },
    ]);
    expect(bundle.complete).toBe(true);
    expect(bundle.sourcePlatform).toBe('web');
    expect(bundle.accountFingerprint).toMatch(/^acct_[0-9a-f]{8}$/);
    expect(database.getAll).toHaveBeenCalledTimes(DATA_EXPORT_COLLECTIONS.length + 1);
  });
});
