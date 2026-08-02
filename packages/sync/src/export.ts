import type { AbstractPowerSyncDatabase } from '@powersync/common';
import {
  DATA_EXPORT_COLLECTIONS,
  createDataExportBundle,
  serializeDataExportBundle,
  type DataExportCollection,
  type DataExportCollections,
  type JsonRecord,
} from '@finmanager/core';

export type RecoveryExportArtifact = {
  readonly filename: string;
  readonly contents: string;
  readonly mimeType: 'application/json';
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
  exportedAt = new Date().toISOString(),
): Promise<RecoveryExportArtifact> {
  const bundle = createDataExportBundle(await readDataExportCollections(db), exportedAt);
  return {
    filename: `finmanager-recovery-${bundle.exportedAt.slice(0, 10)}.json`,
    contents: serializeDataExportBundle(bundle),
    mimeType: 'application/json',
  };
}
