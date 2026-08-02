import type { AbstractPowerSyncDatabase } from '@powersync/common';
import {
  accountFingerprintForUserId,
  DATA_EXPORT_COLLECTIONS,
  createDataExportBundle,
  serializeDataExportBundle,
  type DataExportCollection,
  type DataExportCollections,
  type DataExportBundleOptions,
  type DataExportSyncState,
  type JsonRecord,
} from '@finmanager/core';

import { getLastKnownUserId } from './failures';
import { getSyncHealthSnapshot } from './health';

export type RecoveryExportArtifact = {
  readonly filename: string;
  readonly contents: string;
  readonly mimeType: 'application/json';
};

export type RecoveryExportOptions = Omit<DataExportBundleOptions, 'syncState'> & {
  readonly userId?: string | null;
};

export async function readDataExportCollections(
  db: AbstractPowerSyncDatabase,
): Promise<DataExportCollections> {
  const entries = await Promise.all(
    DATA_EXPORT_COLLECTIONS.map(async (name) => {
      const rows = await db.getAll<JsonRecord>(`SELECT * FROM ${name} ORDER BY id`);
      return [name, rows] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as Record<
    DataExportCollection,
    readonly JsonRecord[]
  >;
}

/** Builds a recovery artifact from the current local view, including unsynced writes. */
export async function createRecoveryExportArtifact(
  db: AbstractPowerSyncDatabase,
  exportedAtOrOptions: string | RecoveryExportOptions = {},
): Promise<RecoveryExportArtifact> {
  const options: RecoveryExportOptions =
    typeof exportedAtOrOptions === 'string'
      ? { exportedAt: exportedAtOrOptions }
      : exportedAtOrOptions;
  let userId = options.userId ?? null;
  if (!userId && typeof db.execute === 'function') {
    userId = await getLastKnownUserId(db);
  }
  const status =
    db.currentStatus ??
    ({
      connected: false,
      hasSynced: false,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    } as AbstractPowerSyncDatabase['currentStatus']);
  const flow = status.dataFlowStatus;
  const health = userId
    ? await getSyncHealthSnapshot(db, userId)
    : {
        pendingWrites:
          typeof db.getUploadQueueStats === 'function' ? (await db.getUploadQueueStats()).count : 0,
        unresolvedFailures: 0,
        blockedFailures: 0,
      };
  const syncState: DataExportSyncState = {
    hasSynced: status.hasSynced === true,
    connected: status.connected,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    pendingWrites: health.pendingWrites,
    unresolvedFailures: health.unresolvedFailures,
    blockedFailures: health.blockedFailures,
    uploadError: Boolean(flow.uploadError),
    downloadError: Boolean(flow.downloadError),
  };
  const bundleOptions: DataExportBundleOptions = {
    ...options,
    accountFingerprint:
      options.accountFingerprint ?? (userId ? accountFingerprintForUserId(userId) : null),
    syncState,
    sourcePlatform: options.sourcePlatform ?? 'unknown',
  };
  const bundle = createDataExportBundle(await readDataExportCollections(db), bundleOptions);
  return {
    filename: `finmanager-recovery-${bundle.exportedAt.slice(0, 10)}.json`,
    contents: serializeDataExportBundle(bundle),
    mimeType: 'application/json',
  };
}
