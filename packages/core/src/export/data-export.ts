import {
  AccountSchema,
  AiSummarySchema,
  BudgetSchema,
  CategorySchema,
  DeadmanSettingsSchema,
  EscalationEventSchema,
  FireSettingsSchema,
  GoalSchema,
  HoldingEventSchema,
  HoldingSchema,
  TransactionSchema,
  TrustedContactSchema,
  ValuationSchema,
} from '@finmanager/schema';

export const DATA_EXPORT_SCHEMA_VERSION = 2 as const;
export const DATA_EXPORT_APP_VERSION = '0.0.0' as const;

export const DATA_EXPORT_COLLECTIONS = [
  'profiles',
  'trusted_contacts',
  'activity_log',
  'tax_scenarios',
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'holdings',
  'holding_events',
  'valuations',
  'goals',
  'fire_settings',
  'ai_summaries',
  'deadman_settings',
  'escalation_events',
] as const;

export const DATA_EXPORT_SOURCE_PLATFORMS = ['web', 'mobile', 'unknown'] as const;
export const DATA_EXPORT_WARNING_CODES = [
  'initial-sync-incomplete',
  'pending-writes',
  'unresolved-failed-writes',
  'sync-errors',
] as const;

export type DataExportCollection = (typeof DATA_EXPORT_COLLECTIONS)[number];
export type DataExportSourcePlatform = (typeof DATA_EXPORT_SOURCE_PLATFORMS)[number];
export type DataExportWarningCode = (typeof DATA_EXPORT_WARNING_CODES)[number];
export type JsonRecord = Readonly<Record<string, unknown>>;
export type DataExportCollections = Readonly<Record<DataExportCollection, readonly JsonRecord[]>>;

export interface DataExportSyncState {
  readonly hasSynced: boolean;
  readonly connected: boolean;
  readonly lastSyncedAt: string | null;
  readonly pendingWrites: number;
  readonly unresolvedFailures: number;
  readonly blockedFailures: number;
  readonly uploadError: boolean;
  readonly downloadError: boolean;
}

export interface DataExportBundleOptions {
  readonly exportedAt?: string;
  readonly appVersion?: string;
  readonly accountFingerprint?: string | null;
  readonly sourcePlatform?: DataExportSourcePlatform;
  readonly syncState?: Partial<DataExportSyncState>;
  /** Required to mark a backup complete when pending writes remain. */
  readonly acknowledgePendingWrites?: boolean;
  /** Reject the export unless the complete-backup safety gate passes. */
  readonly requireComplete?: boolean;
}

export interface DataExportBundle {
  readonly schemaVersion: typeof DATA_EXPORT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly accountFingerprint: string | null;
  readonly sourcePlatform: DataExportSourcePlatform;
  readonly syncState: DataExportSyncState;
  readonly rowCounts: Readonly<Record<DataExportCollection, number>>;
  readonly checksums: Readonly<Record<DataExportCollection, string>>;
  readonly warnings: readonly DataExportWarningCode[];
  readonly complete: boolean;
  readonly pendingWritesAcknowledged: boolean;
  readonly collections: DataExportCollections;
}

type DomainSchema = {
  safeParse: (value: unknown) => { success: boolean };
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function requiredString(row: JsonRecord, key: string): string {
  return String(row[key]);
}

function numberValue(value: unknown, fallback: number | null = null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function jsonValue(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Export data contains invalid JSON');
  }
}

function assertSchema(
  collection: DataExportCollection,
  index: number,
  schema: DomainSchema,
  value: unknown,
): void {
  if (!schema.safeParse(value).success) {
    throw new Error(`Export row ${collection}[${index}] failed domain validation`);
  }
}

function validateStorageRow(
  collection: DataExportCollection,
  index: number,
  row: JsonRecord,
): void {
  if (row.id !== undefined && typeof row.id !== 'string') {
    throw new Error(`Export row ${collection}[${index}] has an invalid id`);
  }
  if (row.user_id !== undefined && typeof row.user_id !== 'string') {
    throw new Error(`Export row ${collection}[${index}] has an invalid user_id`);
  }
  for (const key of ['csv_mappings', 'metadata', 'input', 'detail']) {
    if (row[key] !== undefined && row[key] !== null) jsonValue(row[key]);
  }
}

function validateDomainRow(collection: DataExportCollection, index: number, row: JsonRecord): void {
  switch (collection) {
    case 'accounts':
      assertSchema(collection, index, AccountSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        name: String(row.name ?? ''),
        type: row.type,
        institution: stringValue(row.institution),
        currency: row.currency ?? 'INR',
        currentBalance: numberValue(row.current_balance, 0),
        isActive: booleanValue(row.is_active),
      });
      return;
    case 'categories':
      assertSchema(collection, index, CategorySchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        name: String(row.name ?? ''),
        kind: row.kind,
        icon: stringValue(row.icon),
        color: stringValue(row.color),
        parentId: stringValue(row.parent_id),
        isSystem: booleanValue(row.is_system),
        sortOrder: numberValue(row.sort_order, 0),
      });
      return;
    case 'transactions':
      assertSchema(collection, index, TransactionSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        accountId: stringValue(row.account_id),
        categoryId: stringValue(row.category_id),
        amount: numberValue(row.amount, 0),
        direction: row.direction,
        currency: row.currency ?? 'INR',
        occurredOn: String(row.occurred_on),
        note: stringValue(row.note),
        merchant: stringValue(row.merchant),
        isRecurring: booleanValue(row.is_recurring),
        recurringId: stringValue(row.recurring_id),
        recurrenceFrequency: stringValue(row.recurrence_frequency),
        recurrenceInterval: numberValue(row.recurrence_interval, 1),
        recurrenceEndOn: stringValue(row.recurrence_end_on),
        recurrenceGeneratedThrough: stringValue(row.recurrence_generated_through),
        importHash: stringValue(row.import_hash),
        occurrenceKey: stringValue(row.occurrence_key),
      });
      return;
    case 'budgets':
      assertSchema(collection, index, BudgetSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        categoryId: stringValue(row.category_id),
        period: row.period ?? 'monthly',
        periodStart: String(row.period_start),
        amount: numberValue(row.amount, 0),
      });
      return;
    case 'holdings':
      assertSchema(collection, index, HoldingSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        name: String(row.name ?? ''),
        type: row.type,
        identifier: stringValue(row.identifier),
        accountId: stringValue(row.account_id),
        currency: row.currency ?? 'INR',
        quantity: numberValue(row.quantity, 0),
        avgCost: numberValue(row.avg_cost),
        currentPrice: numberValue(row.current_price),
        currentValue: numberValue(row.current_value),
        manualPriceOverride: numberValue(row.manual_price_override),
        manualValueOverride: numberValue(row.manual_value_override),
        manualFxRateToInr: numberValue(row.manual_fx_rate_to_inr),
        automaticPrice: numberValue(row.automatic_price),
        automaticPriceAsOf: stringValue(row.automatic_price_as_of),
        automaticPriceSource: stringValue(row.automatic_price_source),
        automaticPriceProvider: stringValue(row.automatic_price_provider),
        automaticPriceFxRateToInr: numberValue(row.automatic_price_fx_rate_to_inr),
        metadata: jsonValue(row.metadata),
        isActive: booleanValue(row.is_active),
      });
      return;
    case 'holding_events':
      assertSchema(collection, index, HoldingEventSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        holdingId: requiredString(row, 'holding_id'),
        kind: row.kind,
        occurredOn: String(row.occurred_on),
        quantity: numberValue(row.quantity),
        price: numberValue(row.price),
        amount: numberValue(row.amount, 0),
        currency: row.currency ?? 'INR',
        fxRateToInr: numberValue(row.fx_rate_to_inr),
        note: stringValue(row.note),
        importHash: stringValue(row.import_hash),
      });
      return;
    case 'valuations':
      assertSchema(collection, index, ValuationSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        holdingId: requiredString(row, 'holding_id'),
        asOf: String(row.as_of),
        value: numberValue(row.value, 0),
        currency: row.currency ?? 'INR',
        fxRateToInr: numberValue(row.fx_rate_to_inr),
        source: stringValue(row.source),
      });
      return;
    case 'goals':
      assertSchema(collection, index, GoalSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        name: String(row.name ?? ''),
        kind: row.kind,
        targetAmount: numberValue(row.target_amount, 0),
        targetDate: stringValue(row.target_date),
        currentAmount: numberValue(row.current_amount, 0),
        expectedReturn: numberValue(row.expected_return),
        inflation: numberValue(row.inflation),
        linkedHoldingIds: jsonValue(row.linked_holding_ids) ?? [],
        notes: stringValue(row.notes),
      });
      return;
    case 'fire_settings':
      assertSchema(collection, index, FireSettingsSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        annualExpenses: numberValue(row.annual_expenses),
        withdrawalRate: numberValue(row.withdrawal_rate, 4),
        expectedReturn: numberValue(row.expected_return),
        inflation: numberValue(row.inflation),
        currentAge: numberValue(row.current_age),
        retirementAge: numberValue(row.retirement_age),
        leanMultiplier: numberValue(row.lean_multiplier),
        fatMultiplier: numberValue(row.fat_multiplier),
        monthlyInvestment: numberValue(row.monthly_investment),
      });
      return;
    case 'ai_summaries':
      assertSchema(collection, index, AiSummarySchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        month: row.month,
        scope: row.scope ?? 'everything',
        content: row.content,
        generatedAt: row.generated_at,
      });
      return;
    case 'deadman_settings':
      assertSchema(collection, index, DeadmanSettingsSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        isEnabled: booleanValue(row.is_enabled),
        thresholdDays: numberValue(row.threshold_days, 30),
        disclosureNote: stringValue(row.disclosure_note),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      return;
    case 'trusted_contacts':
      assertSchema(collection, index, TrustedContactSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        name: row.name,
        email: stringValue(row.email),
        phone: stringValue(row.phone),
        relationship: stringValue(row.relationship),
        disclosureScope: row.disclosure_scope ?? 'existence',
        notifyAfterDays: numberValue(row.notify_after_days, 30),
        priority: numberValue(row.priority, 0),
        isActive: booleanValue(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      return;
    case 'escalation_events':
      assertSchema(collection, index, EscalationEventSchema, {
        id: requiredString(row, 'id'),
        userId: requiredString(row, 'user_id'),
        kind: row.kind,
        status: row.status,
        recipient: stringValue(row.recipient),
        detail: jsonValue(row.detail),
        createdAt: row.created_at,
        sentAt: row.sent_at,
      });
      return;
    case 'profiles':
    case 'activity_log':
    case 'tax_scenarios':
      validateStorageRow(collection, index, row);
      return;
  }
}

function validateCollections(collections: DataExportCollections): void {
  for (const name of DATA_EXPORT_COLLECTIONS) {
    const rows = collections[name];
    if (!Array.isArray(rows)) throw new Error(`Missing export collection: ${name}`);
    rows.forEach((row, index) => {
      if (!isRecord(row)) throw new Error(`Export collection ${name}[${index}] must be an object`);
      validateDomainRow(name, index, row);
    });
  }
}

function jsonClone(collections: DataExportCollections): DataExportCollections {
  const serialized = JSON.stringify(collections);
  if (serialized === undefined) throw new Error('Export data is not JSON serializable');
  const cloned: unknown = JSON.parse(serialized);
  if (!isRecord(cloned)) throw new Error('Export data is not JSON serializable');
  return cloned as DataExportCollections;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Export value is not JSON serializable');
  return serialized;
}

function checksum(value: unknown): string {
  let hash = 0x811c9dc5;
  for (const character of stableJson(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Returns a stable, non-reversible account label without putting the user id in an export. */
export function accountFingerprintForUserId(userId: string): string {
  if (!userId) throw new Error('Cannot fingerprint an empty user id');
  return `acct_${checksum(`finmanager-account:${userId}`)}`;
}

const COMPLETE_SYNC_STATE: DataExportSyncState = {
  hasSynced: true,
  connected: true,
  lastSyncedAt: null,
  pendingWrites: 0,
  unresolvedFailures: 0,
  blockedFailures: 0,
  uploadError: false,
  downloadError: false,
};

const UNKNOWN_SYNC_STATE: DataExportSyncState = {
  hasSynced: false,
  connected: false,
  lastSyncedAt: null,
  pendingWrites: 0,
  unresolvedFailures: 0,
  blockedFailures: 0,
  uploadError: false,
  downloadError: false,
};

function normalizeSyncState(value: Partial<DataExportSyncState> | undefined): DataExportSyncState {
  const state = { ...UNKNOWN_SYNC_STATE, ...value };
  for (const key of ['hasSynced', 'connected', 'uploadError', 'downloadError'] as const) {
    if (typeof state[key] !== 'boolean') {
      throw new Error(`Sync state ${key} must be a boolean`);
    }
  }
  for (const key of ['pendingWrites', 'unresolvedFailures', 'blockedFailures'] as const) {
    if (!Number.isInteger(state[key]) || state[key] < 0) {
      throw new Error(`Sync state ${key} must be a non-negative integer`);
    }
  }
  if (
    state.lastSyncedAt !== null &&
    (typeof state.lastSyncedAt !== 'string' || Number.isNaN(Date.parse(state.lastSyncedAt)))
  ) {
    throw new Error('Sync state lastSyncedAt must be an ISO timestamp or null');
  }
  return {
    hasSynced: Boolean(state.hasSynced),
    connected: Boolean(state.connected),
    lastSyncedAt: state.lastSyncedAt,
    pendingWrites: state.pendingWrites,
    unresolvedFailures: state.unresolvedFailures,
    blockedFailures: state.blockedFailures,
    uploadError: Boolean(state.uploadError),
    downloadError: Boolean(state.downloadError),
  };
}

function warningsFor(state: DataExportSyncState): DataExportWarningCode[] {
  const warnings: DataExportWarningCode[] = [];
  if (!state.hasSynced) warnings.push('initial-sync-incomplete');
  if (state.pendingWrites > 0) warnings.push('pending-writes');
  if (state.unresolvedFailures > 0) warnings.push('unresolved-failed-writes');
  if (state.uploadError || state.downloadError) warnings.push('sync-errors');
  return warnings;
}

function completeFor(state: DataExportSyncState, pendingWritesAcknowledged: boolean): boolean {
  return (
    state.hasSynced &&
    state.unresolvedFailures === 0 &&
    (state.pendingWrites === 0 || pendingWritesAcknowledged) &&
    !state.uploadError &&
    !state.downloadError
  );
}

function assertComplete(state: DataExportSyncState, pendingWritesAcknowledged: boolean): void {
  if (!state.hasSynced) throw new Error('Complete backup requires one full sync to finish first.');
  if (state.unresolvedFailures > 0) {
    throw new Error('Complete backup is blocked while unresolved failed writes remain.');
  }
  if (state.pendingWrites > 0 && !pendingWritesAcknowledged) {
    throw new Error('Acknowledge pending writes before creating a complete backup.');
  }
  if (state.uploadError || state.downloadError) {
    throw new Error('Complete backup is blocked while sync errors remain.');
  }
}

function normalizeOptions(
  exportedAtOrOptions: string | DataExportBundleOptions | undefined,
): DataExportBundleOptions & {
  readonly exportedAt: string;
  readonly syncState: DataExportSyncState;
} {
  if (typeof exportedAtOrOptions === 'string') {
    return {
      exportedAt: exportedAtOrOptions,
      syncState: COMPLETE_SYNC_STATE,
      acknowledgePendingWrites: true,
    };
  }
  const options = exportedAtOrOptions ?? {};
  return {
    ...options,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    syncState: normalizeSyncState(options.syncState),
  };
}

export function createDataExportBundle(
  collections: DataExportCollections,
  exportedAt?: string,
): DataExportBundle;
export function createDataExportBundle(
  collections: DataExportCollections,
  options?: DataExportBundleOptions,
): DataExportBundle;
export function createDataExportBundle(
  collections: DataExportCollections,
  exportedAtOrOptions?: string | DataExportBundleOptions,
): DataExportBundle {
  const options = normalizeOptions(exportedAtOrOptions);
  if (Number.isNaN(Date.parse(options.exportedAt))) {
    throw new Error('Export timestamp must be ISO-8601');
  }
  validateCollections(collections);
  const pendingWritesAcknowledged = Boolean(options.acknowledgePendingWrites);
  if (options.requireComplete) assertComplete(options.syncState, pendingWritesAcknowledged);
  const clonedCollections = jsonClone(collections);
  const rowCounts = {} as Record<DataExportCollection, number>;
  const checksums = {} as Record<DataExportCollection, string>;
  for (const name of DATA_EXPORT_COLLECTIONS) {
    rowCounts[name] = clonedCollections[name].length;
    checksums[name] = checksum(clonedCollections[name]);
  }
  return {
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: options.exportedAt,
    appVersion: options.appVersion ?? DATA_EXPORT_APP_VERSION,
    accountFingerprint: options.accountFingerprint ?? null,
    sourcePlatform: options.sourcePlatform ?? 'unknown',
    syncState: options.syncState,
    rowCounts,
    checksums,
    warnings: warningsFor(options.syncState),
    complete: completeFor(options.syncState, pendingWritesAcknowledged),
    pendingWritesAcknowledged,
    collections: clonedCollections,
  };
}

export function serializeDataExportBundle(bundle: DataExportBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function isSourcePlatform(value: unknown): value is DataExportSourcePlatform {
  return (
    typeof value === 'string' &&
    DATA_EXPORT_SOURCE_PLATFORMS.includes(value as DataExportSourcePlatform)
  );
}

function isWarningCode(value: unknown): value is DataExportWarningCode {
  return (
    typeof value === 'string' && DATA_EXPORT_WARNING_CODES.includes(value as DataExportWarningCode)
  );
}

function parseMetadata(value: JsonRecord): {
  readonly appVersion: string;
  readonly accountFingerprint: string | null;
  readonly sourcePlatform: DataExportSourcePlatform;
  readonly syncState: DataExportSyncState;
  readonly pendingWritesAcknowledged: boolean;
} {
  if (typeof value.appVersion !== 'string' || value.appVersion.length === 0) {
    throw new Error('Backup has an invalid appVersion');
  }
  if (value.accountFingerprint !== null && typeof value.accountFingerprint !== 'string') {
    throw new Error('Backup has an invalid accountFingerprint');
  }
  if (!isSourcePlatform(value.sourcePlatform))
    throw new Error('Backup has an invalid sourcePlatform');
  if (!isRecord(value.syncState)) throw new Error('Backup syncState is missing');
  const syncState = normalizeSyncState(value.syncState as Partial<DataExportSyncState>);
  if (typeof value.pendingWritesAcknowledged !== 'boolean') {
    throw new Error('Backup has an invalid pendingWritesAcknowledged flag');
  }
  return {
    appVersion: value.appVersion,
    accountFingerprint: value.accountFingerprint as string | null,
    sourcePlatform: value.sourcePlatform,
    syncState,
    pendingWritesAcknowledged: value.pendingWritesAcknowledged,
  };
}

function parseCollectionMetadata(value: JsonRecord): {
  readonly rowCounts: Record<DataExportCollection, number>;
  readonly checksums: Record<DataExportCollection, string>;
  readonly warnings: readonly DataExportWarningCode[];
  readonly complete: boolean;
} {
  if (!isRecord(value.rowCounts) || !isRecord(value.checksums) || !Array.isArray(value.warnings)) {
    throw new Error('Backup collection metadata is missing');
  }
  const rowCounts = {} as Record<DataExportCollection, number>;
  const checksums = {} as Record<DataExportCollection, string>;
  for (const name of DATA_EXPORT_COLLECTIONS) {
    if (!Number.isInteger(value.rowCounts[name]) || Number(value.rowCounts[name]) < 0) {
      throw new Error(`Backup row count for ${name} is invalid`);
    }
    if (
      typeof value.checksums[name] !== 'string' ||
      !/^[0-9a-f]{8}$/.test(value.checksums[name] as string)
    ) {
      throw new Error(`Backup checksum for ${name} is invalid`);
    }
    rowCounts[name] = Number(value.rowCounts[name]);
    checksums[name] = value.checksums[name] as string;
  }
  if (!value.warnings.every(isWarningCode) || typeof value.complete !== 'boolean') {
    throw new Error('Backup warning metadata is invalid');
  }
  return { rowCounts, checksums, warnings: value.warnings, complete: value.complete };
}

export function parseDataExportBundle(text: string): DataExportBundle {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Backup is not valid JSON');
  }
  if (!isRecord(value) || value.schemaVersion !== DATA_EXPORT_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version; expected ${DATA_EXPORT_SCHEMA_VERSION}`);
  }
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('Backup has an invalid exportedAt timestamp');
  }
  const metadata = parseMetadata(value);
  const expectedMetadata = parseCollectionMetadata(value);
  if (!isRecord(value.collections)) throw new Error('Backup collections are missing');
  const collections = {} as Record<DataExportCollection, readonly JsonRecord[]>;
  for (const name of DATA_EXPORT_COLLECTIONS) {
    const rows = value.collections[name];
    if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) {
      throw new Error(`Backup collection ${name} must be an array of objects`);
    }
    collections[name] = rows;
  }
  const bundle = createDataExportBundle(collections, {
    exportedAt: value.exportedAt,
    appVersion: metadata.appVersion,
    accountFingerprint: metadata.accountFingerprint,
    sourcePlatform: metadata.sourcePlatform,
    syncState: metadata.syncState,
    acknowledgePendingWrites: metadata.pendingWritesAcknowledged,
  });
  if (
    bundle.complete !== expectedMetadata.complete ||
    JSON.stringify(bundle.warnings) !== JSON.stringify(expectedMetadata.warnings) ||
    JSON.stringify(bundle.rowCounts) !== JSON.stringify(expectedMetadata.rowCounts) ||
    JSON.stringify(bundle.checksums) !== JSON.stringify(expectedMetadata.checksums)
  ) {
    throw new Error('Backup metadata does not match its collections');
  }
  return bundle;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text) || /[",\r\n]/.test(text)) {
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvFor(rows: readonly JsonRecord[], headers: readonly string[]): string {
  return `${[
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')}\n`;
}

export function createModuleCsvExports(
  collections: DataExportCollections,
): Readonly<Record<string, string>> {
  return {
    'transactions.csv': csvFor(collections.transactions, [
      'id',
      'occurred_on',
      'category_id',
      'account_id',
      'amount',
      'direction',
      'currency',
      'merchant',
      'note',
    ]),
    'holdings.csv': csvFor(collections.holdings, [
      'id',
      'name',
      'type',
      'identifier',
      'currency',
      'quantity',
      'avg_cost',
      'current_value',
      'manual_value_override',
    ]),
    'holding-events.csv': csvFor(collections.holding_events, [
      'id',
      'holding_id',
      'kind',
      'occurred_on',
      'quantity',
      'price',
      'amount',
      'currency',
      'fx_rate_to_inr',
      'note',
    ]),
  };
}
