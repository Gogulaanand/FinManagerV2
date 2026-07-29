export const DATA_EXPORT_SCHEMA_VERSION = 1 as const;

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

export type DataExportCollection = (typeof DATA_EXPORT_COLLECTIONS)[number];
export type JsonRecord = Readonly<Record<string, unknown>>;
export type DataExportCollections = Readonly<Record<DataExportCollection, readonly JsonRecord[]>>;

export interface DataExportBundle {
  readonly schemaVersion: typeof DATA_EXPORT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly collections: DataExportCollections;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonClone(collections: DataExportCollections): DataExportCollections {
  const cloned: unknown = JSON.parse(JSON.stringify(collections));
  if (!isRecord(cloned)) throw new Error('Export data is not JSON serializable');
  return cloned as DataExportCollections;
}

export function createDataExportBundle(
  collections: DataExportCollections,
  exportedAt = new Date().toISOString(),
): DataExportBundle {
  if (Number.isNaN(Date.parse(exportedAt))) throw new Error('Export timestamp must be ISO-8601');
  for (const name of DATA_EXPORT_COLLECTIONS) {
    if (!Array.isArray(collections[name])) throw new Error(`Missing export collection: ${name}`);
  }
  return {
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt,
    collections: jsonClone(collections),
  };
}

export function serializeDataExportBundle(bundle: DataExportBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
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
  if (!isRecord(value.collections)) throw new Error('Backup collections are missing');
  const collections = {} as Record<DataExportCollection, readonly JsonRecord[]>;
  for (const name of DATA_EXPORT_COLLECTIONS) {
    const rows = value.collections[name];
    if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) {
      throw new Error(`Backup collection ${name} must be an array of objects`);
    }
    collections[name] = rows;
  }
  return createDataExportBundle(collections, value.exportedAt);
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
