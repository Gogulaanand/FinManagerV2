import { DATA_EXPORT_COLLECTIONS, parseDataExportBundle } from '@finmanager/core';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it, vi } from 'vitest';

import { createRecoveryExportArtifact } from './export';

describe('local recovery export', () => {
  it('captures the current local view, including a queued local row', async () => {
    const database = {
      getAll: vi.fn(async (sql: string) =>
        sql.includes('FROM transactions')
          ? [{ id: 'local-transaction', user_id: 'user-1', amount: 1250 }]
          : [],
      ),
    } as unknown as AbstractPowerSyncDatabase;

    const artifact = await createRecoveryExportArtifact(database, '2026-08-02T00:00:00.000Z');
    const bundle = parseDataExportBundle(artifact.contents);

    expect(artifact).toMatchObject({
      filename: 'finmanager-recovery-2026-08-02.json',
      mimeType: 'application/json',
    });
    expect(bundle.collections.transactions).toEqual([
      { id: 'local-transaction', user_id: 'user-1', amount: 1250 },
    ]);
    expect(database.getAll).toHaveBeenCalledTimes(DATA_EXPORT_COLLECTIONS.length);
  });
});
