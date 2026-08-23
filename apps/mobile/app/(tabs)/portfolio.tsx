import {
  assetClassForType,
  assetClassPresentation,
  effectiveHoldingValue,
  formatPercent,
  latestValuation,
} from '@finmanager/core';
import { color } from '@finmanager/tokens';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useStatus } from '@powersync/react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { Card, CardLabel } from '../../components/card';
import { CategoryIcon } from '../../components/category-icon';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { MobilePortfolioImport } from '../../components/portfolio/portfolio-import';
import { usePortfolio } from '../../lib/portfolio';
import { setNotice, useNotice } from '../../lib/notice';
import { useAuth } from '../../components/providers';
import { ScreenHeader, SectionHeading } from '../../components/screen-header';

function xirrText(status: string, rate: number | null): string {
  return status === 'ok' && rate !== null
    ? formatPercent(rate, 2)
    : status === 'insufficient-sign-diversity'
      ? 'Need inflow + outflow'
      : status === 'missing-fx'
        ? 'Missing FX'
        : 'Not available';
}

export default function PortfolioScreen() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return <MobileWorkspaceSkeleton label="Loading portfolio" />;
  }
  return <PortfolioScreenContent />;
}

function PortfolioScreenContent() {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const api = usePortfolio();
  const initialSkeleton = useInitialSkeleton();
  const notice = useNotice();
  async function refresh() {
    const count = await api.refreshPrices();
    setNotice(
      `${count} automatic quote${count === 1 ? '' : 's'} refreshed. Manual overrides remain authoritative.`,
    );
  }
  if (api.loading || initialSkeleton) return <MobileWorkspaceSkeleton label="Loading portfolio" />;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-5 p-5 pb-32">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <ScreenHeader
              eyebrow="Long-term view"
              title="Portfolio"
              subtitle="Value and return across every asset."
              icon="wallet-outline"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh portfolio prices"
            disabled={!api.canWrite}
            onPress={() => void refresh()}
            className="min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface px-3 disabled:opacity-50"
          >
            <Ionicons name="refresh" size={18} color={scheme.foreground} />
          </Pressable>
        </View>
        {!api.canWrite ? (
          <Card>
            <Text className="text-foreground-muted">
              Sign in to save portfolio data offline and sync it across devices.
            </Text>
          </Card>
        ) : null}
        {notice ? <Text className="text-caption text-foreground-muted">{notice}</Text> : null}
        <View className="gap-3">
          <Card className="p-5">
            <CardLabel>Current net worth</CardLabel>
            <Amount value={api.summary.netWorth} size="section" />
          </Card>
          <View className="flex-row gap-3">
            <Card className="min-w-0 flex-1 p-3.5">
              <CardLabel>Invested</CardLabel>
              <Amount value={api.summary.investedValue} size="tile" />
            </Card>
            <Card className="min-w-0 flex-1 p-3.5">
              <CardLabel>Current</CardLabel>
              <Amount value={api.summary.currentValue} size="tile" />
            </Card>
          </View>
          <View className="flex-row gap-2">
            <Card className="min-w-0 flex-1 p-3.5">
              <CardLabel>Gain/loss</CardLabel>
              <Amount value={api.summary.gainLoss} size="tile" />
            </Card>
            <Card className="min-w-0 flex-1 p-3.5">
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
          <SectionHeading title="Holdings" detail={`${api.holdings.length} active`} />
          {api.holdings.length === 0 ? (
            <Text className="text-foreground-muted">Add your first holding.</Text>
          ) : (
            <View className="gap-3">
              {api.holdings.map((holding) => (
                <Pressable
                  key={holding.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/holding/${holding.id}` as Href)}
                  className="min-h-11 flex-row items-center gap-2 border-b border-border/60 pb-3"
                >
                  <CategoryIcon
                    {...assetClassPresentation(assetClassForType(holding.type))}
                    label={`${assetClassForType(holding.type).replace('_', ' ')} holding`}
                  />
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
          <SectionHeading title="Allocation" detail="current mix" />
          <View className="mt-3 gap-3">
            {api.summary.allocation.map((item) => (
              <View key={item.assetClass} className="flex-row items-center gap-3">
                <CategoryIcon
                  {...assetClassPresentation(item.assetClass)}
                  label={assetClassPresentation(item.assetClass).label}
                />
                <View className="flex-1">
                  <View className="flex-row justify-between">
                    <Text className="text-foreground">
                      {assetClassPresentation(item.assetClass).label}
                    </Text>
                    <Text className="text-foreground-muted">
                      {formatPercent(item.percentage / 100, 1)}
                    </Text>
                  </View>
                  <View className="mt-1 h-2 rounded-full bg-surface-muted">
                    <View
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, item.percentage)}%`,
                        backgroundColor: assetClassPresentation(item.assetClass).color,
                      }}
                    />
                  </View>
                </View>
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
