import {
  DATA_EXPORT_COLLECTIONS,
  createDataExportBundle,
  createRestorePlan,
  createRestoreReport,
  type DataExportCollections,
} from './index';
import { describe, expect, it } from 'vitest';

const userId = '00000000-0000-4000-8000-000000000099';
const targetUserId = '00000000-0000-4000-8000-000000000100';
const accountId = '00000000-0000-4000-8000-000000000001';
const categoryId = '00000000-0000-4000-8000-000000000002';
const transactionId = '00000000-0000-4000-8000-000000000003';

function emptyCollections(): DataExportCollections {
  return Object.fromEntries(
    DATA_EXPORT_COLLECTIONS.map((name) => [name, []]),
  ) as unknown as DataExportCollections;
}

function sourceBundle(): ReturnType<typeof createDataExportBundle> {
  return createDataExportBundle(
    {
      ...emptyCollections(),
      accounts: [
        {
          id: accountId,
          user_id: userId,
          name: 'Bank',
          type: 'bank',
          currency: 'INR',
          current_balance: 10_000,
          is_active: 1,
        },
      ],
      categories: [
        {
          id: categoryId,
          user_id: userId,
          name: 'Food',
          kind: 'expense',
          parent_id: null,
          is_system: 0,
          sort_order: 0,
        },
      ],
      transactions: [
        {
          id: transactionId,
          user_id: userId,
          account_id: accountId,
          category_id: categoryId,
          amount: 250,
          direction: 'debit',
          currency: 'INR',
          occurred_on: '2026-08-02',
          is_recurring: 0,
        },
      ],
    },
    { exportedAt: '2026-08-02T00:00:00.000Z', syncState: { hasSynced: true } },
  );
}

describe('restore planning', () => {
  it('produces dependency-ordered operations and remaps server ownership', () => {
    const bundle = sourceBundle();
    const plan = createRestorePlan(bundle, targetUserId, emptyCollections(), 'empty');

    expect(plan.canApply).toBe(true);
    expect(plan.operations.map(({ table, op }) => `${op}:${table}`)).toEqual([
      'PUT:accounts',
      'PUT:categories',
      'PUT:transactions',
    ]);
    const serverAccount = plan.serverCollections.accounts[0];
    if (!serverAccount) throw new Error('test fixture missing server account');
    expect(serverAccount).toMatchObject({ user_id: targetUserId });
    expect(serverAccount.is_active).toBe(true);
    expect(plan.sourceTotals.transactionDebits).toBe(250);
    expect(plan.sourceTotals.accountBalances).toBe(10_000);
    expect(plan.totalsMatchSource).toBe(true);
  });

  it('reports merge conflicts without overwriting existing rows', () => {
    const bundle = sourceBundle();
    const account = bundle.collections.accounts[0];
    if (!account) throw new Error('test fixture missing account');
    const current = { ...emptyCollections(), accounts: [account] } as DataExportCollections;
    const plan = createRestorePlan(bundle, targetUserId, current, 'merge');

    expect(plan.canApply).toBe(true);
    expect(plan.conflicts).toContainEqual(
      expect.objectContaining({ kind: 'existing-row', collection: 'accounts', rowId: accountId }),
    );
    expect(plan.operations.map(({ table, id }) => `${table}:${id}`)).toEqual([
      `categories:${categoryId}`,
      `transactions:${transactionId}`,
    ]);
    expect(plan.projectedRowCounts.accounts).toBe(1);
  });

  it('blocks empty restore into a non-empty target and missing dependencies', () => {
    const bundle = sourceBundle();
    const account = bundle.collections.accounts[0];
    if (!account) throw new Error('test fixture missing account');
    const target = { ...emptyCollections(), accounts: [{ ...account }] } as DataExportCollections;
    const missing = {
      ...bundle,
      collections: {
        ...bundle.collections,
        categories: [],
      },
    };
    const plan = createRestorePlan(missing, targetUserId, target, 'empty');

    expect(plan.canApply).toBe(false);
    expect(plan.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'target-not-empty' }),
        expect.objectContaining({ kind: 'missing-reference', collection: 'transactions' }),
      ]),
    );
  });

  it('includes destructive deletes in replace mode and freezes the report', () => {
    const bundle = sourceBundle();
    const account = bundle.collections.accounts[0];
    if (!account) throw new Error('test fixture missing account');
    const current = {
      ...emptyCollections(),
      accounts: [{ ...account, name: 'Old' }],
    } as DataExportCollections;
    const plan = createRestorePlan(bundle, targetUserId, current, 'replace');
    const report = createRestoreReport(plan, 'restore-test', {
      status: 'applied',
      appliedAt: '2026-08-02T00:01:00.000Z',
    });

    expect(plan.operations.slice(0, 1)).toEqual([
      { table: 'accounts', id: accountId, op: 'DELETE' },
    ]);
    expect(report.applied).toBe(true);
    expect(report.serverStatus).toBe('applied');
    expect(Object.isFrozen(report)).toBe(true);
  });
});
