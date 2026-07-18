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
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { JSON_COLUMNS } from './schema';

/**
 * PostgREST error codes that mean "this write will never succeed" (constraint
 * violation, RLS denial, bad type). Discard the op instead of retrying forever;
 * anything else (network, 5xx) is transient and should be retried.
 */
const FATAL_RESPONSE_CODES = [
  /^22\d{3}$/, // data exception (invalid type, numeric out of range, ...)
  /^23\d{3}$/, // integrity constraint violation
  /^42\d{3}$/, // syntax / access rule violation (includes RLS 42501)
] as const;

function isFatalPostgrestError(error: PostgrestError): boolean {
  return typeof error.code === 'string' && FATAL_RESPONSE_CODES.some((re) => re.test(error.code));
}

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
        // discarded rather than wedging the queue.
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
   * On a transient failure we throw (PowerSync retries later); on a fatal one we
   * complete the transaction to drop the doomed op so the queue keeps moving.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = this.supabase.from(op.table);
        let error: PostgrestError | null = null;

        switch (op.op) {
          case UpdateType.PUT: {
            const record = decodeJsonColumns(op.table, { ...op.opData, id: op.id });
            ({ error } = await table.upsert(record));
            break;
          }
          case UpdateType.PATCH: {
            const record = decodeJsonColumns(op.table, { ...op.opData });
            ({ error } = await table.update(record).eq('id', op.id));
            break;
          }
          case UpdateType.DELETE: {
            ({ error } = await table.delete().eq('id', op.id));
            break;
          }
        }

        if (error) throw error;
      }
      await transaction.complete();
    } catch (ex) {
      if (isPostgrestError(ex) && isFatalPostgrestError(ex)) {
        // Doomed write (constraint / RLS / type). Drop it rather than blocking
        // every later change behind an op that can never land.
        console.error('Discarding unrecoverable PowerSync upload op', ex);
        await transaction.complete();
      } else {
        // Transient (offline, 5xx). Leave the transaction so PowerSync retries.
        throw ex;
      }
    }
  }
}

function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'details' in value
  );
}
