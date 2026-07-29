'use client';

import {
  assetClassForType,
  assetClassPresentation,
  effectiveHoldingValue,
  formatPercent,
  formatInr,
  latestValuation,
} from '@finmanager/core';
import {
  CircleDollarSign,
  Landmark,
  LineChart,
  Plus,
  RefreshCw,
  Upload,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useStatus } from '@powersync/react';

import { Amount } from '@/components/amount';
import { CategoryIcon } from '@/components/category-icon';
import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { HoldingForm } from './holding-form';
import { PortfolioImport } from './portfolio-import';
import { usePortfolio } from '@/lib/portfolio';
import { useAuth } from '@/components/providers';

function xirrLabel(status: string, rate: number | null): string {
  if (status === 'ok' && rate !== null) return formatPercent(rate, 2);
  if (status === 'insufficient-sign-diversity') return 'Need inflow + outflow';
  if (status === 'insufficient-date-span') return 'Need dated history';
  if (status === 'missing-fx') return 'Missing FX';
  if (status === 'no-bracket') return 'No valid bracket';
  if (status === 'no-convergence') return 'Could not converge';
  return 'Not available';
}

export function PortfolioWorkspace() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return <WorkspaceSkeleton label="Loading portfolio" />;
  }
  return <PortfolioWorkspaceContent />;
}

function PortfolioWorkspaceContent() {
  const api = usePortfolio();
  const initialSkeleton = useInitialSkeleton();
  const [editing, setEditing] = useState<string | null>(null);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const editingHolding = api.holdings.find((holding) => holding.id === editing) ?? null;

  async function refresh() {
    setRefreshing(true);
    const results = await api.refreshPrices();
    const ok = results.filter((result) => result.status === 'ok').length;
    setNotice(
      results.length
        ? `${ok}/${results.length} quotes refreshed; manual overrides were preserved.`
        : 'No listed holdings are ready for refresh.',
    );
    setRefreshing(false);
  }

  if (api.loading || initialSkeleton) return <WorkspaceSkeleton label="Loading portfolio" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <WalletCards aria-hidden="true" size={21} />
          </span>
          <div>
            <h1 className="font-display text-headline-lg text-foreground">Portfolio</h1>
            <p className="font-body text-body-md text-foreground-muted">
              Everything you own, valued locally and returned by true cash-flow history.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={!api.canWrite || refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" size={16} />
            {refreshing ? 'Refreshing…' : 'Refresh prices'}
          </Button>
          <Button variant="outline" type="button" onClick={() => setShowImport((open) => !open)}>
            <Upload aria-hidden="true" size={16} />
            {showImport ? 'Hide import' : 'Import'}
          </Button>
          <Button
            type="button"
            disabled={!api.canWrite}
            onClick={() => {
              setEditing(null);
              setShowHoldingForm(true);
            }}
          >
            <Plus aria-hidden="true" size={16} />
            Add holding
          </Button>
        </div>
      </div>
      {!api.canWrite ? (
        <Card>
          <p className="font-body text-body-md text-foreground-muted">
            Sign in to save holdings offline and sync them across devices.
          </p>
        </Card>
      ) : null}
      {notice ? <p className="font-body text-caption text-foreground-muted">{notice}</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardLabel className="flex items-center gap-2">
            <CircleDollarSign aria-hidden="true" size={15} />
            Net worth
          </CardLabel>
          <Amount value={api.summary.netWorth} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {api.summary.isComplete
              ? 'Complete tracked view'
              : `${api.summary.unvaluedHoldingCount} unvalued · ${api.summary.missingFxCount} missing FX`}
          </p>
        </Card>
        <Card>
          <CardLabel className="flex items-center gap-2">
            <Landmark aria-hidden="true" size={15} />
            Invested
          </CardLabel>
          <Amount value={api.summary.investedValue} size="section" />
        </Card>
        <Card>
          <CardLabel className="flex items-center gap-2">
            <WalletCards aria-hidden="true" size={15} />
            Current value
          </CardLabel>
          <Amount value={api.summary.currentValue} size="section" />
        </Card>
        <Card>
          <CardLabel className="flex items-center gap-2">
            <LineChart aria-hidden="true" size={15} />
            Gain/loss
          </CardLabel>
          <Amount value={api.summary.gainLoss} size="section" />
        </Card>
        <Card>
          <CardLabel>Portfolio XIRR</CardLabel>
          <p className="font-display text-display-md text-foreground">
            {xirrLabel(api.summary.xirr.status, api.summary.xirr.rate)}
          </p>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <span className="font-body text-caption text-foreground-muted">
              {api.holdings.length} active
            </span>
          </CardHeader>
          {api.holdings.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              Add a holding or import a broker statement to start.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {api.holdings.map((holding) => {
                return (
                  <Link
                    key={holding.id}
                    href={`/portfolio/${holding.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <CategoryIcon
                        {...assetClassPresentation(assetClassForType(holding.type))}
                        label={`${assetClassForType(holding.type).replace('_', ' ')} holding`}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-body text-body-md text-foreground">
                          {holding.name}
                        </p>
                        <p className="font-body text-caption text-foreground-muted">
                          {holding.type.replace('_', ' ')}
                          {holding.identifier ? ` · ${holding.identifier}` : ''}
                          {holding.automaticPriceSource ? ` · ${holding.automaticPriceSource}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Amount
                        value={
                          effectiveHoldingValue(
                            holding,
                            latestValuation(holding.id!, api.valuations),
                          ).value ?? 0
                        }
                      />
                      <p className="font-body text-caption text-foreground-muted">
                        {assetClassForType(holding.type).replace('_', ' ')} · View details
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          {api.summary.allocation.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              Valued holdings appear here.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {api.summary.allocation.map((item) => (
                <div key={item.assetClass} className="flex gap-3">
                  <CategoryIcon
                    {...assetClassPresentation(item.assetClass)}
                    label={assetClassPresentation(item.assetClass).label}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between font-body text-body-md text-foreground">
                      <span>{assetClassPresentation(item.assetClass).label}</span>
                      <span>{formatPercent(item.percentage / 100, 1)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, item.percentage)}%`,
                          backgroundColor: assetClassPresentation(item.assetClass).color,
                        }}
                      />
                    </div>
                    <p className="mt-1 font-body text-caption text-foreground-muted">
                      {formatInr(item.value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {showHoldingForm ? (
        <HoldingForm
          initial={editingHolding}
          onSave={async (holding) => {
            await api.saveHolding(holding);
            setShowHoldingForm(false);
            setNotice('Holding saved locally; sync will follow when online.');
          }}
          onCancel={() => setShowHoldingForm(false)}
        />
      ) : null}
      {api.canWrite && showImport ? (
        <PortfolioImport
          onImport={async (preview) => {
            const result = await api.importRows(preview.rows);
            setNotice(
              `Imported ${result.created}; skipped ${result.skipped}; failed ${result.failed}.`,
            );
          }}
        />
      ) : null}
    </div>
  );
}
