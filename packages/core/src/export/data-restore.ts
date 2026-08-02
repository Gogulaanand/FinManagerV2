import {
  DATA_EXPORT_COLLECTIONS,
  parseDataExportBundle,
  type DataExportBundle,
  type DataExportCollection,
  type DataExportCollections,
  type JsonRecord,
} from './data-export';

export const RESTORE_MODES = ['empty', 'merge', 'replace'] as const;
export type RestoreMode = (typeof RESTORE_MODES)[number];

export const RESTORE_CONFLICT_KINDS = [
  'target-not-empty',
  'existing-row',
  'duplicate-id',
  'missing-id',
  'missing-user-id',
  'mixed-source-accounts',
  'incomplete-backup',
  'missing-reference',
  'cyclic-reference',
] as const;
export type RestoreConflictKind = (typeof RESTORE_CONFLICT_KINDS)[number];

export type RestoreConflict = {
  readonly kind: RestoreConflictKind;
  readonly collection: DataExportCollection | 'account';
  readonly rowId: string | null;
  readonly detail: string;
  readonly blocking: boolean;
};

export type RestoreTotals = {
  readonly transactionDebits: number;
  readonly transactionCredits: number;
  readonly transactionNet: number;
  readonly accountBalances: number;
  readonly holdingValues: number;
  readonly holdingEventCashflow: number;
  readonly valuationValues: number;
  readonly budgetAmounts: number;
  readonly goalTargets: number;
  readonly goalCurrentAmounts: number;
  readonly transactionMonths: Readonly<
    Record<string, { readonly debit: number; readonly credit: number }>
  >;
  readonly xirrInputCount: number;
};

export type RestoreOperation = {
  readonly table: DataExportCollection;
  readonly id: string;
  readonly op: 'PUT' | 'DELETE';
  readonly data?: JsonRecord;
};

export type RestorePlan = {
  readonly schemaVersion: DataExportBundle['schemaVersion'];
  readonly mode: RestoreMode;
  readonly targetUserId: string;
  readonly sourceAccountFingerprint: string | null;
  readonly sourceTotals: RestoreTotals;
  readonly targetTotalsBefore: RestoreTotals;
  readonly projectedTotals: RestoreTotals;
  readonly totalsMatchSource: boolean;
  readonly sourceRowCounts: Readonly<Record<DataExportCollection, number>>;
  readonly projectedRowCounts: Readonly<Record<DataExportCollection, number>>;
  readonly conflicts: readonly RestoreConflict[];
  readonly warnings: readonly string[];
  readonly operations: readonly RestoreOperation[];
  readonly serverCollections: DataExportCollections;
  readonly canApply: boolean;
};

export type RestoreReport = {
  readonly kind: 'restore-report';
  readonly schemaVersion: DataExportBundle['schemaVersion'];
  readonly restoreId: string;
  readonly mode: RestoreMode;
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly appliedAt: string | null;
  readonly targetUserId: string;
  readonly sourceAccountFingerprint: string | null;
  readonly sourceRowCounts: Readonly<Record<DataExportCollection, number>>;
  readonly projectedRowCounts: Readonly<Record<DataExportCollection, number>>;
  readonly sourceTotals: RestoreTotals;
  readonly targetTotalsBefore: RestoreTotals;
  readonly projectedTotals: RestoreTotals;
  readonly totalsMatchSource: boolean;
  readonly conflicts: readonly RestoreConflict[];
  readonly warnings: readonly string[];
  readonly operationCount: number;
  readonly serverStatus: 'dry-run' | 'applied' | 'already_applied';
};

type MutableTotals = {
  transactionDebits: number;
  transactionCredits: number;
  transactionNet: number;
  accountBalances: number;
  holdingValues: number;
  holdingEventCashflow: number;
  valuationValues: number;
  budgetAmounts: number;
  goalTargets: number;
  goalCurrentAmounts: number;
  transactionMonths: Record<string, { debit: number; credit: number }>;
  xirrInputCount: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEPENDENCY_ORDER: readonly DataExportCollection[] = [
  'profiles',
  'trusted_contacts',
  'activity_log',
  'tax_scenarios',
  'accounts',
  'categories',
  'holdings',
  'transactions',
  'budgets',
  'holding_events',
  'valuations',
  'goals',
  'fire_settings',
  'ai_summaries',
  'deadman_settings',
  'escalation_events',
];

const BOOLEAN_COLUMNS = new Set([
  'onboarded',
  'is_active',
  'is_system',
  'is_recurring',
  'is_enabled',
]);
const JSON_COLUMNS = new Set(['csv_mappings', 'metadata', 'input', 'linked_holding_ids', 'detail']);

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function rowId(row: JsonRecord): string | null {
  return typeof row.id === 'string' ? row.id : null;
}

function sourceUserId(row: JsonRecord): string | null {
  return typeof row.user_id === 'string' ? row.user_id : null;
}

function mutableTotals(): MutableTotals {
  return {
    transactionDebits: 0,
    transactionCredits: 0,
    transactionNet: 0,
    accountBalances: 0,
    holdingValues: 0,
    holdingEventCashflow: 0,
    valuationValues: 0,
    budgetAmounts: 0,
    goalTargets: 0,
    goalCurrentAmounts: 0,
    transactionMonths: {},
    xirrInputCount: 0,
  };
}

function freezeTotals(totals: MutableTotals): RestoreTotals {
  return Object.freeze({
    ...totals,
    transactionMonths: Object.freeze(
      Object.fromEntries(
        Object.entries(totals.transactionMonths).map(([month, values]) => [
          month,
          Object.freeze(values),
        ]),
      ),
    ),
  });
}

export function calculateRestoreTotals(collections: DataExportCollections): RestoreTotals {
  const totals = mutableTotals();
  for (const row of collections.transactions) {
    const amount = numberValue(row.amount);
    const direction = row.direction;
    if (direction === 'debit') totals.transactionDebits += amount;
    if (direction === 'credit') totals.transactionCredits += amount;
    totals.transactionNet += direction === 'credit' ? amount : -amount;
    const month = stringValue(row.occurred_on)?.slice(0, 7);
    if (month) {
      const current = (totals.transactionMonths[month] ??= { debit: 0, credit: 0 });
      if (direction === 'debit') current.debit += amount;
      if (direction === 'credit') current.credit += amount;
    }
    totals.xirrInputCount += 1;
  }
  for (const row of collections.accounts)
    totals.accountBalances += numberValue(row.current_balance);
  for (const row of collections.holdings) totals.holdingValues += numberValue(row.current_value);
  for (const row of collections.holding_events) {
    totals.holdingEventCashflow += numberValue(row.amount);
    totals.xirrInputCount += 1;
  }
  for (const row of collections.valuations) totals.valuationValues += numberValue(row.value);
  for (const row of collections.budgets) totals.budgetAmounts += numberValue(row.amount);
  for (const row of collections.goals) {
    totals.goalTargets += numberValue(row.target_amount);
    totals.goalCurrentAmounts += numberValue(row.current_amount);
  }
  return freezeTotals(totals);
}

function totalsEqual(left: RestoreTotals, right: RestoreTotals): boolean {
  const numericKeys: readonly (keyof Omit<RestoreTotals, 'transactionMonths'>)[] = [
    'transactionDebits',
    'transactionCredits',
    'transactionNet',
    'accountBalances',
    'holdingValues',
    'holdingEventCashflow',
    'valuationValues',
    'budgetAmounts',
    'goalTargets',
    'goalCurrentAmounts',
    'xirrInputCount',
  ];
  if (numericKeys.some((key) => Math.abs(left[key] - right[key]) > 1e-8)) return false;
  const months = new Set([
    ...Object.keys(left.transactionMonths),
    ...Object.keys(right.transactionMonths),
  ]);
  return [...months].every((month) => {
    const a = left.transactionMonths[month] ?? { debit: 0, credit: 0 };
    const b = right.transactionMonths[month] ?? { debit: 0, credit: 0 };
    return Math.abs(a.debit - b.debit) <= 1e-8 && Math.abs(a.credit - b.credit) <= 1e-8;
  });
}

function rowCounts(
  collections: DataExportCollections,
): Readonly<Record<DataExportCollection, number>> {
  return Object.freeze(
    Object.fromEntries(
      DATA_EXPORT_COLLECTIONS.map((name) => [name, collections[name].length]),
    ) as Record<DataExportCollection, number>,
  );
}

function setForRows(rows: readonly JsonRecord[]): Set<string> {
  return new Set(rows.flatMap((row) => (rowId(row) ? [rowId(row) as string] : [])));
}

function toServerRow(row: JsonRecord, targetUserId: string): JsonRecord {
  const serverRow: Record<string, unknown> = { ...row, user_id: targetUserId };
  for (const [key, value] of Object.entries(serverRow)) {
    if (BOOLEAN_COLUMNS.has(key)) serverRow[key] = value === true || value === 1 || value === '1';
    if (JSON_COLUMNS.has(key) && typeof value === 'string') {
      try {
        serverRow[key] = JSON.parse(value);
      } catch {
        // parseDataExportBundle already rejects malformed JSON; keep a safe fallback.
        serverRow[key] = value;
      }
    }
  }
  return Object.freeze(serverRow);
}

export function prepareServerRestoreCollections(
  collections: DataExportCollections,
  targetUserId: string,
): DataExportCollections {
  return Object.freeze(
    Object.fromEntries(
      DATA_EXPORT_COLLECTIONS.map((name) => [
        name,
        Object.freeze(collections[name].map((row) => toServerRow(row, targetUserId))),
      ]),
    ) as unknown as DataExportCollections,
  );
}

function categoryOrder(
  rows: readonly JsonRecord[],
  conflicts: RestoreConflict[],
): readonly JsonRecord[] {
  const byId = new Map(
    rows.flatMap((row) => (rowId(row) ? [[rowId(row) as string, row] as const] : [])),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: JsonRecord[] = [];
  const visit = (row: JsonRecord): void => {
    const id = rowId(row);
    if (!id || visited.has(id)) return;
    if (visiting.has(id)) {
      conflicts.push({
        kind: 'cyclic-reference',
        collection: 'categories',
        rowId: id,
        detail: 'Category parent cycle detected',
        blocking: true,
      });
      return;
    }
    visiting.add(id);
    const parentId = stringValue(row.parent_id);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) visit(parent);
    else if (parentId) {
      conflicts.push({
        kind: 'missing-reference',
        collection: 'categories',
        rowId: id,
        detail: `Parent category ${parentId} is not in the bundle`,
        blocking: true,
      });
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(row);
  };
  rows.forEach(visit);
  return ordered;
}

function dependencyRows(
  collections: DataExportCollections,
  conflicts: RestoreConflict[],
): DataExportCollections {
  return {
    ...collections,
    categories: categoryOrder(collections.categories, conflicts),
  };
}

function addReferenceConflict(
  conflicts: RestoreConflict[],
  collection: DataExportCollection,
  row: JsonRecord,
  reference: string,
  available: Set<string>,
): void {
  if (!available.has(reference)) {
    conflicts.push({
      kind: 'missing-reference',
      collection,
      rowId: rowId(row),
      detail: `Referenced row ${reference} is not available`,
      blocking: true,
    });
  }
}

function checkReferences(
  collections: DataExportCollections,
  available: Readonly<Record<DataExportCollection, Set<string>>>,
  conflicts: RestoreConflict[],
): void {
  for (const row of collections.transactions) {
    if (typeof row.account_id === 'string')
      addReferenceConflict(conflicts, 'transactions', row, row.account_id, available.accounts);
    if (typeof row.category_id === 'string')
      addReferenceConflict(conflicts, 'transactions', row, row.category_id, available.categories);
  }
  for (const row of collections.budgets) {
    if (typeof row.category_id === 'string')
      addReferenceConflict(conflicts, 'budgets', row, row.category_id, available.categories);
  }
  for (const row of collections.holdings) {
    if (typeof row.account_id === 'string')
      addReferenceConflict(conflicts, 'holdings', row, row.account_id, available.accounts);
  }
  for (const row of collections.holding_events) {
    if (typeof row.holding_id === 'string')
      addReferenceConflict(conflicts, 'holding_events', row, row.holding_id, available.holdings);
  }
  for (const row of collections.valuations) {
    if (typeof row.holding_id === 'string')
      addReferenceConflict(conflicts, 'valuations', row, row.holding_id, available.holdings);
  }
  for (const row of collections.goals) {
    const linked = row.linked_holding_ids;
    const ids = Array.isArray(linked)
      ? linked
      : typeof linked === 'string'
        ? (() => {
            try {
              return JSON.parse(linked) as unknown;
            } catch {
              return [];
            }
          })()
        : [];
    if (Array.isArray(ids))
      ids
        .filter((id): id is string => typeof id === 'string')
        .forEach((id) => addReferenceConflict(conflicts, 'goals', row, id, available.holdings));
  }
}

function sourceAccountIds(collections: DataExportCollections): Set<string> {
  return new Set(
    DATA_EXPORT_COLLECTIONS.flatMap((name) =>
      collections[name].flatMap((row) => (sourceUserId(row) ? [sourceUserId(row) as string] : [])),
    ),
  );
}

function buildConflicts(
  bundleCollections: DataExportCollections,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
  complete: boolean,
): RestoreConflict[] {
  const conflicts: RestoreConflict[] = [];
  if (!complete) {
    conflicts.push({
      kind: 'incomplete-backup',
      collection: 'account',
      rowId: null,
      detail: 'Only a complete backup can be restored; export warnings must be resolved first',
      blocking: true,
    });
  }
  const sourceIds = sourceAccountIds(bundleCollections);
  if (sourceIds.size > 1) {
    conflicts.push({
      kind: 'mixed-source-accounts',
      collection: 'account',
      rowId: null,
      detail: 'Bundle contains rows from more than one source account',
      blocking: true,
    });
  }
  const currentHasRows = DATA_EXPORT_COLLECTIONS.some(
    (name) => currentCollections[name].length > 0,
  );
  if (mode === 'empty' && currentHasRows) {
    conflicts.push({
      kind: 'target-not-empty',
      collection: 'account',
      rowId: null,
      detail: 'Empty restore requires a clean target account',
      blocking: true,
    });
  }
  for (const name of DATA_EXPORT_COLLECTIONS) {
    const seen = new Set<string>();
    const existing = setForRows(currentCollections[name]);
    for (const row of bundleCollections[name]) {
      const id = rowId(row);
      if (!id || !UUID_PATTERN.test(id))
        conflicts.push({
          kind: 'missing-id',
          collection: name,
          rowId: id,
          detail: 'Every restore row needs a UUID id',
          blocking: true,
        });
      if (!sourceUserId(row))
        conflicts.push({
          kind: 'missing-user-id',
          collection: name,
          rowId: id,
          detail: 'Every restore row needs a user_id',
          blocking: true,
        });
      if (id && seen.has(id))
        conflicts.push({
          kind: 'duplicate-id',
          collection: name,
          rowId: id,
          detail: 'The bundle contains the same id more than once',
          blocking: true,
        });
      if (id) seen.add(id);
      if (id && existing.has(id) && mode === 'merge')
        conflicts.push({
          kind: 'existing-row',
          collection: name,
          rowId: id,
          detail: 'Merge mode skips an existing target row',
          blocking: false,
        });
    }
  }
  return conflicts;
}

function projectedCollections(
  bundleCollections: DataExportCollections,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
): DataExportCollections {
  if (mode === 'replace' || mode === 'empty') return bundleCollections;
  return Object.fromEntries(
    DATA_EXPORT_COLLECTIONS.map((name) => {
      const existingIds = setForRows(currentCollections[name]);
      const missing = bundleCollections[name].filter(
        (row) => !rowId(row) || !existingIds.has(rowId(row) as string),
      );
      return [name, [...currentCollections[name], ...missing]];
    }),
  ) as unknown as DataExportCollections;
}

function operationRows(
  collections: DataExportCollections,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
): DataExportCollections {
  if (mode !== 'merge') return collections;
  return Object.fromEntries(
    DATA_EXPORT_COLLECTIONS.map((name) => {
      const existingIds = setForRows(currentCollections[name]);
      return [
        name,
        collections[name].filter((row) => !rowId(row) || !existingIds.has(rowId(row) as string)),
      ];
    }),
  ) as unknown as DataExportCollections;
}

function buildOperations(
  incoming: DataExportCollections,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
  conflicts: RestoreConflict[],
): readonly RestoreOperation[] {
  const ordered = dependencyRows(incoming, conflicts);
  const operations: RestoreOperation[] = [];
  if (mode === 'replace') {
    [...DEPENDENCY_ORDER].reverse().forEach((name) => {
      currentCollections[name].forEach((row) => {
        const id = rowId(row);
        if (id) operations.push({ table: name, id, op: 'DELETE' });
      });
    });
  }
  DEPENDENCY_ORDER.forEach((name) => {
    ordered[name].forEach((row) => {
      const id = rowId(row);
      if (id) operations.push({ table: name, id, op: 'PUT', data: row });
    });
  });
  return Object.freeze(operations);
}

export function createRestorePlan(
  bundle: DataExportBundle,
  targetUserId: string,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
): RestorePlan {
  if (!UUID_PATTERN.test(targetUserId)) throw new Error('Restore target user id must be a UUID');
  if (!RESTORE_MODES.includes(mode)) throw new Error(`Unsupported restore mode: ${mode}`);
  const conflicts = buildConflicts(bundle.collections, currentCollections, mode, bundle.complete);
  const incoming = operationRows(bundle.collections, currentCollections, mode);
  const available = Object.fromEntries(
    DATA_EXPORT_COLLECTIONS.map((name) => [
      name,
      new Set([...setForRows(currentCollections[name]), ...setForRows(bundle.collections[name])]),
    ]),
  ) as Record<DataExportCollection, Set<string>>;
  if (mode !== 'replace') checkReferences(incoming, available, conflicts);
  else
    checkReferences(
      incoming,
      Object.fromEntries(
        DATA_EXPORT_COLLECTIONS.map((name) => [name, setForRows(bundle.collections[name])]),
      ) as Record<DataExportCollection, Set<string>>,
      conflicts,
    );
  const operations = buildOperations(incoming, currentCollections, mode, conflicts);
  const projected = projectedCollections(bundle.collections, currentCollections, mode);
  const sourceTotals = calculateRestoreTotals(bundle.collections);
  const targetTotalsBefore = calculateRestoreTotals(currentCollections);
  const projectedTotals = calculateRestoreTotals(projected);
  const warnings = [
    ...(mode === 'merge' && conflicts.some((conflict) => conflict.kind === 'existing-row')
      ? ['Existing rows are preserved; merge only adds missing rows.']
      : []),
    ...(mode === 'replace'
      ? ['Replace mode deletes all target rows inside the server transaction.']
      : []),
    ...(conflicts.some((conflict) => conflict.kind === 'missing-reference')
      ? ['Restore is blocked until every dependency is present.']
      : []),
  ];
  const canApply = conflicts.every((conflict) => !conflict.blocking);
  const serverCollections = prepareServerRestoreCollections(incoming, targetUserId);
  return Object.freeze({
    schemaVersion: bundle.schemaVersion,
    mode,
    targetUserId,
    sourceAccountFingerprint: bundle.accountFingerprint,
    sourceTotals,
    targetTotalsBefore,
    projectedTotals,
    totalsMatchSource: totalsEqual(sourceTotals, projectedTotals),
    sourceRowCounts: rowCounts(bundle.collections),
    projectedRowCounts: rowCounts(projected),
    conflicts: Object.freeze(conflicts),
    warnings: Object.freeze(warnings),
    operations,
    serverCollections,
    canApply,
  });
}

export function createRestoreReport(
  plan: RestorePlan,
  restoreId: string,
  result: {
    readonly status: 'dry-run' | 'applied' | 'already_applied';
    readonly appliedAt?: string | null;
  } = { status: 'dry-run' },
): RestoreReport {
  return Object.freeze({
    kind: 'restore-report',
    schemaVersion: plan.schemaVersion,
    restoreId,
    mode: plan.mode,
    dryRun: result.status === 'dry-run',
    applied: result.status !== 'dry-run',
    appliedAt: result.appliedAt ?? null,
    targetUserId: plan.targetUserId,
    sourceAccountFingerprint: plan.sourceAccountFingerprint,
    sourceRowCounts: plan.sourceRowCounts,
    projectedRowCounts: plan.projectedRowCounts,
    sourceTotals: plan.sourceTotals,
    targetTotalsBefore: plan.targetTotalsBefore,
    projectedTotals: plan.projectedTotals,
    totalsMatchSource: plan.totalsMatchSource,
    conflicts: plan.conflicts,
    warnings: plan.warnings,
    operationCount: plan.operations.length,
    serverStatus: result.status,
  });
}

export function parseAndPlanRestore(
  text: string,
  targetUserId: string,
  currentCollections: DataExportCollections,
  mode: RestoreMode,
): RestorePlan {
  return createRestorePlan(parseDataExportBundle(text), targetUserId, currentCollections, mode);
}
