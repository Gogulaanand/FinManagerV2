import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { describe, expect, it, vi } from 'vitest';

import { logActivityWithRetry, recordActivityIfStale, retryPendingActivity } from './activity';

const USER = '22222222-2222-4222-8222-222222222222';
const rows = (occurredAt?: string) => ({
  rows: { _array: occurredAt ? [{ occurred_at: occurredAt }] : [] },
});

describe('activity retry', () => {
  it('retries a failed write on the next foreground event', async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
    const db = { execute } as unknown as AbstractPowerSyncDatabase;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await logActivityWithRetry(db, USER, 'app_open', 'web');
    await retryPendingActivity();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('recordActivityIfStale', () => {
  it('writes a fresh mark when the newest one is older than the interval', async () => {
    const stale = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const execute = vi.fn().mockResolvedValueOnce(rows(stale)).mockResolvedValue({});
    const db = { execute } as unknown as AbstractPowerSyncDatabase;
    await expect(recordActivityIfStale(db, USER, 'app_open', 'web')).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0]).toContain('INSERT INTO activity_log');
  });

  it('does not write when a recent mark already exists', async () => {
    const fresh = new Date(Date.now() - 60 * 1000).toISOString();
    const execute = vi.fn().mockResolvedValue(rows(fresh));
    const db = { execute } as unknown as AbstractPowerSyncDatabase;
    await expect(recordActivityIfStale(db, USER, 'app_open', 'web')).resolves.toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('writes when the user has no activity at all', async () => {
    const execute = vi.fn().mockResolvedValueOnce(rows()).mockResolvedValue({});
    const db = { execute } as unknown as AbstractPowerSyncDatabase;
    await expect(recordActivityIfStale(db, USER, 'app_open', 'ios')).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('still writes when the freshness read fails', async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error('no table')).mockResolvedValue({});
    const db = { execute } as unknown as AbstractPowerSyncDatabase;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(recordActivityIfStale(db, USER, 'app_open', 'web')).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
