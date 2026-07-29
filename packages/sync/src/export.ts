import type { AbstractPowerSyncDatabase } from '@powersync/common';
import {
  DATA_EXPORT_COLLECTIONS,
  type DataExportCollection,
  type DataExportCollections,
  type JsonRecord,
} from '@finmanager/core';

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
