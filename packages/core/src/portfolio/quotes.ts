import { QuoteSchema, type Holding, type Quote } from '@finmanager/schema';

export type QuoteRefreshStatus = 'ok' | 'unsupported' | 'offline' | 'timeout' | 'stale' | 'failed';

export type QuoteRefreshResult =
  | { readonly status: 'ok'; readonly quote: Quote }
  | { readonly status: Exclude<QuoteRefreshStatus, 'ok'>; readonly message: string };

export interface PriceQuoteProvider {
  quoteFor(holding: Holding): Promise<QuoteRefreshResult>;
}

interface ResponseLike {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

interface AbortControllerLike {
  readonly signal: unknown;
  abort(): void;
}

interface RuntimeGlobals {
  readonly fetch?: FetchLike;
  readonly AbortController?: new () => AbortControllerLike;
  readonly setTimeout?: (callback: () => void, delay: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
}

type FetchLike = (input: string, init?: { readonly signal?: unknown }) => Promise<ResponseLike>;

interface YahooMeta {
  readonly regularMarketPrice?: unknown;
  readonly regularMarketTime?: unknown;
  readonly currency?: unknown;
}

function metaFrom(value: unknown): YahooMeta | null {
  if (!value || typeof value !== 'object') return null;
  const chart = (value as { chart?: unknown }).chart;
  if (!chart || typeof chart !== 'object') return null;
  const result = (chart as { result?: unknown }).result;
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== 'object') return null;
  const meta = (result[0] as { meta?: unknown }).meta;
  return meta && typeof meta === 'object' ? (meta as YahooMeta) : null;
}

export class YahooFinanceQuoteProvider implements PriceQuoteProvider {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly maxAgeMs: number;

  public constructor(
    fetchImpl: FetchLike = (globalThis as unknown as RuntimeGlobals).fetch ??
      (async () => {
        throw new Error('fetch is unavailable');
      }),
    options: {
      readonly timeoutMs?: number;
      readonly now?: () => number;
      readonly maxAgeMs?: number;
    } = {},
  ) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.now = options.now ?? Date.now;
    this.maxAgeMs = options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
  }

  public async quoteFor(holding: Holding): Promise<QuoteRefreshResult> {
    if (
      !holding.id ||
      !holding.identifier ||
      !['mutual_fund', 'stock', 'foreign_stock'].includes(holding.type)
    ) {
      return { status: 'unsupported', message: 'This holding has no supported listed symbol' };
    }
    const runtime = globalThis as unknown as RuntimeGlobals;
    const controller = runtime.AbortController ? new runtime.AbortController() : null;
    const timeout =
      controller && runtime.setTimeout
        ? runtime.setTimeout(() => controller.abort(), this.timeoutMs)
        : null;
    let response: ResponseLike;
    try {
      response = await this.fetchImpl(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(holding.identifier)}`,
        controller ? { signal: controller.signal } : undefined,
      );
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      if (name === 'AbortError') return { status: 'timeout', message: 'Quote request timed out' };
      return { status: 'offline', message: 'Quote provider is unavailable offline' };
    }
    try {
      if (!response.ok)
        return { status: 'failed', message: `Quote provider returned ${response.status}` };
      const meta = metaFrom(await response.json());
      const price = typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
      const timestamp =
        typeof meta?.regularMarketTime === 'number' ? meta.regularMarketTime * 1000 : null;
      const currency = meta?.currency;
      if (price === null || timestamp === null || typeof currency !== 'string') {
        return { status: 'unsupported', message: 'Quote provider returned no usable price' };
      }
      if (this.now() - timestamp > this.maxAgeMs) {
        return { status: 'stale', message: 'Quote is older than the allowed freshness window' };
      }
      if (currency !== holding.currency) {
        return {
          status: 'unsupported',
          message: `Quote currency ${currency} does not match holding currency ${holding.currency}`,
        };
      }
      if (currency !== 'INR') {
        return {
          status: 'unsupported',
          message: 'Automatic quote refresh needs a dated FX provider for non-INR holdings',
        };
      }
      const parsed = QuoteSchema.safeParse({
        holdingId: holding.id,
        price,
        asOf: new Date(timestamp).toISOString().slice(0, 10),
        currency,
        fxRateToInr: currency === 'INR' ? 1 : null,
        source: 'Yahoo Finance',
        provider: 'yahoo-finance-chart',
      });
      return parsed.success
        ? { status: 'ok', quote: parsed.data }
        : { status: 'failed', message: 'Quote provider returned an invalid currency or date' };
    } catch {
      return { status: 'failed', message: 'Quote provider returned malformed data' };
    } finally {
      if (timeout !== null) runtime.clearTimeout?.(timeout);
    }
  }
}
