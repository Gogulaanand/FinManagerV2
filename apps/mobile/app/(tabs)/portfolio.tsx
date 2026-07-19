import { effectiveHoldingValue, latestValuation } from '@finmanager/core';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { MobileHoldingForm } from '../../components/portfolio/holding-form';
import { MobilePortfolioImport } from '../../components/portfolio/portfolio-import';
import { usePortfolio } from '../../lib/portfolio';

function xirrText(status: string, rate: number | null): string {
  return status === 'ok' && rate !== null
    ? `${(rate * 100).toFixed(2)}%`
    : status === 'insufficient-sign-diversity'
      ? 'Need inflow + outflow'
      : status === 'missing-fx'
        ? 'Missing FX'
        : 'Not available';
}

export default function PortfolioScreen() {
  const api = usePortfolio();
  const initialSkeleton = useInitialSkeleton();
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function refresh() {
    const count = await api.refreshPrices();
    setNotice(
      `${count} automatic quote${count === 1 ? '' : 's'} refreshed. Manual overrides remain authoritative.`,
    );
  }
  if (api.loading || initialSkeleton) return <MobileWorkspaceSkeleton label="Loading portfolio" />;
  if (showForm)
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
          <MobileHoldingForm
            onSave={async (holding) => {
              await api.saveHolding(holding);
              setShowForm(false);
              setNotice('Holding saved locally.');
            }}
            onCancel={() => setShowForm(false)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-headline-lg text-foreground">Portfolio</Text>
            <Text className="font-body text-body-md text-foreground-muted">
              Value and return across every asset.
            </Text>
          </View>
          <View className="gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={!api.canWrite}
              onPress={() => setShowForm(true)}
              className="rounded-md bg-primary px-3 py-2 disabled:opacity-50"
            >
              <Text className="text-primary-foreground">Add</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!api.canWrite}
              onPress={() => void refresh()}
              className="rounded-md bg-surface-muted px-3 py-2 disabled:opacity-50"
            >
              <Text className="text-foreground">Refresh</Text>
            </Pressable>
          </View>
        </View>
        {!api.canWrite ? (
          <Card>
            <Text className="text-foreground-muted">
              Sign in to save portfolio data offline and sync it across devices.
            </Text>
          </Card>
        ) : null}
        {notice ? <Text className="text-caption text-foreground-muted">{notice}</Text> : null}
        <View className="gap-2">
          <View className="flex-row gap-2">
            <Card className="flex-1">
              <CardLabel>Net worth</CardLabel>
              <Amount value={api.summary.netWorth} size="tile" />
            </Card>
            <Card className="flex-1">
              <CardLabel>Invested</CardLabel>
              <Amount value={api.summary.investedValue} size="tile" />
            </Card>
            <Card className="flex-1">
              <CardLabel>Current</CardLabel>
              <Amount value={api.summary.currentValue} size="tile" />
            </Card>
          </View>
          <View className="flex-row gap-2">
            <Card className="flex-1">
              <CardLabel>Gain/loss</CardLabel>
              <Amount value={api.summary.gainLoss} size="tile" />
            </Card>
            <Card className="flex-1">
              <CardLabel>XIRR</CardLabel>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="font-display text-headline-lg text-foreground"
              >
                {xirrText(api.summary.xirr.status, api.summary.xirr.rate)}
              </Text>
            </Card>
          </View>
        </View>
        <Card>
          <View className="mb-3 flex-row items-center justify-between">
            <CardTitle>Holdings</CardTitle>
            <Text className="text-caption text-foreground-muted">{api.holdings.length} active</Text>
          </View>
          {api.holdings.length === 0 ? (
            <Text className="text-foreground-muted">Add your first holding.</Text>
          ) : (
            <View className="gap-3">
              {api.holdings.map((holding) => (
                <Pressable
                  key={holding.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/holding/${holding.id}` as Href)}
                  className="flex-row items-center gap-2 border-b border-border/60 pb-3"
                >
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-body-md text-foreground">
                      {holding.name}
                    </Text>
                    <Text className="text-caption text-foreground-muted">
                      {holding.type.replace('_', ' ')} · {holding.identifier ?? 'manual'}
                    </Text>
                  </View>
                  <Amount
                    value={
                      effectiveHoldingValue(holding, latestValuation(holding.id!, api.valuations))
                        .value ?? 0
                    }
                  />
                  <Text className="text-primary">›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
        <Card>
          <CardTitle>Allocation</CardTitle>
          <View className="mt-3 gap-2">
            {api.summary.allocation.map((item) => (
              <View key={item.assetClass} className="flex-row justify-between">
                <Text className="text-foreground">{item.assetClass.replace('_', ' ')}</Text>
                <Text className="text-foreground-muted">{item.percentage.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </Card>
        {api.canWrite ? (
          <MobilePortfolioImport
            onImport={async (preview) => {
              const result = await api.importRows(preview.rows);
              setNotice(
                `Imported ${result.created}; skipped ${result.skipped}; failed ${result.failed}.`,
              );
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
