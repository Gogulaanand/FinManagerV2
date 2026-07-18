'use client';

import {
  calculatePortfolioSummary,
  type PortfolioImportPreviewRow,
  YahooFinanceQuoteProvider,
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
import {
  ACCOUNTS_QUERY,
  HOLDING_EVENTS_QUERY,
  HOLDINGS_QUERY,
  VALUATIONS_QUERY,
  commitPortfolioImport as repoCommitPortfolioImport,
  deleteHolding as repoDeleteHolding,
  deleteHoldingEvent as repoDeleteHoldingEvent,
  deleteValuation as repoDeleteValuation,
  mapAccountRows,
  mapHoldingEventRows,
  mapHoldingRows,
  mapValuationRows,
  saveHolding as repoSaveHolding,
  saveAutomaticQuote,
  saveHoldingEvent as repoSaveHoldingEvent,
  saveValuation as repoSaveValuation,
} from '@finmanager/sync';
import { usePowerSync, useQuery } from '@powersync/react';
import { useCallback, useMemo } from 'react';

import { useAuth } from '../components/providers';

function rowRecords<T>(rows: readonly T[]): readonly Record<string, unknown>[] {
  return rows as unknown as readonly Record<string, unknown>[];
}

export interface PortfolioApi {
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
  readonly refreshPrices: () => Promise<
    readonly { readonly holdingId: string; readonly status: string; readonly message?: string }[]
  >;
}

export function usePortfolio(): PortfolioApi {
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

  const saveHolding = useCallback(
    async (input: Holding) => {
      if (!userId) return null;
      return repoSaveHolding(db, userId, HoldingSchema.parse({ ...input, userId }));
    },
    [db, userId],
  );
  const deleteHolding = useCallback(
    (id: string) => (userId ? repoDeleteHolding(db, userId, id) : Promise.resolve()),
    [db, userId],
  );
  const saveEvent = useCallback(
    async (input: HoldingEvent) => {
      if (!userId) return null;
      return repoSaveHoldingEvent(db, userId, HoldingEventSchema.parse({ ...input, userId }));
    },
    [db, userId],
  );
  const deleteEvent = useCallback(
    (id: string) => (userId ? repoDeleteHoldingEvent(db, userId, id) : Promise.resolve()),
    [db, userId],
  );
  const saveValuation = useCallback(
    async (input: Valuation) => {
      if (!userId) return null;
      return repoSaveValuation(db, userId, ValuationSchema.parse({ ...input, userId }));
    },
    [db, userId],
  );
  const deleteValuation = useCallback(
    (id: string) => (userId ? repoDeleteValuation(db, userId, id) : Promise.resolve()),
    [db, userId],
  );
  const importRows = useCallback(
    async (rows: readonly PortfolioImportPreviewRow[]) => {
      if (!userId) return { created: 0, skipped: rows.length, failed: 0 };
      const normalized: PortfolioImportRow[] = rows.map(
        ({ sourceRow: _sourceRow, warnings: _warnings, ...row }) =>
          PortfolioImportRowSchema.parse(row),
      );
      return repoCommitPortfolioImport(db, userId, normalized);
    },
    [db, userId],
  );
  const refreshPrices = useCallback(async () => {
    if (!userId) return [];
    const provider = new YahooFinanceQuoteProvider();
    const results: { holdingId: string; status: string; message?: string }[] = [];
    for (const holding of holdings.filter((item) => item.isActive && item.id)) {
      const result = await provider.quoteFor(holding);
      if (result.status === 'ok') {
        await saveAutomaticQuote(db, userId, holding.id!, result.quote);
      }
      results.push({
        holdingId: holding.id!,
        status: result.status,
        ...(result.status === 'ok' ? {} : { message: result.message }),
      });
    }
    return results;
  }, [db, holdings, userId]);

  return {
    canWrite: userId !== null,
    accounts,
    holdings,
    events,
    valuations,
    summary,
    saveHolding,
    deleteHolding,
    saveEvent,
    deleteEvent,
    saveValuation,
    deleteValuation,
    importRows,
    refreshPrices,
  };
}
