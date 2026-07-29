'use client';

import { formatInr, formatPercent } from '@finmanager/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CategoryIcon } from '@/components/category-icon';
import { Card, CardLabel, CardTitle } from '@/components/ui/card';
import type { ExpensesApi } from '@/lib/expenses';

const chartText = { fill: 'var(--color-foreground-muted)', fontSize: 11 } as const;
const chartAxis = { stroke: 'var(--color-border)' } as const;
const tooltipContent = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-foreground)',
} as const;
const tooltipText = { color: 'var(--color-foreground)' } as const;
const legendStyle = { color: 'var(--color-foreground-muted)' } as const;

function formatAxisInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(value: string): string {
  const parsed = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-IN', { month: 'short' });
}

function statusLabel(status: ExpensesApi['budgetProgress'][number]['status']): string {
  if (status === 'overspent') return 'Overspent';
  if (status === 'nearLimit') return 'Near limit';
  return 'On track';
}

export interface ExpenseChartsProps {
  readonly monthlyTrend: ExpensesApi['monthlyTrend'];
  readonly categoryBreakdown: ExpensesApi['categoryBreakdown'];
  readonly budgetChart: ExpensesApi['budgetChart'];
}

export function ExpenseCharts({
  monthlyTrend,
  categoryBreakdown,
  budgetChart,
}: ExpenseChartsProps) {
  const hasTrendData = monthlyTrend.some((point) => point.debit > 0 || point.credit > 0);
  const latestTrend = hasTrendData ? monthlyTrend.at(-1) : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Income vs spend</CardTitle>
        <CardLabel>Six-month trend · hover or focus the chart to inspect values</CardLabel>
        <div
          className="mt-4 h-56 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          role="figure"
          tabIndex={0}
          aria-label="Monthly income and spending trend"
        >
          {!hasTrendData ? (
            <p className="font-body text-body-md text-foreground-muted">
              Add transactions to see your trend.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                accessibilityLayer
                data={[...monthlyTrend]}
                margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  axisLine={chartAxis}
                  tickLine={chartAxis}
                  tick={chartText}
                />
                <YAxis
                  tickFormatter={formatAxisInr}
                  axisLine={chartAxis}
                  tickLine={chartAxis}
                  tick={chartText}
                  width={68}
                />
                <Tooltip
                  formatter={(value) => formatInr(Number(value))}
                  labelFormatter={(label) => String(label)}
                  contentStyle={tooltipContent}
                  labelStyle={tooltipText}
                  itemStyle={tooltipText}
                  cursor={{ fill: 'var(--color-surface-muted)' }}
                />
                <Legend wrapperStyle={legendStyle} />
                <Line
                  type="monotone"
                  dataKey="debit"
                  name="Spent"
                  stroke="var(--color-loss)"
                  strokeWidth={2}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="credit"
                  name="Income"
                  stroke="var(--color-gain)"
                  strokeWidth={2}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {latestTrend ? (
          <p className="mt-2 font-body text-caption text-foreground-muted">
            {latestTrend.month}: income {formatInr(latestTrend.credit)}; spent{' '}
            {formatInr(latestTrend.debit)}.
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Category breakdown</CardTitle>
        <CardLabel>Amount and share of this month&apos;s spend</CardLabel>
        {categoryBreakdown.length === 0 ? (
          <p className="mt-4 font-body text-body-md text-foreground-muted">
            No spending in this month.
          </p>
        ) : (
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[13rem_1fr]">
            <div
              className="h-52 outline-none focus-visible:ring-2 focus-visible:ring-focus"
              role="figure"
              tabIndex={0}
              aria-label="Spending by category donut chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={[...categoryBreakdown]}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {categoryBreakdown.map((item) => (
                      <Cell key={item.categoryId ?? item.label} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatInr(Number(value))}
                    contentStyle={tooltipContent}
                    labelStyle={tooltipText}
                    itemStyle={tooltipText}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-col gap-2" aria-label="Category spending legend">
              {categoryBreakdown.slice(0, 6).map((item) => (
                <li key={item.categoryId ?? item.label} className="flex items-center gap-2">
                  <CategoryIcon
                    icon={item.icon}
                    color={item.color}
                    label={`${item.label} category`}
                    size={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 font-body text-caption">
                      <span className="truncate text-foreground">{item.label}</span>
                      <span className="text-foreground-muted">
                        {formatPercent(item.percentage / 100, 1)}
                      </span>
                    </div>
                    <span className="font-body text-caption text-foreground-muted">
                      {formatInr(item.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="xl:col-span-2">
        <CardTitle>Budget vs actual</CardTitle>
        <CardLabel>Budget limits compared with recorded spending</CardLabel>
        <div
          className="mt-4 h-56 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          role="figure"
          tabIndex={0}
          aria-label="Budget compared with actual spending by category"
        >
          {budgetChart.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              Set a category budget to compare it with actual spending.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={[...budgetChart]}
                margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={chartAxis} tickLine={chartAxis} tick={chartText} />
                <YAxis
                  tickFormatter={formatAxisInr}
                  axisLine={chartAxis}
                  tickLine={chartAxis}
                  tick={chartText}
                  width={68}
                />
                <Tooltip
                  formatter={(value) => formatInr(Number(value))}
                  contentStyle={tooltipContent}
                  labelStyle={tooltipText}
                  itemStyle={tooltipText}
                  cursor={{ fill: 'var(--color-surface-muted)' }}
                />
                <Legend wrapperStyle={legendStyle} />
                <Bar
                  dataKey="budget"
                  name="Budget"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="Actual"
                  fill="var(--color-loss)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {budgetChart.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Budget status summary">
            {budgetChart.map((item) => (
              <li
                key={item.categoryId ?? item.label}
                className="flex items-center gap-2 rounded-md bg-surface-muted p-2"
              >
                <CategoryIcon
                  icon={item.icon}
                  color={item.color}
                  label={`${item.label} category`}
                  size={16}
                />
                <span className="min-w-0 flex-1 font-body text-caption text-foreground">
                  {item.label}: {formatInr(item.actual)} of {formatInr(item.budget)}
                </span>
                <span
                  className={`font-body text-caption ${
                    item.status === 'overspent'
                      ? 'text-loss'
                      : item.status === 'nearLimit'
                        ? 'text-warning'
                        : 'text-gain'
                  }`}
                >
                  {statusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
