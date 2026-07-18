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
