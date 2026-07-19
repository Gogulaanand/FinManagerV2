import { Bar, CartesianChart, Line, Pie, PolarChart } from 'victory-native';
import { dark, light } from '@finmanager/tokens';
import { useState } from 'react';
import { type LayoutChangeEvent, Text, useColorScheme, View } from 'react-native';

import type { ExpensesApi } from '../../lib/expenses';
import { Card, CardTitle } from '../card';

export interface MobileExpenseChartsProps {
  readonly monthlyTrend: ExpensesApi['monthlyTrend'];
  readonly categoryBreakdown: ExpensesApi['categoryBreakdown'];
  readonly budgetChart: ExpensesApi['budgetChart'];
}

function useContainerWidth() {
  const [width, setWidth] = useState(0);
  return {
    width,
    onLayout: (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
  };
}

function clamp(minimum: number, value: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function EmptyChart({ children }: { children: string }) {
  return <Text className="py-8 font-body text-body-md text-foreground-muted">{children}</Text>;
}

export function MobileExpenseCharts({
  monthlyTrend,
  categoryBreakdown,
  budgetChart,
}: MobileExpenseChartsProps) {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  const container = useContainerWidth();
  const chartSize = { width: container.width, height: clamp(180, container.width * 0.58, 240) };
  const pieSize = Math.min(container.width, 240);
  const categoryData = categoryBreakdown.map((item) => ({
    label: item.label,
    value: item.amount,
    color: item.color,
  }));

  return (
    <View className="gap-4" onLayout={container.onLayout}>
      <Card>
        <CardTitle>Monthly trend</CardTitle>
        {container.width === 0 ? (
          <View className="h-56" />
        ) : monthlyTrend.length === 0 ? (
          <EmptyChart>Add transactions to see your trend.</EmptyChart>
        ) : (
          <View className="mt-3 overflow-hidden rounded-md bg-background">
            <CartesianChart
              data={monthlyTrend.map((point) => ({ ...point }))}
              xKey="month"
              yKeys={['debit', 'credit']}
              explicitSize={chartSize}
              domainPadding={{ left: 20, right: 20, top: 16, bottom: 16 }}
            >
              {({ points }) => (
                <>
                  <Line points={points.debit} color={colors.loss} strokeWidth={3} />
                  <Line points={points.credit} color={colors.gain} strokeWidth={3} />
                </>
              )}
            </CartesianChart>
          </View>
        )}
        <View className="mt-2 flex-row gap-4">
          <Text className="font-body text-caption text-loss">● Spent</Text>
          <Text className="font-body text-caption text-gain">● Income</Text>
        </View>
      </Card>

      <Card>
        <CardTitle>Category breakdown</CardTitle>
        {container.width === 0 ? (
          <View className="h-56" />
        ) : categoryData.length === 0 ? (
          <EmptyChart>No spending in this month.</EmptyChart>
        ) : (
          <View className="items-center">
            <PolarChart
              data={categoryData}
              labelKey="label"
              valueKey="value"
              colorKey="color"
              explicitSize={{ width: pieSize, height: pieSize }}
            >
              <Pie.Chart innerRadius="55%">{() => <Pie.Slice />}</Pie.Chart>
            </PolarChart>
            <View className="w-full gap-2">
              {categoryData.slice(0, 6).map((item) => (
                <View key={item.label} className="flex-row items-center justify-between gap-2">
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <View
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <Text
                      numberOfLines={1}
                      className="flex-1 font-body text-caption text-foreground"
                    >
                      {item.label}
                    </Text>
                  </View>
                  <Text className="font-body text-caption text-foreground-muted">
                    ₹{item.value.toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>

      <Card>
        <CardTitle>Budget vs actual</CardTitle>
        {container.width === 0 ? (
          <View className="h-56" />
        ) : budgetChart.length === 0 ? (
          <EmptyChart>Set a category budget to compare it with actual spending.</EmptyChart>
        ) : (
          <View className="mt-3 overflow-hidden rounded-md bg-background">
            <CartesianChart
              data={budgetChart.map((point) => ({ ...point }))}
              xKey="label"
              yKeys={['budget', 'actual']}
              explicitSize={chartSize}
              domainPadding={{ left: 20, right: 20, top: 16, bottom: 16 }}
            >
              {({ points, chartBounds }) => (
                <>
                  <Bar
                    points={points.budget}
                    chartBounds={chartBounds}
                    color={colors.primary}
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                  />
                  <Bar
                    points={points.actual}
                    chartBounds={chartBounds}
                    color={colors.loss}
                    roundedCorners={{ topLeft: 4, topRight: 4 }}
                  />
                </>
              )}
            </CartesianChart>
          </View>
        )}
        <View className="mt-2 flex-row gap-4">
          <Text className="font-body text-caption text-primary">● Budget</Text>
          <Text className="font-body text-caption text-loss">● Actual</Text>
        </View>
      </Card>
    </View>
  );
}
