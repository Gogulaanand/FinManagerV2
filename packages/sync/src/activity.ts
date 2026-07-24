/**
 * Activity logging: every app open writes one `activity_log` row.
 *
 * This is the raw data source for the Phase 8 inactivity monitor (the dead-man
 * switch) - a stream of "the user was alive at time T" marks. Writing it locally
 * means it is captured even offline and syncs up with everything else.
 */
import type { AbstractPowerSyncDatabase } from '@powersync/common';

import { uuidv4 } from './ids';

export type ActivityKind = 'app_open' | 'checkin';
export type Platform = 'web' | 'ios' | 'android';

type PendingActivity = {
  db: AbstractPowerSyncDatabase;
  userId: string;
  kind: ActivityKind;
  platform: Platform;
};
let pendingActivity: PendingActivity | null = null;

/**
 * Records an activity mark for the given user. Best-effort: a logging failure
 * must never surface to the user or block app startup, so callers can ignore
 * rejections. Requires a signed-in user (RLS scopes the row to them).
 */
export async function logActivity(
  db: AbstractPowerSyncDatabase,
  userId: string,
  kind: ActivityKind,
  platform: Platform,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO activity_log (id, user_id, occurred_at, kind, platform, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), userId, now, kind, platform, now, now],
  );
}

export async function logActivityWithRetry(
  db: AbstractPowerSyncDatabase,
  userId: string,
  kind: ActivityKind,
  platform: Platform,
): Promise<void> {
  await retryPendingActivity();
  try {
    await logActivity(db, userId, kind, platform);
  } catch (error) {
    pendingActivity = { db, userId, kind, platform };
    console.warn('FinManager activity log failed; will retry on foreground', error);
  }
}

export async function retryPendingActivity(): Promise<void> {
  if (!pendingActivity) return;
  try {
    await logActivity(
      pendingActivity.db,
      pendingActivity.userId,
      pendingActivity.kind,
      pendingActivity.platform,
    );
    pendingActivity = null;
  } catch (error) {
    console.warn('FinManager activity log retry failed', error);
  }
}

/** Smallest gap between two recorded activity marks. */
export const ACTIVITY_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Records a fresh activity mark when the newest local one is older than
 * `intervalMs`, and otherwise does nothing. Sign-in is not the only proof of
 * life: a long-lived session that is never torn down must keep marking itself
 * alive, or the inactivity monitor escalates against a user who is still here.
 * The interval keeps tab switches and foreground events from flooding the log.
 *
 * Returns whether a new mark was written.
 */
export async function recordActivityIfStale(
  db: AbstractPowerSyncDatabase,
  userId: string,
  kind: ActivityKind,
  platform: Platform,
  intervalMs: number = ACTIVITY_INTERVAL_MS,
): Promise<boolean> {
  await retryPendingActivity();
  let latest: string | undefined;
  try {
    const result = await db.execute(
      `SELECT occurred_at FROM activity_log WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 1`,
      [userId],
    );
    latest = result.rows?._array?.[0]?.occurred_at as string | undefined;
  } catch (error) {
    // A read failure must not suppress the mark; fall through and write one.
    console.warn('FinManager activity freshness check failed', error);
  }
  if (latest && Date.now() - new Date(latest).getTime() < intervalMs) return false;
  await logActivityWithRetry(db, userId, kind, platform);
  return true;
}
