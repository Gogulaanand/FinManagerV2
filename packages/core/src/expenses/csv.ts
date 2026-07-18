import type { CsvField, CsvImportRow, CsvMapping, Direction } from '@finmanager/schema';

import { roundToPaise } from '../money.js';

export interface CsvDocument {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface CsvPreviewError {
  readonly sourceRow: number;
  readonly message: string;
}

export interface CsvImportPreview {
  readonly rows: readonly CsvImportRow[];
  readonly errors: readonly CsvPreviewError[];
}

function pushCell(cells: string[], value: string): void {
  cells.push(value.trim());
}

export function parseCsv(text: string): CsvDocument {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      pushCell(row, cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && next === '\n') index += 1;
      pushCell(row, cell);
      if (row.some((value) => value !== '')) records.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell !== '' || row.length > 0) {
    pushCell(row, cell);
    if (row.some((value) => value !== '')) records.push(row);
  }
  const [headers = [], ...rows] = records;
  return { headers, rows };
}

function fieldHeader(mapping: CsvMapping, field: CsvField): string | undefined {
  return Object.entries(mapping.columns).find(([, mappedField]) => mappedField === field)?.[0];
}

function valueAt(
  headers: readonly string[],
  row: readonly string[],
  header: string | undefined,
): string {
  if (!header) return '';
  const index = headers.findIndex((value) => value.toLowerCase() === header.toLowerCase());
  return index < 0 ? '' : (row[index] ?? '');
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(/[₹,$\s]/g, '').replace(/^\((.*)\)$/, '$1');
  if (!normalized) return null;
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) && amount > 0 ? roundToPaise(Math.abs(amount)) : null;
}

function parseDate(value: string): string | null {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function directionAndAmount(
  headers: readonly string[],
  row: readonly string[],
  mapping: CsvMapping,
): { amount: number; direction: Direction } | null {
  const debit = parseAmount(valueAt(headers, row, fieldHeader(mapping, 'debit')));
  const credit = parseAmount(valueAt(headers, row, fieldHeader(mapping, 'credit')));
  if (debit !== null && credit !== null) return null;
  if (debit !== null) return { amount: debit, direction: 'debit' };
  if (credit !== null) return { amount: credit, direction: 'credit' };
  const amount = parseAmount(valueAt(headers, row, fieldHeader(mapping, 'amount')));
  return amount === null ? null : { amount, direction: 'debit' };
}

export function canonicalImportHash(
  accountId: string,
  row: Pick<
    CsvImportRow,
    'sourceRow' | 'occurredOn' | 'note' | 'merchant' | 'amount' | 'direction'
  >,
): string {
  return [
    accountId,
    row.sourceRow,
    row.occurredOn,
    row.note ?? '',
    row.merchant ?? '',
    row.amount.toFixed(2),
    row.direction,
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join('\u001f');
}

export function previewCsv(
  document: CsvDocument,
  mapping: CsvMapping,
  accountId: string,
): CsvImportPreview {
  const rows: CsvImportRow[] = [];
  const errors: CsvPreviewError[] = [];
  const dateHeader = fieldHeader(mapping, 'date');
  const descriptionHeader = fieldHeader(mapping, 'description');
  const merchantHeader = fieldHeader(mapping, 'merchant');
  for (const [index, source] of document.rows.entries()) {
    const sourceRow = index + 2;
    const occurredOn = parseDate(valueAt(document.headers, source, dateHeader));
    if (!occurredOn) {
      errors.push({ sourceRow, message: 'Date is required' });
      continue;
    }
    const parsed = directionAndAmount(document.headers, source, mapping);
    if (!parsed) {
      errors.push({ sourceRow, message: 'Amount is required' });
      continue;
    }
    const note = valueAt(document.headers, source, descriptionHeader) || null;
    const merchant = valueAt(document.headers, source, merchantHeader) || null;
    const row: CsvImportRow = {
      sourceRow,
      error: null,
      accountId,
      categoryId: mapping.defaultCategoryId,
      amount: parsed.amount,
      direction: parsed.direction,
      currency: 'INR',
      occurredOn,
      note,
      merchant,
      importHash: null,
    };
    rows.push({ ...row, importHash: canonicalImportHash(accountId, row) });
  }
  return { rows, errors };
}
