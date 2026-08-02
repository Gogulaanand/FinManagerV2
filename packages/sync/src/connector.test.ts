import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { UpdateType } from '@powersync/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseConnector } from './connector';
import {
  classifySyncError,
  discardSyncTransaction,
  MAX_AUTOMATIC_SYNC_RETRIES,
  recordSyncFailure,
} from './failures';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOLDING_ID = '22222222-2222-4222-8222-222222222222';

type Statement = { readonly sql: string; readonly params?: readonly unknown[] | undefined };

function fakeDatabase(
  options: {
    readonly clientInstanceId?: string;
    readonly blocked?: boolean;
    readonly existingRetryCount?: number;
    readonly matchingFailure?: boolean;
  } = {},
) {
  const statements: Statement[] = [];
  const existingClientInstanceId = options.clientInstanceId ?? 'client-instance-1';
  const database = {
    statements,
    execute: vi.fn(async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
      if (sql.startsWith('SELECT value FROM sync_metadata')) {
        return { rows: { _array: [{ value: existingClientInstanceId }] }, rowsAffected: 0 };
      }
      if (sql.startsWith('SELECT id, first_failed_at, retry_count')) {
        const rows =
          options.existingRetryCount === undefined
            ? []
            : [
                {
                  id: 'failure-row-1',
                  first_failed_at: '2026-08-01T00:00:00.000Z',
                  retry_count: options.existingRetryCount,
                },
              ];
        return { rows: { _array: rows }, rowsAffected: 0 };
      }
      if (
        sql.startsWith('SELECT id\n       FROM sync_failures') &&
        sql.includes('WHERE user_id = ?')
      ) {
        return {
          rows: { _array: options.matchingFailure === false ? [] : [{ id: 'matching-failure' }] },
          rowsAffected: 0,
        };
      }
      if (sql.startsWith('SELECT id\n       FROM sync_failures')) {
        return {
          rows: { _array: options.blocked ? [{ id: 'blocked-failure' }] : [] },
          rowsAffected: 0,
        };
      }
      return { rows: { _array: [] }, rowsAffected: 1 };
    }),
  };
  return database as unknown as AbstractPowerSyncDatabase & { readonly statements: Statement[] };
}

function fakeTransaction() {
  return {
    transactionId: 42,
    crud: [
      {
        clientId: 7,
        table: 'holdings',
        id: HOLDING_ID,
        op: UpdateType.PUT,
        opData: { user_id: USER_ID, name: 'Index fund', metadata: '{"source":"test"}' },
        previousValues: undefined,
      },
      {
        clientId: 8,
        table: 'holdings',
        id: '33333333-3333-4333-8333-333333333333',
        op: UpdateType.PATCH,
        opData: { current_value: 110000 },
        previousValues: { current_value: 100000 },
      },
    ],
    complete: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeSupabase(
  rpcResult: unknown,
  session: { readonly user: { readonly id: string } } | null = { user: { id: USER_ID } },
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const auth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session },
      error: null,
    }),
  };
  return {
    client: { rpc, auth } as unknown as SupabaseClient,
    rpc,
  };
}

describe('SupabaseConnector upload durability', () => {
  it('submits one atomic RPC for the complete local transaction', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));
    const { client, rpc } = fakeSupabase({ data: { status: 'applied' }, error: null });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await connector.uploadData(database);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]?.[0]).toBe('apply_sync_transaction');
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_client_instance_id: 'client-instance-1',
      p_transaction_id: 42,
      p_operations: [
        expect.objectContaining({
          table: 'holdings',
          id: HOLDING_ID,
          data: expect.objectContaining({ metadata: { source: 'test' } }),
        }),
        expect.objectContaining({
          op: UpdateType.PATCH,
          previousValues: { current_value: 100000 },
        }),
      ],
    });
    expect(transaction.complete).toHaveBeenCalledOnce();
    expect(
      database.statements.some((statement) =>
        statement.sql.startsWith('INSERT INTO sync_failures'),
      ),
    ).toBe(false);
  });

  it('keeps the PowerSync transaction queued and journals a rejected batch', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));
    const { client } = fakeSupabase({
      data: null,
      error: {
        code: '23514',
        message: 'check constraint failed',
        details: 'redacted test detail',
        hint: null,
        status: 400,
      },
    });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await expect(connector.uploadData(database)).rejects.toMatchObject({ code: '23514' });

    expect(transaction.complete).not.toHaveBeenCalled();
    const failureInserts = database.statements.filter((statement) =>
      statement.sql.startsWith('INSERT INTO sync_failures'),
    );
    expect(failureInserts).toHaveLength(2);
    expect(failureInserts[0]?.params).toContain('validation');
    expect(failureInserts[0]?.params).toContain('blocked');
    expect(failureInserts.flatMap((statement) => statement.params ?? [])).not.toContain(
      'redacted test detail',
    );
  });

  it('treats an already-applied response as safe idempotent completion', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));
    const { client } = fakeSupabase({
      data: { status: 'already_applied', operationCount: 2 },
      error: null,
    });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await connector.uploadData(database);

    expect(transaction.complete).toHaveBeenCalledOnce();
    expect(
      database.statements.some((statement) => statement.sql.includes('resolution_state = ?')),
    ).toBe(true);
  });

  it('journals auth loss without completing or dropping queued work', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));
    const { client, rpc } = fakeSupabase({ data: null, error: null }, null);
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await expect(connector.uploadData(database)).rejects.toThrow(
      'Cannot upload PowerSync data without an authenticated user',
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(transaction.complete).not.toHaveBeenCalled();
    expect(database.statements.some((statement) => statement.params?.includes('auth'))).toBe(true);
  });

  it('journals an invalid protocol response instead of completing the queue', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));
    const { client } = fakeSupabase({ data: { status: 'unexpected' }, error: null });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await expect(connector.uploadData(database)).rejects.toThrow(
      'Sync upload returned an invalid protocol response',
    );

    expect(transaction.complete).not.toHaveBeenCalled();
    expect(
      database.statements.some((statement) =>
        statement.sql.startsWith('INSERT INTO sync_failures'),
      ),
    ).toBe(true);
    expect(database.statements.some((statement) => statement.params?.includes('unknown'))).toBe(
      true,
    );
    expect(database.statements.some((statement) => statement.params?.includes('blocked'))).toBe(
      true,
    );
  });

  it('retries a transient failure and completes only after the server applies it', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));
    const { client, rpc } = fakeSupabase({ data: null, error: null });
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new TypeError('network unavailable'), { status: 503 }),
      })
      .mockResolvedValueOnce({ data: { status: 'applied' }, error: null });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await expect(connector.uploadData(database)).rejects.toThrow('network unavailable');
    expect(transaction.complete).not.toHaveBeenCalled();
    await connector.uploadData(database);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(transaction.complete).toHaveBeenCalledOnce();
    expect(database.statements.some((statement) => statement.params?.includes('transient'))).toBe(
      true,
    );
  });

  it('does not resubmit a transaction that is blocked pending explicit resolution', async () => {
    const database = fakeDatabase({ blocked: true });
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    const { client, rpc } = fakeSupabase({ data: { status: 'applied' }, error: null });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await expect(connector.uploadData(database)).rejects.toMatchObject({
      code: 'SYNC_TRANSACTION_BLOCKED',
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(transaction.complete).not.toHaveBeenCalled();
  });

  it('leaves the queue untouched when the local failure journal cannot be written', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);
    database.writeTransaction = vi.fn().mockRejectedValue(new Error('local journal unavailable'));
    const { client } = fakeSupabase({
      data: null,
      error: { code: '23505', message: 'duplicate', status: 409 },
    });
    const connector = new SupabaseConnector(client, 'https://powersync.example');

    await expect(connector.uploadData(database)).rejects.toThrow('local journal unavailable');
    expect(transaction.complete).not.toHaveBeenCalled();
  });

  it('requires an explicit reason before discarding the queued transaction', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);

    await expect(
      discardSyncTransaction(database, USER_ID, 'client-instance-1', 42, '  '),
    ).rejects.toThrow('A discard reason is required');
    expect(transaction.complete).not.toHaveBeenCalled();

    await discardSyncTransaction(
      database,
      USER_ID,
      'client-instance-1',
      42,
      'User confirmed removal of the invalid draft',
    );
    expect(transaction.complete).toHaveBeenCalledOnce();
    expect(
      database.statements.some((statement) => statement.sql.includes('resolution_state = ?')),
    ).toBe(true);
  });

  it('refuses to discard a queue head without a matching user-scoped failure record', async () => {
    const database = fakeDatabase({ matchingFailure: false });
    const transaction = fakeTransaction();
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);

    await expect(
      discardSyncTransaction(
        database,
        'different-user',
        'client-instance-1',
        42,
        'Attempted discard',
      ),
    ).rejects.toThrow('No matching sync failure is available to discard');
    expect(transaction.complete).not.toHaveBeenCalled();
  });

  it('returns a failed discard to blocked state when queue completion fails', async () => {
    const database = fakeDatabase();
    const transaction = fakeTransaction();
    transaction.complete.mockRejectedValueOnce(new Error('queue completion failed'));
    database.getNextCrudTransaction = vi.fn().mockResolvedValue(transaction);

    await expect(
      discardSyncTransaction(database, USER_ID, 'client-instance-1', 42, 'User confirmed discard'),
    ).rejects.toThrow('queue completion failed');

    const stateUpdates = database.statements.filter((statement) =>
      statement.sql.startsWith('UPDATE sync_failures'),
    );
    expect(stateUpdates.some((statement) => statement.sql.includes("'resolving'"))).toBe(true);
    expect(stateUpdates.some((statement) => statement.sql.includes("'blocked'"))).toBe(true);
    expect(stateUpdates.some((statement) => statement.params?.includes('discarded'))).toBe(false);
  });
});

describe('sync failure recovery policy', () => {
  it.each([
    [{ code: '42501', status: 403 }, 'authorization'],
    [{ code: 'PGRST301', status: 401 }, 'auth'],
    [{ code: '23514', status: 400 }, 'validation'],
    [{ code: '23505', status: 409 }, 'conflict'],
    [{ code: 'SYNC_PROTOCOL_ERROR' }, 'unknown'],
  ] as const)('classifies %o as %s', (error, expectedClass) => {
    expect(classifySyncError(error)).toMatchObject({ failureClass: expectedClass });
  });

  it('blocks a transient transaction after the bounded automatic retry limit', async () => {
    const database = fakeDatabase({ existingRetryCount: MAX_AUTOMATIC_SYNC_RETRIES - 1 });
    database.writeTransaction = vi.fn(async (callback) => callback(database as never));

    await recordSyncFailure({
      database,
      userId: USER_ID,
      clientInstanceId: 'client-instance-1',
      transactionId: 42,
      operations: [
        {
          clientId: 7,
          table: 'holdings',
          id: HOLDING_ID,
          op: UpdateType.PATCH,
          opData: { current_value: 110000 },
        },
      ],
      error: new TypeError('network unavailable'),
    });

    const update = database.statements.find((statement) =>
      statement.sql.startsWith('UPDATE sync_failures'),
    );
    expect(update?.params).toContain(MAX_AUTOMATIC_SYNC_RETRIES);
    expect(update?.params).toContain('blocked');
  });
});
