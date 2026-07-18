import {
  calculatePortfolioSummary,
  YahooFinanceQuoteProvider,
  type PortfolioImportPreviewRow,
} from '@finmanager/core';
import {
  HoldingEventSchema,
  HoldingSchema,
  PortfolioImportRowSchema,
  ValuationSchema,
  type Account,
  type Holding,
  type HoldingEvent,
  type PortfolioImportRow,
  type Valuation,
} from '@finmanager/schema';
import { usePowerSync, useQuery } from '@powersync/react';
import { useCallback, useMemo } from 'react';

import { useAuth } from '../components/providers';
import {
  ACCOUNTS_QUERY,
  commitPortfolioImport,
  deleteHolding,
  deleteHoldingEvent,
  deleteValuation,
  HOLDING_EVENTS_QUERY,
  HOLDINGS_QUERY,
  mapAccountRows,
  mapHoldingEventRows,
  mapHoldingRows,
  mapValuationRows,
  saveHolding,
  saveHoldingEvent,
  saveValuation,
  saveAutomaticQuote,
  VALUATIONS_QUERY,
} from '@finmanager/sync';

function rowRecords<T>(rows: readonly T[]): readonly Record<string, unknown>[] {
  return rows as unknown as readonly Record<string, unknown>[];
}

export interface MobilePortfolioApi {
  readonly canWrite: boolean;
  readonly accounts: readonly Account[];
  readonly holdings: readonly Holding[];
  readonly events: readonly HoldingEvent[];
  readonly valuations: readonly Valuation[];
  readonly summary: ReturnType<typeof calculatePortfolioSummary>;
  readonly saveHolding: (holding: Holding) => Promise<string | null>;
  readonly deleteHolding: (id: string) => Promise<void>;
  readonly saveEvent: (event: HoldingEvent) => Promise<string | null>;
  readonly deleteEvent: (id: string) => Promise<void>;
  readonly saveValuation: (valuation: Valuation) => Promise<string | null>;
  readonly deleteValuation: (id: string) => Promise<void>;
  readonly importRows: (
    rows: readonly PortfolioImportPreviewRow[],
  ) => Promise<{ created: number; skipped: number; failed: number }>;
  readonly refreshPrices: () => Promise<number>;
}

export function usePortfolio(): MobilePortfolioApi {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const accountsResult = useQuery<Account>(ACCOUNTS_QUERY);
  const holdingsResult = useQuery<Holding>(HOLDINGS_QUERY);
  const eventsResult = useQuery<HoldingEvent>(HOLDING_EVENTS_QUERY);
  const valuationsResult = useQuery<Valuation>(VALUATIONS_QUERY);
  const accounts = useMemo(
    () => mapAccountRows(rowRecords(accountsResult.data ?? [])),
    [accountsResult.data],
  );
  const holdings = useMemo(
    () => mapHoldingRows(rowRecords(holdingsResult.data ?? [])),
    [holdingsResult.data],
  );
  const events = useMemo(
    () => mapHoldingEventRows(rowRecords(eventsResult.data ?? [])),
    [eventsResult.data],
  );
  const valuations = useMemo(
    () => mapValuationRows(rowRecords(valuationsResult.data ?? [])),
    [valuationsResult.data],
  );
  const summary = useMemo(
    () => calculatePortfolioSummary(holdings, events, valuations, accounts),
    [accounts, events, holdings, valuations],
  );
  const save = useCallback(
    async (holding: Holding) =>
      userId ? saveHolding(db, userId, HoldingSchema.parse({ ...holding, userId })) : null,
    [db, userId],
  );
  const saveEvent = useCallback(
    async (event: HoldingEvent) =>
      userId ? saveHoldingEvent(db, userId, HoldingEventSchema.parse({ ...event, userId })) : null,
    [db, userId],
  );
  const saveValue = useCallback(
    async (valuation: Valuation) =>
      userId ? saveValuation(db, userId, ValuationSchema.parse({ ...valuation, userId })) : null,
    [db, userId],
  );
  const importRows = useCallback(
    async (rows: readonly PortfolioImportPreviewRow[]) =>
      userId
        ? commitPortfolioImport(
            db,
            userId,
            rows.map(
              ({ sourceRow: _sourceRow, warnings: _warnings, ...row }) =>
                PortfolioImportRowSchema.parse(row) as PortfolioImportRow,
            ),
          )
        : { created: 0, skipped: rows.length, failed: 0 },
    [db, userId],
  );
  const refreshPrices = useCallback(async () => {
    if (!userId) return 0;
    const provider = new YahooFinanceQuoteProvider();
    let refreshed = 0;
    for (const holding of holdings.filter((item) => item.id && item.isActive)) {
      const result = await provider.quoteFor(holding);
      if (result.status !== 'ok') continue;
      await saveAutomaticQuote(db, userId, holding.id!, result.quote);
      refreshed += 1;
    }
    return refreshed;
  }, [db, holdings, userId]);
  return {
    canWrite: userId !== null,
    accounts,
    holdings,
    events,
    valuations,
    summary,
    saveHolding: save,
    deleteHolding: (id) => (userId ? deleteHolding(db, userId, id) : Promise.resolve()),
    saveEvent,
    deleteEvent: (id) => (userId ? deleteHoldingEvent(db, userId, id) : Promise.resolve()),
    saveValuation: saveValue,
    deleteValuation: (id) => (userId ? deleteValuation(db, userId, id) : Promise.resolve()),
    importRows,
    refreshPrices,
  };
}
