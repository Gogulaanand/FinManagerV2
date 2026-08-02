import type { AbstractPowerSyncDatabase } from '@powersync/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createRestorePlan,
  createRestoreReport,
  parseDataExportBundle,
  type DataExportBundle,
  type DataExportCollections,
  type RestoreMode,
  type RestorePlan,
  type RestoreReport,
} from '@finmanager/core';

import { uuidv4 } from './ids';
import { readDataExportCollections } from './export';

export type RestoreOptions = {
  readonly userId: string;
  readonly mode: RestoreMode;
  readonly restoreId?: string;
  readonly dryRun?: boolean;
  /** Required by the caller before a replace can reach the server. */
  readonly confirmDestructive?: boolean;
};

export class RestoreBlockedError extends Error {
  readonly plan: RestorePlan;

  constructor(plan: RestorePlan) {
    super(
      `Restore is blocked by ${plan.conflicts.filter((conflict) => conflict.blocking).length} conflict(s)`,
    );
    this.name = 'RestoreBlockedError';
    this.plan = plan;
  }
}

type RestoreRpcResult = {
  readonly status: 'applied' | 'already_applied';
  readonly appliedAt?: string | null;
};

function isRestoreRpcResult(value: unknown): value is RestoreRpcResult {
  if (typeof value !== 'object' || value === null || !('status' in value)) return false;
  const status = (value as { status?: unknown }).status;
  return status === 'applied' || status === 'already_applied';
}

function restorePayloadHash(collections: DataExportCollections): string {
  let hash = 0x811c9dc5;
  for (const character of JSON.stringify(collections)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `r2_${hash.toString(16).padStart(8, '0')}`;
}

function bundleAndPlan(
  bundleOrText: DataExportBundle | string,
  targetUserId: string,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
): RestorePlan {
  const bundle =
    typeof bundleOrText === 'string' ? parseDataExportBundle(bundleOrText) : bundleOrText;
  return createRestorePlan(bundle, targetUserId, currentCollections, mode);
}

export async function planRecoveryRestore(
  database: AbstractPowerSyncDatabase,
  bundleOrText: DataExportBundle | string,
  options: Pick<RestoreOptions, 'userId' | 'mode'>,
): Promise<RestoreReport> {
  const plan = bundleAndPlan(
    bundleOrText,
    options.userId,
    await readDataExportCollections(database),
    options.mode,
  );
  return createRestoreReport(plan, 'dry-run', { status: 'dry-run' });
}

export async function applyRecoveryRestore(
  supabase: SupabaseClient,
  database: AbstractPowerSyncDatabase,
  bundleOrText: DataExportBundle | string,
  options: RestoreOptions,
): Promise<RestoreReport> {
  const currentCollections = await readDataExportCollections(database);
  const plan = bundleAndPlan(bundleOrText, options.userId, currentCollections, options.mode);
  const restoreId = options.restoreId ?? `restore-${uuidv4()}`;
  if (options.dryRun) return createRestoreReport(plan, restoreId, { status: 'dry-run' });
  if (!plan.canApply) throw new RestoreBlockedError(plan);
  if (options.mode === 'replace' && options.confirmDestructive !== true) {
    throw new Error('Replace restore requires explicit destructive confirmation.');
  }

  const { data, error } = await supabase.rpc('apply_data_restore', {
    p_restore_id: restoreId,
    p_payload_hash: restorePayloadHash(plan.serverCollections),
    p_mode: options.mode,
    p_collections: plan.serverCollections,
  });
  if (error) throw error;
  if (!isRestoreRpcResult(data)) throw new Error('Restore returned an invalid protocol response');
  return createRestoreReport(plan, restoreId, {
    status: data.status,
    appliedAt: data.appliedAt ?? null,
  });
}
