import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { MotionView } from './motion';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

/** A raised surface. Mirrors apps/web's Card, down to the 16px mobile inset. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <MotionView className={`rounded-lg bg-surface p-4 ${className}`}>
      {children}
    </MotionView>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text className="font-display text-headline-md text-foreground">{children}</Text>;
}

export function CardLabel({ children }: { children: ReactNode }) {
  return <Text className="font-body text-label text-foreground-muted">{children}</Text>;
}
