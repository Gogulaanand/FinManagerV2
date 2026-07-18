'use client';

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

import { Card, CardTitle } from '@/components/ui/card';
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
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Monthly trend</CardTitle>
        <div className="mt-4 h-56">
          {monthlyTrend.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              Add transactions to see your trend.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[...monthlyTrend]}
                margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" axisLine={chartAxis} tickLine={chartAxis} tick={chartText} />
                <YAxis axisLine={chartAxis} tickLine={chartAxis} tick={chartText} />
                <Tooltip
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
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="credit"
                  name="Income"
                  stroke="var(--color-gain)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <Card>
        <CardTitle>Category breakdown</CardTitle>
        <div className="mt-4 h-56">
          {categoryBreakdown.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              No spending in this month.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
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
                  contentStyle={tooltipContent}
                  labelStyle={tooltipText}
                  itemStyle={tooltipText}
                />
                <Legend wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <Card className="xl:col-span-2">
        <CardTitle>Budget vs actual</CardTitle>
        <div className="mt-4 h-56">
          {budgetChart.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              Set a category budget to compare it with actual spending.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...budgetChart]} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={chartAxis} tickLine={chartAxis} tick={chartText} />
                <YAxis axisLine={chartAxis} tickLine={chartAxis} tick={chartText} />
                <Tooltip
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
      </Card>
    </div>
  );
}
