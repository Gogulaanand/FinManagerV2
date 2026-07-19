import {
  EVENT_KIND_LABELS,
  calculatePortfolioSummary,
  effectiveHoldingValue,
  latestValuation,
  mergeHoldingTimeline,
  valuationValueInr,
} from '@finmanager/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePortfolio } from '../../lib/portfolio';
import { Amount } from '../amount';
import { Card, CardLabel, CardTitle } from '../card';
import { MobileHoldingEventForm } from './holding-event-form';
import { MobileHoldingForm } from './holding-form';
import { MobileValuationForm } from './valuation-form';

export function MobileHoldingDetail({ holdingId }: { readonly holdingId: string }) {
  const api = usePortfolio();
  const [panel, setPanel] = useState<'event' | 'valuation' | 'edit' | null>(null);
  const holding = api.holdings.find((item) => item.id === holdingId);
  const events = useMemo(
    () => api.events.filter((item) => item.holdingId === holdingId),
    [api.events, holdingId],
  );
  const valuations = useMemo(
    () => api.valuations.filter((item) => item.holdingId === holdingId),
    [api.valuations, holdingId],
  );
  const timeline = useMemo(() => mergeHoldingTimeline(events, valuations), [events, valuations]);
  if (api.loading)
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Text className="p-4 text-foreground-muted">Loading holding…</Text>
      </SafeAreaView>
    );
  if (!holding)
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Pressable onPress={() => router.back()} className="p-4">
          <Text className="text-primary">← Back</Text>
        </Pressable>
        <Text className="p-4 text-foreground-muted">Holding not found.</Text>
      </SafeAreaView>
    );
  const summary = calculatePortfolioSummary([holding], events, valuations, api.accounts);
  const value = effectiveHoldingValue(holding, latestValuation(holdingId, valuations)).value ?? 0;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="font-body text-label text-primary">← Portfolio</Text>
        </Pressable>
        <View className="flex-row items-end justify-between">
          <View className="flex-1">
            <Text className="font-display text-headline-lg text-foreground">{holding.name}</Text>
            <Text className="text-foreground-muted">
              {holding.type.replace('_', ' ')} · {holding.currency}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPanel(panel === 'edit' ? null : 'edit')}
            className="rounded-md bg-surface-muted px-3 py-2"
          >
            <Text className="text-foreground">Edit</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-2">
          <Card className="flex-1">
            <CardLabel>Effective value</CardLabel>
            <Amount value={value} size="tile" />
          </Card>
          <Card className="flex-1">
            <CardLabel>XIRR</CardLabel>
            <Text className="font-display text-headline-lg text-foreground">
              {summary.xirr.rate === null ? 'N/A' : `${(summary.xirr.rate * 100).toFixed(2)}%`}
            </Text>
          </Card>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => setPanel(panel === 'event' ? null : 'event')}
            className="flex-1 rounded-md bg-primary px-4 py-3"
          >
            <Text className="text-center text-primary-foreground">Add event</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPanel(panel === 'valuation' ? null : 'valuation')}
            className="flex-1 rounded-md bg-surface-muted px-4 py-3"
          >
            <Text className="text-center text-foreground">Update value</Text>
          </Pressable>
        </View>
        {panel === 'event' ? (
          <MobileHoldingEventForm
            holding={holding}
            onSave={async (event) => {
              await api.saveEvent(event);
              setPanel(null);
            }}
          />
        ) : null}
        {panel === 'valuation' ? (
          <MobileValuationForm
            holding={holding}
            onSave={async (valuation) => {
              await api.saveValuation(valuation);
              setPanel(null);
            }}
          />
        ) : null}
        {panel === 'edit' ? (
          <MobileHoldingForm
            initial={holding}
            onSave={async (next) => {
              await api.saveHolding(next);
              setPanel(null);
            }}
            onCancel={() => setPanel(null)}
          />
        ) : null}
        <Card>
          <CardTitle>Timeline</CardTitle>
          <View className="mt-3 gap-3">
            {timeline.length === 0 ? (
              <Text className="text-foreground-muted">No history yet.</Text>
            ) : (
              timeline.map((entry) => (
                <View
                  key={`${entry.type}-${entry.value.id}`}
                  className="flex-row items-center justify-between border-b border-border/60 pb-3"
                >
                  <View>
                    <Text className="text-foreground">
                      {entry.type === 'event'
                        ? EVENT_KIND_LABELS[entry.value.kind]
                        : 'Value updated'}
                    </Text>
                    <Text className="text-caption text-foreground-muted">{entry.date}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Amount
                      value={
                        entry.type === 'event'
                          ? entry.value.amount
                          : (valuationValueInr(entry.value) ?? 0)
                      }
                      signed={entry.type === 'event'}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void (entry.type === 'event'
                          ? api.deleteEvent(entry.value.id!)
                          : api.deleteValuation(entry.value.id!))
                      }
                    >
                      <Text className="text-caption text-loss">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
