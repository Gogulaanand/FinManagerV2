'use client';

import {
  assetClassPresentation,
  formatInr,
  formatPercent,
  type AllocationRow,
} from '@finmanager/core';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { CategoryIcon } from '@/components/category-icon';
import { Card, CardLabel, CardTitle } from '@/components/ui/card';

export function AssetAllocationCard({
  allocation,
}: {
  readonly allocation: readonly AllocationRow[];
}) {
  const total = allocation.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Asset allocation</CardTitle>
        <CardLabel>How your valued holdings are distributed</CardLabel>
      </div>
      {allocation.length === 0 ? (
        <div className="rounded-md bg-surface-muted p-4">
          <p className="font-body text-body-md text-foreground">No valued holdings yet</p>
          <p className="mt-1 font-body text-caption text-foreground-muted">
            Add a current price or manual valuation to see an honest allocation.
          </p>
        </div>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[12rem_1fr]">
          <div
            className="h-48"
            role="img"
            aria-label={`Asset allocation across ${allocation.length} asset classes, total ${formatInr(total)}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[...allocation]}
                  dataKey="value"
                  nameKey="assetClass"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                >
                  {allocation.map((item) => (
                    <Cell
                      key={item.assetClass}
                      fill={assetClassPresentation(item.assetClass).color}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatInr(Number(value))}
                  labelFormatter={(label) =>
                    assetClassPresentation(label as AllocationRow['assetClass']).label
                  }
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-col gap-3" aria-label="Asset allocation details">
            {allocation.map((item) => {
              const presentation = assetClassPresentation(item.assetClass);
              return (
                <li key={item.assetClass} className="flex items-center gap-3">
                  <CategoryIcon
                    icon={presentation.icon}
                    color={presentation.color}
                    label={`${presentation.label} asset class`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-body text-body-md text-foreground">
                        {presentation.label}
                      </span>
                      <span className="font-display text-label text-foreground">
                        {formatPercent(item.percentage / 100, 1)}
                      </span>
                    </div>
                    <span className="font-body text-caption text-foreground-muted">
                      {formatInr(item.value)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
