import type { AbstractPowerSyncDatabase } from '@powersync/common';

import { getLastKnownUserId, rememberUserId } from './failures';

export const DEFAULT_FINAL_SYNC_TIMEOUT_MS = 8_000;
export const DEFAULT_FINAL_SYNC_POLL_MS = 200;

export type LocalSyncSafetySnapshot = {
  readonly userId: string;
  readonly pendingWrites: number;
  readonly unresolvedFailures: number;
  readonly blockedFailures: number;
};

export type FinalSyncResult = {
  readonly status: 'ready' | 'requires-confirmation';
  readonly snapshot: LocalSyncSafetySnapshot;
  readonly timedOut: boolean;
};

export type FinalSyncOptions = {
  readonly timeoutMs?: number;
  readonly pollMs?: number;
  /** Test seam; production callers should use the default clock. */
  readonly now?: () => number;
  /** Test seam; production callers should use the default timer. */
  readonly wait?: (milliseconds: number) => Promise<void>;
};

export type ForcedSignOutConfirmation = {
  readonly recoveryExported: boolean;
  readonly discardAcknowledged: boolean;
};

export type AccountReconciliation =
  | { readonly status: 'first-account' | 'same-account' | 'switched-cleanly' }
  | {
      readonly status: 'blocked';
      readonly previousUserId: string;
      readonly snapshot: LocalSyncSafetySnapshot;
    };

type FailureCounts = {
  readonly unresolved_failures: number;
  readonly blocked_failures: number;
};

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function count(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function isLocalSyncSafe(snapshot: LocalSyncSafetySnapshot): boolean {
  return snapshot.pendingWrites === 0 && snapshot.unresolvedFailures === 0;
}

/**
 * Returns only counts. Financial payloads stay in the local database and never
 * become auth-flow state, logs, or telemetry.
 */
export async function getLocalSyncSafetySnapshot(
  database: AbstractPowerSyncDatabase,
  userId: string,
): Promise<LocalSyncSafetySnapshot> {
  const [queue, failures] = await Promise.all([
    database.getUploadQueueStats(),
    database.getAll<FailureCounts>(
      `SELECT
         COUNT(DISTINCT CASE
           WHEN resolution_state IN ('retryable', 'blocked', 'resolving') THEN transaction_id
         END) AS unresolved_failures,
         COUNT(DISTINCT CASE
           WHEN resolution_state IN ('blocked', 'resolving') THEN transaction_id
         END) AS blocked_failures
       FROM sync_failures
       WHERE user_id = ?`,
      [userId],
    ),
  ]);
  const failureCounts = failures[0];
  return {
    userId,
    pendingWrites: count(queue.count),
    unresolvedFailures: count(failureCounts?.unresolved_failures),
    blockedFailures: count(failureCounts?.blocked_failures),
  };
}

/**
 * Waits for PowerSync's existing upload worker to drain the local queue. A
 * blocked failure returns immediately because time alone cannot resolve it.
 */
export async function waitForFinalSync(
  database: AbstractPowerSyncDatabase,
  userId: string,
  options: FinalSyncOptions = {},
): Promise<FinalSyncResult> {
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_FINAL_SYNC_TIMEOUT_MS);
  const pollMs = Math.max(1, options.pollMs ?? DEFAULT_FINAL_SYNC_POLL_MS);
  const now = options.now ?? Date.now;
  const wait = options.wait ?? defaultWait;
  const deadline = now() + timeoutMs;
  let snapshot = await getLocalSyncSafetySnapshot(database, userId);

  while (!isLocalSyncSafe(snapshot) && snapshot.blockedFailures === 0 && now() < deadline) {
    await wait(Math.min(pollMs, Math.max(1, deadline - now())));
    snapshot = await getLocalSyncSafetySnapshot(database, userId);
  }

  return {
    status: isLocalSyncSafe(snapshot) ? 'ready' : 'requires-confirmation',
    snapshot,
    timedOut: !isLocalSyncSafe(snapshot) && now() >= deadline,
  };
}

export function assertForcedSignOutAllowed(confirmation: ForcedSignOutConfirmation): void {
  if (!confirmation.recoveryExported) {
    throw new Error('Create a recovery export before discarding local-only changes.');
  }
  if (!confirmation.discardAcknowledged) {
    throw new Error('Explicitly acknowledge that local-only changes will be discarded.');
  }
}

/** Transient auth loss preserves the database; deliberate sign-out clears it. */
export async function disconnectForSessionLoss(
  database: AbstractPowerSyncDatabase,
  mode: 'preserve' | 'clear',
): Promise<void> {
  if (mode === 'clear') {
    await database.disconnectAndClear();
  } else {
    await database.disconnect();
  }
}

/**
 * Enforces account isolation before an authenticated session can attach to the
 * retained local database. Unsafe work remains with its original account.
 */
export async function reconcileLocalAccount(
  database: AbstractPowerSyncDatabase,
  incomingUserId: string,
): Promise<AccountReconciliation> {
  const previousUserId = await getLastKnownUserId(database);
  if (!previousUserId) {
    await rememberUserId(database, incomingUserId);
    return { status: 'first-account' };
  }
  if (previousUserId === incomingUserId) return { status: 'same-account' };

  const snapshot = await getLocalSyncSafetySnapshot(database, previousUserId);
  if (!isLocalSyncSafe(snapshot)) {
    return { status: 'blocked', previousUserId, snapshot };
  }

  await database.disconnectAndClear();
  await rememberUserId(database, incomingUserId);
  return { status: 'switched-cleanly' };
}
