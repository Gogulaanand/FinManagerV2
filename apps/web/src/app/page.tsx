import { formatPercent, ratioToPercent } from '@finmanager/core';
import { Amount, Delta } from '@/components/amount';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { FinancialHealthCard } from '@/components/insights/financial-health-card';
import {
  fireCurrent,
  fireProgress,
  fireTarget,
  invested,
  monthSpend,
  monthSpendDelta,
  netWorth,
  netWorthDelta,
  taxLiability,
  transactions,
} from '@/lib/sample-data';

function StatTile({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <Card className="flex flex-col gap-1">
      <CardLabel>{label}</CardLabel>
      <Amount value={value} size="section" />
      {delta !== undefined && <Delta ratio={delta} />}
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">Dashboard</h1>

      <Card className="flex flex-col gap-2">
        <CardLabel>Total net worth</CardLabel>
        <Amount value={netWorth} size="hero" />
        <div className="flex items-center gap-2">
          <Delta ratio={netWorthDelta} />
          <span className="font-body text-label text-foreground-muted">this month</span>
        </div>
      </Card>

      <FinancialHealthCard />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="This month spend" value={monthSpend} delta={monthSpendDelta} />
        <StatTile label="Invested" value={invested} />
        <StatTile label="Tax liability" value={taxLiability} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FIRE progress</CardTitle>
          <span className="tabular font-display text-headline-md text-primary">
            {formatPercent(fireProgress, 0)}
          </span>
        </CardHeader>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={Math.round(ratioToPercent(fireProgress))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="FIRE progress"
        >
          <div
            className="h-full rounded-full bg-primary"
            data-motion-progress
            data-progress={fireProgress}
            style={{
              width: '100%',
              transform: `scaleX(${fireProgress})`,
              transformOrigin: 'left center',
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <CardLabel>Current</CardLabel>
            <Amount value={fireCurrent} />
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <CardLabel>Target</CardLabel>
            <Amount value={fireTarget} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>

        <ul className="flex flex-col">
          {transactions.map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between gap-4 border-b border-border/60 py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-body text-body-md text-foreground">
                  {tx.merchant}
                </span>
                <span className="font-body text-caption text-foreground-muted">
                  {tx.category} · {tx.when}
                </span>
              </div>
              <Amount value={tx.amount} signed />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
