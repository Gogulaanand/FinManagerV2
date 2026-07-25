import { formatPercent, ratioToPercent } from '@finmanager/core';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount, Delta } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { MotionProgress } from '../../components/motion';
import { FinancialHealthCard } from '../../components/insights/financial-health-card';
import { useDashboard } from '../../lib/dashboard';

function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number | null;
}) {
  return (
    <Card className="flex-1">
      <CardLabel>{label}</CardLabel>
      <View className="mt-1">
        <Amount value={value} size="tile" />
      </View>
      {delta !== null && delta !== undefined && (
        <View className="mt-1">
          <Delta ratio={delta} />
        </View>
      )}
    </Card>
  );
}

function formatDay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? isoDate
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DashboardScreen() {
  const {
    loading,
    hasData,
    netWorth,
    invested,
    monthSpend,
    monthSpendChange,
    fire,
    recentActivity,
  } = useDashboard();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4" showsVerticalScrollIndicator={false}>
        <Text className="font-display text-headline-lg text-foreground">Dashboard</Text>

        <Card>
          <CardLabel>Total net worth</CardLabel>
          <View className="mt-1">
            <Amount value={netWorth} size="hero" />
          </View>
          <View className="mt-1">
            <Text className="font-body text-label text-foreground-muted">
              {loading
                ? 'Syncing your data…'
                : hasData
                  ? 'Across your accounts and holdings'
                  : 'Add an account or holding to get started'}
            </Text>
          </View>
        </Card>

        <FinancialHealthCard />

        <View className="flex-row gap-4">
          <StatTile label="This month spend" value={monthSpend} delta={monthSpendChange} />
          <StatTile label="Invested" value={invested} />
        </View>

        {fire && (
          <Card>
            <View className="mb-4 flex-row items-center justify-between">
              <CardTitle>FIRE progress</CardTitle>
              <Text
                className="font-display text-headline-md text-primary"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatPercent(fire.progress, 0)}
              </Text>
            </View>

            <View
              className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(ratioToPercent(fire.progress)),
              }}
            >
              <MotionProgress value={Math.min(1, fire.progress)} />
            </View>

            <View className="mt-3 flex-row items-center justify-between">
              <View className="gap-0.5">
                <CardLabel>Current</CardLabel>
                <Amount value={fire.current} />
              </View>
              <View className="items-end gap-0.5">
                <CardLabel>Target</CardLabel>
                <Amount value={fire.target} />
              </View>
            </View>
          </Card>
        )}

        <Card>
          <View className="mb-2">
            <CardTitle>Recent transactions</CardTitle>
          </View>

          {recentActivity.length === 0 ? (
            <CardLabel>
              {loading ? 'Loading your transactions…' : 'No transactions this month.'}
            </CardLabel>
          ) : (
            recentActivity.map((row, index) => (
              <View
                key={row.id}
                className={`flex-row items-center justify-between gap-4 py-3 ${
                  index < recentActivity.length - 1 ? 'border-b border-border' : 'pb-0'
                }`}
              >
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="font-body text-body-md text-foreground" numberOfLines={1}>
                    {row.label}
                  </Text>
                  <Text className="font-body text-caption text-foreground-muted">
                    {row.categoryLabel} · {formatDay(row.occurredOn)}
                  </Text>
                </View>
                <Amount value={row.amount} signed />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
