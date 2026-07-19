import type { HoldingEvent, HoldingEventKind, HoldingType, Valuation } from '@finmanager/schema';

export const EVENT_KIND_LABELS: Record<HoldingEventKind, string> = {
  buy: 'Invested more',
  sell: 'Sold',
  vest: 'Shares vested',
  exercise: 'Options exercised',
  dividend: 'Dividend received',
  interest: 'Interest received',
  contribution: 'Contribution',
  withdrawal: 'Withdrawal',
};

const EVENT_KINDS_BY_ASSET: Record<HoldingType, readonly HoldingEventKind[]> = {
  mutual_fund: ['buy', 'sell', 'dividend'],
  stock: ['buy', 'sell', 'dividend'],
  foreign_stock: ['buy', 'sell', 'dividend'],
  rsu: ['vest', 'exercise', 'sell', 'dividend'],
  esop: ['vest', 'exercise', 'sell', 'dividend'],
  epf: ['contribution', 'interest', 'withdrawal'],
  ppf: ['contribution', 'interest', 'withdrawal'],
  nps: ['contribution', 'interest', 'withdrawal'],
  fd: ['contribution', 'interest', 'withdrawal'],
  real_estate: ['buy', 'sell'],
  gold: ['buy', 'sell'],
  crypto: ['buy', 'sell'],
  cash: ['contribution', 'interest', 'withdrawal'],
};

export function allowedEventKinds(assetType: HoldingType): readonly HoldingEventKind[] {
  return EVENT_KINDS_BY_ASSET[assetType];
}

const QUANTITY_PRICE_TYPES = new Set<HoldingType>([
  'stock',
  'mutual_fund',
  'foreign_stock',
  'rsu',
  'esop',
]);

export function showsQuantityPrice(assetType: HoldingType): boolean {
  return QUANTITY_PRICE_TYPES.has(assetType);
}

export type HoldingTimelineEntry =
  | { readonly type: 'event'; readonly date: string; readonly value: HoldingEvent }
  | { readonly type: 'valuation'; readonly date: string; readonly value: Valuation };

export function mergeHoldingTimeline(
  events: readonly HoldingEvent[],
  valuations: readonly Valuation[],
): readonly HoldingTimelineEntry[] {
  return [
    ...events.map((value): HoldingTimelineEntry => ({
      type: 'event',
      date: value.occurredOn,
      value,
    })),
    ...valuations.map((value): HoldingTimelineEntry => ({
      type: 'valuation',
      date: value.asOf,
      value,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date));
}
