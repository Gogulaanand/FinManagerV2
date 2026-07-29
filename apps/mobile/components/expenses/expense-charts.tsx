import { Inter_400Regular } from '@expo-google-fonts/inter';
import { formatInr, formatPercent } from '@finmanager/core';
import { dark, light } from '@finmanager/tokens';
import { useFont } from '@shopify/react-native-skia';
import { Bar, CartesianChart, Line, Pie, PolarChart, useChartPressState } from 'victory-native';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, Text, useColorScheme, View } from 'react-native';

import type { ExpensesApi } from '../../lib/expenses';
import { Card, CardLabel, CardTitle } from '../card';
import { CategoryIcon } from '../category-icon';

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

function monthTick(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? month
    : parsed.toLocaleDateString('en-IN', { month: 'short' });
}

function axisInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(status: ExpensesApi['budgetProgress'][number]['status']): string {
  if (status === 'overspent') return 'Overspent';
  if (status === 'nearLimit') return 'Near limit';
  return 'On track';
}

export function MobileExpenseCharts({
  monthlyTrend,
  categoryBreakdown,
  budgetChart,
}: MobileExpenseChartsProps) {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  const axisFont = useFont(Inter_400Regular, 10);
  const container = useContainerWidth();
  // The width is measured on the stack around the cards. Each Card has a
  // 16px inset on both sides, so size Skia canvases to the actual inner width
  // rather than letting their right edge sit underneath the card padding.
  const chartWidth = Math.max(0, container.width - 32);
  const chartSize = { width: chartWidth, height: clamp(180, chartWidth * 0.58, 240) };
  const pieSize = Math.min(chartWidth, 240);
  const hasTrendData = monthlyTrend.some((point) => point.debit > 0 || point.credit > 0);
  const trendData = monthlyTrend.map((point) => ({ ...point }));
  const budgetData = budgetChart.map((point) => ({ ...point }));
  const categoryData = categoryBreakdown.map((item) => ({
    key: item.categoryId ?? item.label,
    label: item.label,
    value: item.amount,
    color: item.color,
  }));
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const selectedCategory =
    categoryBreakdown.find((item) => (item.categoryId ?? item.label) === selectedCategoryKey) ??
    categoryBreakdown[0];
  const { state: trendPress, isActive: trendActive } = useChartPressState({
    x: '',
    y: { debit: 0, credit: 0 },
  });
  const { state: budgetPress, isActive: budgetActive } = useChartPressState({
    x: '',
    y: { budget: 0, actual: 0 },
  });

  return (
    <View className="gap-4" onLayout={container.onLayout}>
      <Card>
        <CardTitle>Income vs spend</CardTitle>
        <View className="mt-1">
          <CardLabel>Tap and hold the chart to inspect a month</CardLabel>
        </View>
        {chartWidth === 0 ? (
          <View className="h-56" />
        ) : !hasTrendData ? (
          <EmptyChart>Add transactions to see your trend.</EmptyChart>
        ) : (
          <>
            <View className="mt-3 overflow-hidden rounded-md bg-background">
              <CartesianChart
                data={trendData}
                xKey="month"
                yKeys={['debit', 'credit']}
                chartPressState={trendPress}
                explicitSize={chartSize}
                domainPadding={{ left: 20, right: 20, top: 16, bottom: 16 }}
                axisOptions={{
                  font: axisFont,
                  formatXLabel: monthTick,
                  formatYLabel: (value) => axisInr(Number(value)),
                  labelColor: colors.foregroundMuted,
                  lineColor: colors.border,
                  tickCount: { x: monthlyTrend.length, y: 4 },
                }}
              >
                {({ points }) => (
                  <>
                    <Line points={points.debit} color={colors.loss} strokeWidth={3} />
                    <Line points={points.credit} color={colors.gain} strokeWidth={3} />
                  </>
                )}
              </CartesianChart>
            </View>
            <View className="mt-3 rounded-md bg-surface-muted p-3" accessibilityLiveRegion="polite">
              <Text className="font-body text-caption text-foreground">
                {trendActive
                  ? `${String(trendPress.x.value.value)}: spent ${formatInr(
                      trendPress.y.debit.value.value,
                    )}; income ${formatInr(trendPress.y.credit.value.value)}.`
                  : 'Tap a month to inspect its exact income and spend.'}
              </Text>
            </View>
          </>
        )}
        {hasTrendData ? (
          <View className="mt-2 flex-row gap-4">
            <Text className="font-body text-caption text-loss">● Spent</Text>
            <Text className="font-body text-caption text-gain">● Income</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Category breakdown</CardTitle>
        <View className="mt-1">
          <CardLabel>Tap a legend row to inspect amount and share</CardLabel>
        </View>
        {chartWidth === 0 ? (
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
            {selectedCategory ? (
              <View
                className="mb-3 w-full rounded-md bg-surface-muted p-3"
                accessibilityLiveRegion="polite"
              >
                <Text className="font-body text-body-md text-foreground">
                  {selectedCategory.label}
                </Text>
                <Text className="font-body text-caption text-foreground-muted">
                  {formatInr(selectedCategory.amount)} ·{' '}
                  {formatPercent(selectedCategory.percentage / 100, 1)} of spending
                </Text>
              </View>
            ) : null}
            <View className="w-full gap-2">
              {categoryBreakdown.slice(0, 6).map((item) => {
                const key = item.categoryId ?? item.label;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: key === (selectedCategory?.categoryId ?? selectedCategory?.label),
                    }}
                    onPress={() => setSelectedCategoryKey(key)}
                    className="flex-row items-center gap-2 rounded-md p-1"
                  >
                    <CategoryIcon
                      icon={item.icon}
                      color={item.color}
                      label={`${item.label} category`}
                      size={16}
                    />
                    <Text
                      numberOfLines={1}
                      className="min-w-0 flex-1 font-body text-caption text-foreground"
                    >
                      {item.label}
                    </Text>
                    <Text className="font-body text-caption text-foreground-muted">
                      {formatPercent(item.percentage / 100, 1)} · {formatInr(item.amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </Card>

      <Card>
        <CardTitle>Budget vs actual</CardTitle>
        <View className="mt-1">
          <CardLabel>Tap and hold a category to inspect its values</CardLabel>
        </View>
        {chartWidth === 0 ? (
          <View className="h-56" />
        ) : budgetChart.length === 0 ? (
          <EmptyChart>Set a category budget to compare it with actual spending.</EmptyChart>
        ) : (
          <>
            <View className="mt-3 overflow-hidden rounded-md bg-background">
              <CartesianChart
                data={budgetData}
                xKey="label"
                yKeys={['budget', 'actual']}
                chartPressState={budgetPress}
                explicitSize={chartSize}
                domainPadding={{ left: 20, right: 20, top: 16, bottom: 16 }}
                axisOptions={{
                  font: axisFont,
                  formatXLabel: (value) => String(value).slice(0, 10),
                  formatYLabel: (value) => axisInr(Number(value)),
                  labelColor: colors.foregroundMuted,
                  lineColor: colors.border,
                  tickCount: { x: budgetChart.length, y: 4 },
                }}
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
            <View className="mt-3 rounded-md bg-surface-muted p-3" accessibilityLiveRegion="polite">
              <Text className="font-body text-caption text-foreground">
                {budgetActive
                  ? `${String(budgetPress.x.value.value)}: actual ${formatInr(
                      budgetPress.y.actual.value.value,
                    )}; budget ${formatInr(budgetPress.y.budget.value.value)}.`
                  : 'Tap a category to inspect its exact budget and actual spend.'}
              </Text>
            </View>
            <View className="mt-3 gap-2">
              {budgetChart.map((item) => (
                <View
                  key={item.categoryId ?? item.label}
                  className="flex-row items-center gap-2 rounded-md bg-surface-muted p-2"
                >
                  <CategoryIcon
                    icon={item.icon}
                    color={item.color}
                    label={`${item.label} category`}
                    size={16}
                  />
                  <View className="min-w-0 flex-1">
                    <Text className="font-body text-caption text-foreground">{item.label}</Text>
                    <Text className="font-body text-caption text-foreground-muted">
                      {formatInr(item.actual)} of {formatInr(item.budget)}
                    </Text>
                  </View>
                  <Text
                    className={`font-body text-caption ${
                      item.status === 'overspent'
                        ? 'text-loss'
                        : item.status === 'nearLimit'
                          ? 'text-warning'
                          : 'text-gain'
                    }`}
                  >
                    {statusLabel(item.status)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
        <View className="mt-2 flex-row gap-4">
          <Text className="font-body text-caption text-primary">● Budget</Text>
          <Text className="font-body text-caption text-loss">● Actual</Text>
        </View>
      </Card>
    </View>
  );
}
