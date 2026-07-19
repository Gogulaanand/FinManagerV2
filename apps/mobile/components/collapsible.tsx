import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';

export function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
}: PropsWithChildren<{
  readonly title: string;
  readonly count: number;
  readonly defaultOpen?: boolean;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 180 }) }],
  }));

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        className="flex-row items-center justify-between gap-3 py-1"
      >
        <View className="flex-row items-center gap-2">
          <Text className="font-display text-headline-sm text-foreground">{title}</Text>
          <View className="min-w-6 rounded-full bg-surface-muted px-2 py-0.5">
            <Text className="text-center font-body text-caption text-foreground-muted">
              {count}
            </Text>
          </View>
        </View>
        <Animated.Text
          style={chevronStyle}
          className="font-body text-body-md text-foreground-muted"
        >
          ⌄
        </Animated.Text>
      </Pressable>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          className="mt-4 gap-4"
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
