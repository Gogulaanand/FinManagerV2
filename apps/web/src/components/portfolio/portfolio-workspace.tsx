'use client';

import {
  assetClassForType,
  effectiveHoldingValue,
  formatInr,
  latestValuation,
  valuationValueInr,
} from '@finmanager/core';
import { useState } from 'react';

import { Amount } from '@/components/amount';
import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { HoldingEventForm } from './holding-event-form';
import { HoldingForm } from './holding-form';
import { PortfolioImport } from './portfolio-import';
import { ValuationForm } from './valuation-form';
import { usePortfolio } from '@/lib/portfolio';

function xirrLabel(status: string, rate: number | null): string {
  if (status === 'ok' && rate !== null) return `${(rate * 100).toFixed(2)}%`;
  if (status === 'insufficient-sign-diversity') return 'Need inflow + outflow';
  if (status === 'insufficient-date-span') return 'Need dated history';
  if (status === 'missing-fx') return 'Missing FX';
  if (status === 'no-bracket') return 'No valid bracket';
  if (status === 'no-convergence') return 'Could not converge';
  return 'Not available';
}

export function PortfolioWorkspace() {
  const api = usePortfolio();
  const initialSkeleton = useInitialSkeleton();
  const [editing, setEditing] = useState<string | null>(null);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
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
        <div>
          <h1 className="font-display text-headline-lg text-foreground">Portfolio</h1>
          <p className="font-body text-body-md text-foreground-muted">
            Everything you own, valued locally and returned by true cash-flow history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={!api.canWrite || refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? 'Refreshing…' : 'Refresh prices'}
          </Button>
          <Button
            type="button"
            disabled={!api.canWrite}
            onClick={() => {
              setEditing(null);
              setShowHoldingForm(true);
            }}
          >
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
          <CardLabel>Net worth</CardLabel>
          <Amount value={api.summary.netWorth} size="section" />
          <p className="mt-1 font-body text-caption text-foreground-muted">
            {api.summary.isComplete
              ? 'Complete tracked view'
              : `${api.summary.unvaluedHoldingCount} unvalued · ${api.summary.missingFxCount} missing FX`}
          </p>
        </Card>
        <Card>
          <CardLabel>Invested</CardLabel>
          <Amount value={api.summary.investedValue} size="section" />
        </Card>
        <Card>
          <CardLabel>Current value</CardLabel>
          <Amount value={api.summary.currentValue} size="section" />
        </Card>
        <Card>
          <CardLabel>Gain/loss</CardLabel>
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
                  <div
                    key={holding.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-body-md text-foreground">
                        {holding.name}
                      </p>
                      <p className="font-body text-caption text-foreground-muted">
                        {holding.type.replace('_', ' ')}
                        {holding.identifier ? ` · ${holding.identifier}` : ''}
                        {holding.automaticPriceSource ? ` · ${holding.automaticPriceSource}` : ''}
                      </p>
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
                        {assetClassForType(holding.type).replace('_', ' ')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setEditing(holding.id ?? null);
                        setShowHoldingForm(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() =>
                        void api
                          .deleteHolding(holding.id!)
                          .then(() =>
                            setNotice('Holding deleted locally; sync will follow when online.'),
                          )
                      }
                    >
                      Delete
                    </Button>
                    {holding.manualPriceOverride !== null ||
                    holding.manualValueOverride !== null ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() =>
                          void api
                            .saveHolding({
                              ...holding,
                              manualPriceOverride: null,
                              manualValueOverride: null,
                            })
                            .then(() => setNotice('Manual override cleared.'))
                        }
                      >
                        Clear override
                      </Button>
                    ) : null}
                  </div>
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
                <div key={item.assetClass}>
                  <div className="flex justify-between font-body text-body-md text-foreground">
                    <span>{item.assetClass.replace('_', ' ')}</span>
                    <span>{item.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                  <p className="mt-1 font-body text-caption text-foreground-muted">
                    {formatInr(item.value)}
                  </p>
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
      {api.canWrite ? (
        <>
          <HoldingEventForm
            holdings={api.holdings}
            onSave={async (event) => {
              await api.saveEvent(event);
              setNotice('Event saved locally and included in XIRR.');
            }}
          />
          <ValuationForm
            holdings={api.holdings}
            onSave={async (valuation) => {
              await api.saveValuation(valuation);
              setNotice('Valuation saved locally.');
            }}
          />
          <PortfolioImport
            onImport={async (preview) => {
              const result = await api.importRows(preview.rows);
              setNotice(
                `Imported ${result.created}; skipped ${result.skipped}; failed ${result.failed}.`,
              );
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle>Ledger history</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              {api.events.slice(-10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 pb-2"
                >
                  <span className="font-body text-caption text-foreground-muted">
                    {event.occurredOn} · {event.kind} · {event.currency}
                  </span>
                  <div className="flex items-center gap-2">
                    <Amount value={event.amount} />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => void api.deleteEvent(event.id!)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {api.events.length === 0 ? (
                <p className="font-body text-caption text-foreground-muted">No events yet.</p>
              ) : null}
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Valuation history</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              {api.valuations.slice(0, 10).map((valuation) => (
                <div
                  key={valuation.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 pb-2"
                >
                  <span className="font-body text-caption text-foreground-muted">
                    {valuation.asOf} · {valuation.currency} · {valuation.source ?? 'manual'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Amount value={valuationValueInr(valuation) ?? 0} />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => void api.deleteValuation(valuation.id!)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {api.valuations.length === 0 ? (
                <p className="font-body text-caption text-foreground-muted">No valuations yet.</p>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
