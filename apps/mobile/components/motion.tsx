import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';

export function useInitialSkeleton(duration = 240): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return !ready;
}

export function MotionView({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    const animation = withTiming(1, {
      duration: reduceMotion ? 0 : 360,
      easing: Easing.out(Easing.cubic),
    });
    progress.value = reduceMotion || delay === 0 ? animation : withDelay(delay, animation);
  }, [delay, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));

  return (
    <Animated.View className={className} style={style}>
      {children}
    </Animated.View>
  );
}

export function MotionProgress({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? value : 0);

  useEffect(() => {
    progress.value = withTiming(value, {
      duration: reduceMotion ? 0 : 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduceMotion, value]);

  const style = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View className={`h-full rounded-full bg-primary ${className}`} style={style} />
  );
}

export function MobileWorkspaceSkeleton({ label }: { label: string }) {
  return (
    <View className="flex-1 bg-background p-4">
      <View className="items-center gap-3 py-8" accessibilityLabel={label} accessibilityRole="progressbar">
        <ActivityIndicator color="#2d9b72" />
        <Text className="font-body text-body-md text-foreground-muted">{label}</Text>
      </View>
      <View className="gap-4">
        <View className="h-28 rounded-lg bg-surface-muted" />
        <View className="h-28 rounded-lg bg-surface-muted" />
        <View className="h-56 rounded-lg bg-surface-muted" />
      </View>
    </View>
  );
}
