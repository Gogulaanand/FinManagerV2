import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

/** A raised surface. Mirrors apps/web's Card, down to the 16px mobile inset. */
export function Card({ children, className = '' }: CardProps) {
  return <View className={`rounded-lg bg-surface p-4 ${className}`}>{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text className="font-display text-headline-md text-foreground">{children}</Text>;
}

export function CardLabel({ children }: { children: ReactNode }) {
  return <Text className="font-body text-label text-foreground-muted">{children}</Text>;
}
