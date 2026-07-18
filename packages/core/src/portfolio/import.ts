import type {
  HoldingEventKind,
  PortfolioImportRow,
  PortfolioImportSource,
} from '@finmanager/schema';

import { parseCsv } from '../expenses/csv.js';
import { roundToPaise } from '../money.js';

export interface PortfolioImportPreviewRow extends PortfolioImportRow {
  readonly sourceRow: number;
  readonly warnings: readonly string[];
}

export interface PortfolioImportPreviewError {
  readonly sourceRow: number;
  readonly message: string;
}

export interface PortfolioImportPreview {
  readonly source: PortfolioImportSource;
  readonly rows: readonly PortfolioImportPreviewRow[];
  readonly errors: readonly PortfolioImportPreviewError[];
}

function normalizedHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function headerIndex(headers: readonly string[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const index = headers.findIndex(
      (header) => normalizedHeader(header) === normalizedHeader(alias),
    );
    if (index >= 0) return index;
  }
  return -1;
}

function cell(
  headers: readonly string[],
  row: readonly string[],
  aliases: readonly string[],
): string {
  const index = headerIndex(headers, aliases);
  return index < 0 ? '' : (row[index] ?? '').trim();
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[₹,$\s]/g, '').replace(/^\((.*)\)$/, '$1');
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) && amount > 0 ? roundToPaise(Math.abs(amount)) : null;
}

function parseDate(value: string): string | null {
  const normalized = value.trim();
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(normalized);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : match
      ? `${match[3]}-${match[2]}-${match[1]}`
      : null;
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

function kindFor(value: string): HoldingEventKind | null {
  const normalized = value.trim().toLowerCase();
  if (/(buy|purchase|sip|switch.?in|allot)/.test(normalized)) return 'buy';
  if (/(sell|redemption|switch.?out)/.test(normalized)) return 'sell';
  if (/(dividend|payout)/.test(normalized)) return 'dividend';
  if (/(interest)/.test(normalized)) return 'interest';
  if (/(contribution|deposit)/.test(normalized)) return 'contribution';
  if (/(withdrawal|withdraw)/.test(normalized)) return 'withdrawal';
  return null;
}

function requiredHeaders(headers: readonly string[], source: PortfolioImportSource): string | null {
  const required =
    source === 'zerodha'
      ? [['trade_date'], ['symbol'], ['trade_type'], ['quantity'], ['price'], ['trade_value']]
      : source === 'cams'
        ? [['date'], ['scheme_name'], ['transaction_type'], ['units'], ['nav'], ['amount']]
        : [['transaction_date'], ['scheme'], ['transaction'], ['units'], ['price'], ['amount']];
  const missing = required
    .filter((aliases) => headerIndex(headers, aliases) < 0)
    .map((aliases) => aliases[0]);
  return missing.length > 0 ? `Unsupported ${source} headers; missing ${missing.join(', ')}` : null;
}

function buildRow(
  source: PortfolioImportSource,
  accountId: string | null,
  headers: readonly string[],
  values: readonly string[],
  sourceRow: number,
): { readonly row: PortfolioImportPreviewRow | null; readonly error: string | null } {
  const date = parseDate(
    cell(
      headers,
      values,
      source === 'zerodha' ? ['trade_date'] : source === 'cams' ? ['date'] : ['transaction_date'],
    ),
  );
  const name = cell(
    headers,
    values,
    source === 'zerodha' ? ['symbol'] : source === 'cams' ? ['scheme_name'] : ['scheme'],
  );
  const identifier = cell(
    headers,
    values,
    source === 'zerodha'
      ? ['isin', 'symbol']
      : source === 'cams'
        ? ['isin', 'scheme_code', 'folio_no']
        : ['isin', 'scheme_code', 'account_number'],
  );
  const kind = kindFor(
    cell(
      headers,
      values,
      source === 'zerodha'
        ? ['trade_type']
        : source === 'cams'
          ? ['transaction_type']
          : ['transaction'],
    ),
  );
  const quantity = parseAmount(cell(headers, values, ['quantity', 'units']));
  const price = parseAmount(cell(headers, values, ['price', 'nav']));
  const amount = parseAmount(cell(headers, values, ['trade_value', 'amount']));
  if (!date || !name || !kind || amount === null)
    return { row: null, error: 'Date, instrument, kind, and amount are required' };
  const signedAmount = ['buy', 'contribution'].includes(kind) ? -amount : amount;
  const identity = source === 'zerodha' ? identifier : `${identifier || 'unidentified'}:${name}`;
  const row: PortfolioImportPreviewRow = {
    source,
    sourceRow,
    warnings: identifier ? [] : ['Instrument identifier is missing; name will be used'],
    accountId,
    name,
    type: source === 'zerodha' ? 'stock' : 'mutual_fund',
    identifier: identity || null,
    currency: 'INR',
    occurredOn: date,
    kind,
    quantity,
    price,
    amount: signedAmount,
    fxRateToInr: 1,
    note:
      cell(
        headers,
        values,
        source === 'zerodha' ? ['trade_id', 'order_id'] : ['folio_no', 'account_number'],
      ) || null,
    importHash: '',
  };
  return { row: { ...row, importHash: canonicalPortfolioImportHash(row) }, error: null };
}

export function canonicalPortfolioImportHash(
  row: Omit<PortfolioImportPreviewRow, 'importHash'> | PortfolioImportPreviewRow,
): string {
  return [
    row.source,
    row.accountId ?? '',
    row.identifier ?? row.name,
    row.note ?? '',
    row.occurredOn,
    row.kind,
    row.quantity?.toFixed(8) ?? '',
    row.price?.toFixed(8) ?? '',
    row.amount.toFixed(2),
    row.currency,
  ]
    .map((value) => value.trim().toLowerCase())
    .join('\u001f');
}

export function parsePortfolioCsv(
  source: PortfolioImportSource,
  text: string,
  accountId: string | null,
): PortfolioImportPreview {
  const document = parseCsv(text);
  const errors: PortfolioImportPreviewError[] = [];
  const rows: PortfolioImportPreviewRow[] = [];
  const headerError = requiredHeaders(document.headers, source);
  if (headerError) return { source, rows, errors: [{ sourceRow: 1, message: headerError }] };
  for (const [index, values] of document.rows.entries()) {
    const sourceRow = index + 2;
    const result = buildRow(source, accountId, document.headers, values, sourceRow);
    if (result.row) rows.push(result.row);
    else errors.push({ sourceRow, message: result.error ?? 'Invalid row' });
  }
  return { source, rows, errors };
}
