import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '../../components/amount';
import { effectiveHoldingValue, latestValuation, valuationValueInr } from '@finmanager/core';
import { Card, CardLabel, CardTitle } from '../../components/card';
import { MobileHoldingEventForm } from '../../components/portfolio/holding-event-form';
import { MobileHoldingForm } from '../../components/portfolio/holding-form';
import { MobilePortfolioImport } from '../../components/portfolio/portfolio-import';
import { MobileValuationForm } from '../../components/portfolio/valuation-form';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const editing = api.holdings.find((holding) => holding.id === editingId) ?? null;
  async function refresh() {
    const count = await api.refreshPrices();
    setNotice(
      `${count} automatic quote${count === 1 ? '' : 's'} refreshed. Manual overrides remain authoritative.`,
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-12">
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
              onPress={() => {
                setEditingId(null);
                setShowForm(true);
              }}
              className="rounded-md bg-primary px-3 py-2 disabled:opacity-50"
            >
              <Text className="font-body text-label text-primary-foreground">Add</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!api.canWrite}
              onPress={() => void refresh()}
              className="rounded-md bg-surface-muted px-3 py-2 disabled:opacity-50"
            >
              <Text className="font-body text-label text-foreground">Refresh</Text>
            </Pressable>
          </View>
        </View>
        {!api.canWrite ? (
          <Card>
            <Text className="font-body text-body-md text-foreground-muted">
              Sign in to save portfolio data offline and sync it across devices.
            </Text>
          </Card>
        ) : null}
        {notice ? (
          <Text className="font-body text-caption text-foreground-muted">{notice}</Text>
        ) : null}
        <View className="flex-row gap-2">
          <Card className="min-w-0 flex-1">
            <CardLabel>Net worth</CardLabel>
            <Amount value={api.summary.netWorth} size="tile" />
            <Text className="font-body text-caption text-foreground-muted">
              {api.summary.isComplete ? 'Complete' : `${api.summary.unvaluedHoldingCount} unvalued`}
            </Text>
          </Card>
          <Card className="min-w-0 flex-1">
            <CardLabel>Invested</CardLabel>
            <Amount value={api.summary.investedValue} size="tile" />
          </Card>
          <Card className="min-w-0 flex-1">
            <CardLabel>Current</CardLabel>
            <Amount value={api.summary.currentValue} size="tile" />
          </Card>
          <Card className="min-w-0 flex-1">
            <CardLabel>Gain/loss</CardLabel>
            <Amount value={api.summary.gainLoss} size="tile" />
          </Card>
          <Card className="min-w-0 flex-1">
            <CardLabel>XIRR</CardLabel>
            <Text className="font-display text-headline-lg text-foreground">
              {xirrText(api.summary.xirr.status, api.summary.xirr.rate)}
            </Text>
            <Text className="font-body text-caption text-foreground-muted">
              {api.summary.missingFxCount} missing FX
            </Text>
          </Card>
        </View>
        <Card>
          <View className="mb-3 flex-row items-center justify-between">
            <CardTitle>Holdings</CardTitle>
            <Text className="font-body text-caption text-foreground-muted">
              {api.holdings.length} active
            </Text>
          </View>
          {api.holdings.length === 0 ? (
            <Text className="font-body text-body-md text-foreground-muted">
              Add your first holding.
            </Text>
          ) : (
            <View className="gap-3">
              {api.holdings.map((holding) => (
                <View
                  key={holding.id}
                  className="flex-row items-center gap-2 border-b border-border/60 pb-3"
                >
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-body text-body-md text-foreground">
                      {holding.name}
                    </Text>
                    <Text className="font-body text-caption text-foreground-muted">
                      {holding.type.replace('_', ' ')} · {holding.identifier ?? 'manual'}
                    </Text>
                  </View>
                  <Amount
                    value={
                      effectiveHoldingValue(holding, latestValuation(holding.id!, api.valuations))
                        .value ?? 0
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setEditingId(holding.id ?? null);
                      setShowForm(true);
                    }}
                    className="rounded-md bg-surface-muted px-2 py-2"
                  >
                    <Text className="font-body text-caption text-foreground">Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void api.deleteHolding(holding.id!)}
                    className="rounded-md bg-surface-muted px-2 py-2"
                  >
                    <Text className="font-body text-caption text-loss">Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>
        <Card>
          <CardTitle>Allocation</CardTitle>
          <View className="mt-3 gap-2">
            {api.summary.allocation.map((item) => (
              <View key={item.assetClass} className="flex-row justify-between">
                <Text className="font-body text-body-md text-foreground">
                  {item.assetClass.replace('_', ' ')}
                </Text>
                <Text className="font-body text-body-md text-foreground-muted">
                  {item.percentage.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </Card>
        <Card>
          <CardTitle>Ledger history</CardTitle>
          <View className="mt-3 gap-2">
            {api.events.slice(-10).map((event) => (
              <View key={event.id} className="flex-row items-center justify-between gap-2">
                <Text className="font-body text-caption text-foreground-muted">
                  {event.occurredOn} · {event.kind} · {event.currency}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Amount value={event.amount} />
                  <Pressable onPress={() => void api.deleteEvent(event.id!)}>
                    <Text className="font-body text-caption text-loss">Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>
        <Card>
          <CardTitle>Valuation history</CardTitle>
          <View className="mt-3 gap-2">
            {api.valuations.slice(0, 10).map((valuation) => (
              <View key={valuation.id} className="flex-row items-center justify-between gap-2">
                <Text className="font-body text-caption text-foreground-muted">
                  {valuation.asOf} · {valuation.currency}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Amount value={valuationValueInr(valuation) ?? 0} />
                  <Pressable onPress={() => void api.deleteValuation(valuation.id!)}>
                    <Text className="font-body text-caption text-loss">Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>
        {showForm ? (
          <MobileHoldingForm
            initial={editing}
            onSave={async (holding) => {
              await api.saveHolding(holding);
              setShowForm(false);
              setNotice('Holding saved locally.');
            }}
          />
        ) : null}
        {api.canWrite ? (
          <>
            <MobileHoldingEventForm
              holdings={api.holdings}
              onSave={async (event) => {
                await api.saveEvent(event);
                setNotice('Event saved locally and included in XIRR.');
              }}
            />
            <MobileValuationForm
              holdings={api.holdings}
              onSave={async (valuation) => {
                await api.saveValuation(valuation);
                setNotice('Valuation saved locally.');
              }}
            />
            <MobilePortfolioImport
              onImport={async (preview) => {
                const result = await api.importRows(preview.rows);
                setNotice(
                  `Imported ${result.created}; skipped ${result.skipped}; failed ${result.failed}.`,
                );
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
