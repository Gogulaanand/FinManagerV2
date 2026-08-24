import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { MotionView } from './motion';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

/** A raised surface. Mirrors apps/web's Card, down to the 16px mobile inset. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <MotionView className={`rounded-xl border border-border/70 bg-surface p-4 ${className}`}>
      {children}
    </MotionView>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="font-display text-headline-md tracking-tight text-foreground">{children}</Text>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return <Text className="font-data text-label text-foreground-muted">{children}</Text>;
}

/**
 * The one aurora surface in the app. Use only for progress, projections, and
 * other forward-looking calculations; everyday balances stay porcelain.
 */
export function ForecastCard({ children, className = '' }: CardProps) {
  return (
    <MotionView
      className={`relative overflow-hidden rounded-xl border border-forecast/50 bg-forecast p-4 ${className}`}
    >
      <View
        pointerEvents="none"
        className="absolute -right-16 -top-20 size-48 rounded-full bg-accent/25"
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-24 -left-8 size-44 rounded-full bg-primary/15"
      />
      <View className="relative">{children}</View>
    </MotionView>
  );
}
