'use client';

import { formatPercent, ratioToPercent } from '@finmanager/core';
import Link from 'next/link';
import { SyncDataBoundary } from '@/components/sync-data-boundary';
import { Amount, Delta } from '@/components/amount';
import { CategoryIcon } from '@/components/category-icon';
import { AssetAllocationCard } from '@/components/dashboard/asset-allocation-card';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { FinancialHealthCard } from '@/components/insights/financial-health-card';
import { useDashboard } from '@/lib/dashboard';

function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | null;
  delta?: number | null;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <CardLabel>{label}</CardLabel>
      {value === null ? (
        <CardLabel>Unavailable</CardLabel>
      ) : (
        <Amount value={value} size="section" />
      )}
      {delta !== null && delta !== undefined && <Delta ratio={delta} />}
    </Card>
  );
}

function formatDay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? isoDate
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  return (
    <SyncDataBoundary label="Loading dashboard">
      <DashboardContent />
    </SyncDataBoundary>
  );
}

function DashboardContent() {
  const {
    loading,
    hasData,
    netWorth,
    invested,
    portfolioComplete,
    missingValuations,
    missingFx,
    monthSpend,
    monthSpendChange,
    fire,
    recentActivity,
    allocation,
  } = useDashboard();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">Dashboard</h1>

      <Card className="flex flex-col gap-2">
        <CardLabel>Total net worth</CardLabel>
        {netWorth === null ? (
          <CardTitle>Unavailable</CardTitle>
        ) : (
          <Amount value={netWorth} size="hero" />
        )}
        <span className="font-body text-label text-foreground-muted">
          {loading
            ? 'Financial data is still loading.'
            : !portfolioComplete
              ? `Partial total: ${missingValuations} unvalued holdings · ${missingFx} missing FX rates`
              : hasData
                ? 'Across your accounts and holdings'
                : 'Add an account or holding to get started'}
        </span>
      </Card>

      {!loading && !hasData ? (
        <div className="flex flex-wrap gap-4 font-body text-body-md text-primary">
          <Link href="/expenses" className="underline">
            Add first account or log expense
          </Link>
          <Link href="/portfolio" className="underline">
            Add a holding or import statement
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="This month spend" value={monthSpend} delta={monthSpendChange} />
        <StatTile label="Invested" value={invested} />
      </div>

      {!loading ? (
        <AssetAllocationCard allocation={allocation} />
      ) : (
        <Card>
          <CardLabel>Allocation unavailable while data loads.</CardLabel>
        </Card>
      )}
      {!portfolioComplete ? (
        <CardLabel>
          Investment and allocation figures include only valued holdings. Review missing valuations
          and FX in Portfolio.
        </CardLabel>
      ) : null}

      {fire && (
        <Card>
          <CardHeader>
            <CardTitle>FIRE progress</CardTitle>
            <span className="tabular font-display text-headline-md text-primary">
              {formatPercent(fire.progress, 0)}
            </span>
          </CardHeader>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-valuenow={Math.round(ratioToPercent(fire.progress))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="FIRE progress"
          >
            <div
              className="h-full rounded-full bg-primary"
              data-motion-progress
              data-progress={fire.progress}
              style={{
                width: '100%',
                transform: `scaleX(${Math.min(1, fire.progress)})`,
                transformOrigin: 'left center',
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <CardLabel>Current</CardLabel>
              <Amount value={fire.current} />
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <CardLabel>Target</CardLabel>
              <Amount value={fire.target} />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>

        {recentActivity.length === 0 ? (
          <CardLabel className="block">
            {loading ? 'Transactions unavailable while data loads.' : 'No transactions this month.'}
          </CardLabel>
        ) : (
          <ul className="flex flex-col">
            {recentActivity.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 border-b border-border/60 py-3 first:pt-0 last:border-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CategoryIcon
                    icon={row.categoryIcon}
                    color={row.categoryColor}
                    label={`${row.categoryLabel} category`}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-body text-body-md text-foreground">
                      {row.label}
                    </span>
                    <span className="font-body text-caption text-foreground-muted">
                      {row.categoryLabel} · {formatDay(row.occurredOn)}
                    </span>
                  </div>
                </div>
                <Amount value={row.amount} signed />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!loading && hasData ? <FinancialHealthCard /> : null}
    </div>
  );
}
