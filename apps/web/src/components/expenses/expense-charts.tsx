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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="debit"
                  name="Spent"
                  stroke="var(--loss)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="credit"
                  name="Income"
                  stroke="var(--gain)"
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
                <Tooltip />
                <Legend />
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="var(--loss)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
