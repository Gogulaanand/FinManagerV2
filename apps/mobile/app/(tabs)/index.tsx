import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount, Delta } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { MotionProgress } from '../../components/motion';
import { FinancialHealthCard } from '../../components/insights/financial-health-card';
import {
  fireCurrent,
  fireProgress,
  fireTarget,
  invested,
  monthSpend,
  monthSpendDelta,
  netWorth,
  netWorthDelta,
  transactions,
} from '../../lib/sample-data';

function StatTile({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <Card className="flex-1">
      <CardLabel>{label}</CardLabel>
      <View className="mt-1">
        <Amount value={value} size="tile" />
      </View>
      {delta !== undefined && (
        <View className="mt-1">
          <Delta ratio={delta} />
        </View>
      )}
    </Card>
  );
}

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4" showsVerticalScrollIndicator={false}>
        <Text className="font-display text-headline-lg text-foreground">Dashboard</Text>

        <Card>
          <CardLabel>Total net worth</CardLabel>
          <View className="mt-1">
            <Amount value={netWorth} size="hero" />
          </View>
          <View className="mt-1 flex-row items-center gap-2">
            <Delta ratio={netWorthDelta} />
            <Text className="font-body text-label text-foreground-muted">this month</Text>
          </View>
        </Card>

        <FinancialHealthCard />

        <View className="flex-row gap-4">
          <StatTile label="This month spend" value={monthSpend} delta={monthSpendDelta} />
          <StatTile label="Invested" value={invested} />
        </View>

        <Card>
          <View className="mb-4 flex-row items-center justify-between">
            <CardTitle>FIRE progress</CardTitle>
            <Text
              className="font-display text-headline-md text-primary"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {Math.round(fireProgress * 100)}%
            </Text>
          </View>

          <View
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(fireProgress * 100) }}
          >
            <MotionProgress value={fireProgress} />
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="gap-0.5">
              <CardLabel>Current</CardLabel>
              <Amount value={fireCurrent} />
            </View>
            <View className="items-end gap-0.5">
              <CardLabel>Target</CardLabel>
              <Amount value={fireTarget} />
            </View>
          </View>
        </Card>

        <Card>
          <View className="mb-2">
            <CardTitle>Recent transactions</CardTitle>
          </View>

          {transactions.map((tx, index) => (
            <View
              key={tx.id}
              className={`flex-row items-center justify-between gap-4 py-3 ${
                index < transactions.length - 1 ? 'border-b border-border' : 'pb-0'
              }`}
            >
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-body text-body-md text-foreground" numberOfLines={1}>
                  {tx.merchant}
                </Text>
                <Text className="font-body text-caption text-foreground-muted">
                  {tx.category} · {tx.when}
                </Text>
              </View>
              <Amount value={tx.amount} signed />
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
