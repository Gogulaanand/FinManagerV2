'use client';

import {
  EVENT_KIND_LABELS,
  calculatePortfolioSummary,
  effectiveHoldingValue,
  formatPercent,
  latestValuation,
  mergeHoldingTimeline,
  valuationValueInr,
} from '@finmanager/core';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Amount } from '@/components/amount';
import { HoldingEventForm } from '@/components/portfolio/holding-event-form';
import { HoldingForm } from '@/components/portfolio/holding-form';
import { ValuationForm } from '@/components/portfolio/valuation-form';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { usePortfolio } from '@/lib/portfolio';

export function HoldingDetail({ holdingId }: { readonly holdingId: string }) {
  const api = usePortfolio();
  const [panel, setPanel] = useState<'event' | 'valuation' | 'edit' | null>(null);
  const holding = api.holdings.find((item) => item.id === holdingId);
  const events = useMemo(
    () => api.events.filter((item) => item.holdingId === holdingId),
    [api.events, holdingId],
  );
  const valuations = useMemo(
    () => api.valuations.filter((item) => item.holdingId === holdingId),
    [api.valuations, holdingId],
  );
  const timeline = useMemo(() => mergeHoldingTimeline(events, valuations), [events, valuations]);
  if (api.loading) return <p className="text-foreground-muted">Loading holding…</p>;
  if (!holding)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-foreground-muted">Holding not found.</p>
        <Link href="/portfolio" className="text-primary">
          Back to portfolio
        </Link>
      </div>
    );
  const holdingSummary = calculatePortfolioSummary([holding], events, valuations, api.accounts);
  const value = effectiveHoldingValue(holding, latestValuation(holdingId, valuations)).value ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/portfolio" className="text-label text-primary">
        ← Portfolio
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-lg text-foreground">{holding.name}</h1>
          <p className="text-foreground-muted">
            {holding.type.replace('_', ' ')} · {holding.currency}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPanel(panel === 'edit' ? null : 'edit')}
        >
          Edit holding
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardLabel>Effective value</CardLabel>
          <Amount value={value} size="section" />
        </Card>
        <Card>
          <CardLabel>XIRR</CardLabel>
          <p className="font-display text-display-md text-foreground">
            {holdingSummary.xirr.rate === null
              ? 'Not available'
              : formatPercent(holdingSummary.xirr.rate, 2)}
          </p>
        </Card>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => setPanel(panel === 'event' ? null : 'event')}>
          Add event
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPanel(panel === 'valuation' ? null : 'valuation')}
        >
          Update value
        </Button>
      </div>
      {panel === 'event' ? (
        <HoldingEventForm
          holding={holding}
          onSave={async (event) => {
            await api.saveEvent(event);
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'valuation' ? (
        <ValuationForm
          holding={holding}
          onSave={async (valuation) => {
            await api.saveValuation(valuation);
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'edit' ? (
        <HoldingForm
          initial={holding}
          onSave={async (next) => {
            await api.saveHolding(next);
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        {timeline.length === 0 ? (
          <p className="text-foreground-muted">No history yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {timeline.map((entry) => (
              <div
                key={`${entry.type}-${entry.value.id}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-body-md text-foreground">
                    {entry.type === 'event' ? EVENT_KIND_LABELS[entry.value.kind] : 'Value updated'}
                  </p>
                  <p className="text-caption text-foreground-muted">{entry.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Amount
                    value={
                      entry.type === 'event'
                        ? entry.value.amount
                        : (valuationValueInr(entry.value) ?? 0)
                    }
                    signed={entry.type === 'event'}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void (entry.type === 'event'
                        ? api.deleteEvent(entry.value.id!)
                        : api.deleteValuation(entry.value.id!))
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
