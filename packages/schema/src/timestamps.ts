/**
 * Timestamp parsing that tolerates both of the formats this app actually sees.
 *
 * Locally written rows carry `Date.prototype.toISOString()` output. Rows that
 * originate in Postgres arrive through PowerSync, which renders a `timestamptz`
 * as `YYYY-MM-DD hh:mm:ss.sssZ` - ISO-compatible in spirit, but space-separated
 * and sometimes carrying a two-digit UTC offset. Strict ISO validation rejects
 * that form, which would make every server-written row unparseable.
 *
 * See https://docs.powersync.com/sync/types#postgres-type-mapping.
 */
import { z } from 'zod';

/** Rewrites a PowerSync `timestamptz` rendering into strict ISO 8601. */
export function normalizeTimestamp(value: string): string {
  return value.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T').replace(/([+-]\d{2})$/, '$1:00');
}

/** An ISO 8601 timestamp with an offset, accepting the PowerSync rendering. */
export const IsoTimestamp = z.preprocess(
  (value) => (typeof value === 'string' ? normalizeTimestamp(value) : value),
  z.iso.datetime({ offset: true }),
);
