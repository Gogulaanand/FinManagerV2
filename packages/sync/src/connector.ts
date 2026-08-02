/**
 * The bridge between the on-device PowerSync database and Supabase.
 *
 * PowerSync owns the *download* path (it streams rows from Postgres into local
 * SQLite via the sync service). This connector owns the two things PowerSync
 * cannot do itself:
 *   1. fetchCredentials - hand PowerSync a Supabase access token so the sync
 *      service knows who is connecting (auth.user_id() in the sync rules).
 *   2. uploadData - drain the local write queue and replay each change against
 *      Supabase through PostgREST, so offline edits reach Postgres when online.
 *
 * It is platform-agnostic: it takes an already-constructed SupabaseClient and a
 * PowerSync instance URL, so web and mobile share exactly this logic.
 */
import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  UpdateType,
} from '@powersync/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getClientInstanceId,
  getLastKnownUserId,
  hashSyncOperations,
  isSyncTransactionBlocked,
  markSyncFailuresResolved,
  rememberUserId,
  recordSyncFailure,
  type SyncOperation,
} from './failures';
import { JSON_COLUMNS } from './schema';

/**
 * Reverse the client-side JSON stringification for a table's jsonb columns.
 *
 * On the client these columns are plain text (a JSON string). PostgREST expects
 * a real object/array for a jsonb column, so parse before upserting. A value
 * that is already null or not-a-string is passed through untouched.
 */
function decodeJsonColumns(
  table: string,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const jsonCols = JSON_COLUMNS[table];
  if (!jsonCols) return record;
  const out = { ...record };
  for (const col of jsonCols) {
    const value = out[col];
    if (typeof value === 'string') {
      try {
        out[col] = JSON.parse(value);
      } catch {
        // Leave a malformed string as-is; the write will fail fatally and be
        // journaled and blocked for explicit resolution.
      }
    }
  }
  return out;
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly powerSyncUrl: string,
  ) {}

  /**
   * Give PowerSync the current user's Supabase access token. Returning null
   * (no session) leaves the client disconnected but fully usable offline -
   * exactly the signed-out state the tax calculator runs in.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) return null;
    return {
      endpoint: this.powerSyncUrl,
      token: session.access_token,
    };
  }

  /**
   * Drain one transaction from the local write queue and apply it to Supabase.
   * The RPC is the server-side atomicity boundary. Any rejected or ambiguous
   * request is journaled locally and thrown so PowerSync keeps the transaction
   * queued; only an applied result is completed.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const operations: SyncOperation[] = transaction.crud.map((op) => ({
      clientId: op.clientId,
      table: op.table,
      id: op.id,
      op: op.op,
      opData:
        op.op === UpdateType.DELETE
          ? undefined
          : decodeJsonColumns(op.table, { ...(op.opData ?? {}), id: op.id }),
      previousValues: op.previousValues,
    }));
    const transactionId = transaction.transactionId ?? transaction.crud[0]?.clientId;
    if (transactionId === undefined) {
      throw new Error('PowerSync returned an upload transaction without an operation id');
    }

    const clientInstanceId = await getClientInstanceId(database);
    if (await isSyncTransactionBlocked(database, clientInstanceId, transactionId)) {
      throw Object.assign(
        new Error('This sync transaction is blocked until the user resolves it'),
        { code: 'SYNC_TRANSACTION_BLOCKED' },
      );
    }
    const lastKnownUserId = await getLastKnownUserId(database);
    let userId: string | null = null;

    try {
      const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();
      if (sessionError) throw sessionError;
      userId = sessionData.session?.user.id ?? null;
      if (!userId) {
        const sessionRequired = new Error(
          'Cannot upload PowerSync data without an authenticated user',
        ) as Error & { readonly code: string; readonly status: number };
        Object.assign(sessionRequired, { code: 'AUTH_REQUIRED', status: 401 });
        throw sessionRequired;
      }
      await rememberUserId(database, userId);

      const { data, error } = await this.supabase.rpc('apply_sync_transaction', {
        p_client_instance_id: clientInstanceId,
        p_transaction_id: transactionId,
        p_payload_hash: hashSyncOperations(operations),
        p_operations: operations.map((operation) => ({
          clientId: operation.clientId,
          table: operation.table,
          id: operation.id,
          op: operation.op,
          data: operation.opData ?? null,
          previousValues: operation.previousValues ?? null,
        })),
      });
      if (error) throw error;
      if (!isSuccessfulUploadResponse(data)) {
        throw Object.assign(new Error('Sync upload returned an invalid protocol response'), {
          code: 'SYNC_PROTOCOL_ERROR',
        });
      }

      await markSyncFailuresResolved(
        database,
        userId,
        clientInstanceId,
        transactionId,
        'resolved',
        data.status,
      );
      await transaction.complete();
    } catch (error) {
      const failureUserId =
        userId ??
        lastKnownUserId ??
        operations.find((operation) => typeof operation.opData?.user_id === 'string')?.opData
          ?.user_id;
      if (typeof failureUserId !== 'string' || failureUserId.length === 0) throw error;
      await recordSyncFailure({
        database,
        userId: failureUserId,
        clientInstanceId,
        transactionId,
        operations,
        error,
      });
      throw error;
    }
  }
}

function isSuccessfulUploadResponse(
  value: unknown,
): value is { readonly status: 'applied' | 'already_applied' } {
  if (typeof value !== 'object' || value === null || !('status' in value)) return false;
  const status = (value as { status?: unknown }).status;
  return status === 'applied' || status === 'already_applied';
}
