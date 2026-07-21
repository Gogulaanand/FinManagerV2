import type { RegimeResult } from '@finmanager/core';
import { formatInr, formatPercent } from '@finmanager/core';
import { Text, View } from 'react-native';

import { Amount } from '../amount';
import { Card } from '../card';

const REGIME_LABEL = {
  new: 'New regime',
  old: 'Old regime',
} as const;

export interface RegimeCardProps {
  result: RegimeResult;
  best: boolean;
  /** Annual rupees this regime gives up by not being the best one. */
  shortfall: number;
  /** Compact cards sit two-up; the monthly figure drops to tile size there. */
  compact?: boolean;
}

/**
 * One regime's outcome, headlined by monthly in-hand.
 *
 * The winner carries a ring, a ▲ and the word "Best" - never colour alone
 * (D-015). At `compact` the amount uses the `tile` size, because display-md
 * overflows a half-width card on a phone (a Phase 1 lesson).
 */
export function RegimeCard({ result, best, shortfall, compact = false }: RegimeCardProps) {
  return (
    <Card className={`flex-1 ${best ? 'border border-primary' : ''}`}>
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="font-display text-title-md text-foreground" numberOfLines={1}>
          {REGIME_LABEL[result.regime]}
        </Text>
        {best ? (
          <View className="flex-row items-center gap-0.5 rounded-full bg-primary px-2 py-0.5">
            <Text className="font-body text-caption text-primary-foreground">▲</Text>
            <Text className="font-body text-caption text-primary-foreground">Best</Text>
          </View>
        ) : null}
      </View>

      <Text className="font-body text-caption text-foreground-muted">Monthly in-hand</Text>
      <Amount value={result.monthlyInHand} size={compact ? 'tile' : 'section'} />

      <View className="mt-3 gap-1.5 border-t border-border pt-3">
        <Row label="Annual in-hand" value={formatInr(result.annualInHand)} />
        <Row label="Taxable income" value={formatInr(result.taxableIncome)} />
        <Row label="Total tax" value={formatInr(result.totalTax)} />
        <Row label="Effective rate" value={formatPercent(result.effectiveRate)} />
        {!best && shortfall > 0 ? (
          <Row label="Costs you" value={`${formatInr(shortfall)}/yr`} />
        ) : null}
      </View>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-2">
      <Text className="flex-1 font-body text-caption text-foreground-muted" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="font-body text-caption text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
