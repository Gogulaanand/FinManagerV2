import {
  assetClassPresentation,
  formatInr,
  formatPercent,
  type AllocationRow,
} from '@finmanager/core';
import { Pie, PolarChart } from 'victory-native';
import { useState } from 'react';
import { type LayoutChangeEvent, Text, View } from 'react-native';

import { Card, CardLabel, CardTitle } from '../card';
import { CategoryIcon } from '../category-icon';

export function AssetAllocationCard({
  allocation,
}: {
  readonly allocation: readonly AllocationRow[];
}) {
  const [width, setWidth] = useState(0);
  const chartSize = Math.min(width, 240);
  const data = allocation.map((item) => ({
    assetClass: item.assetClass,
    value: item.value,
    color: assetClassPresentation(item.assetClass).color,
  }));
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <Card>
      <CardTitle>Asset allocation</CardTitle>
      <View className="mt-1">
        <CardLabel>How your valued holdings are distributed</CardLabel>
      </View>
      <View className="mt-4" onLayout={onLayout}>
        {allocation.length === 0 ? (
          <View className="rounded-md bg-surface-muted p-4">
            <Text className="font-body text-body-md text-foreground">No valued holdings yet</Text>
            <Text className="mt-1 font-body text-caption text-foreground-muted">
              Add a current price or manual valuation to see an honest allocation.
            </Text>
          </View>
        ) : (
          <>
            {width > 0 ? (
              <View
                className="items-center"
                accessible
                accessibilityLabel={`Asset allocation across ${allocation.length} asset classes`}
              >
                <PolarChart
                  data={data}
                  labelKey="assetClass"
                  valueKey="value"
                  colorKey="color"
                  explicitSize={{ width: chartSize, height: chartSize }}
                >
                  <Pie.Chart innerRadius="58%">{() => <Pie.Slice />}</Pie.Chart>
                </PolarChart>
              </View>
            ) : (
              <View className="h-56" />
            )}
            <View className="gap-3">
              {allocation.map((item) => {
                const presentation = assetClassPresentation(item.assetClass);
                return (
                  <View key={item.assetClass} className="flex-row items-center gap-3">
                    <CategoryIcon
                      icon={presentation.icon}
                      color={presentation.color}
                      label={`${presentation.label} asset class`}
                    />
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-baseline justify-between gap-3">
                        <Text className="font-body text-body-md text-foreground">
                          {presentation.label}
                        </Text>
                        <Text className="font-display text-label text-foreground">
                          {formatPercent(item.percentage / 100, 1)}
                        </Text>
                      </View>
                      <Text className="font-body text-caption text-foreground-muted">
                        {formatInr(item.value)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </Card>
  );
}
