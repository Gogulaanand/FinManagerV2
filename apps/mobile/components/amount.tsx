import { directionOf, formatDelta, formatInr } from '@finmanager/core';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

const directionClass = {
  up: 'text-gain',
  down: 'text-loss',
  flat: 'text-foreground-muted',
} as const;

const directionGlyph = {
  up: '▲',
  down: '▼',
  flat: '',
} as const;

export interface DeltaProps {
  /** A ratio, not a percentage: 0.024 renders as +2.4%. */
  ratio: number;
}

/**
 * A percentage change, e.g. "▲ 2.4%".
 *
 * The glyph is not decoration. gain and loss sit at nearly the same luminance,
 * so color alone does not survive greyscale or red-green colorblindness - the
 * glyph and the sign are what carry the meaning.
 */
export function Delta({ ratio }: DeltaProps) {
  const direction = directionOf(ratio);
  return (
    <View className="flex-row items-center gap-1">
      {directionGlyph[direction] !== '' && (
        <Text className={`font-body text-label ${directionClass[direction]}`}>
          {directionGlyph[direction]}
        </Text>
      )}
      <Text className={`font-body text-label ${directionClass[direction]}`}>
        {formatDelta(ratio)}
      </Text>
    </View>
  );
}

export interface AmountProps {
  /** Rupees. Rounded to paise before display, per D-014. */
  value: number;
  signed?: boolean;
  paise?: boolean;
  size?: 'hero' | 'section' | 'tile' | 'row';
}

const sizeClass = {
  hero: 'font-display-hero text-display-lg',
  section: 'font-display text-display-md',
  /** Half-width stat tiles: display-md overflows them on a phone. */
  tile: 'font-display text-headline-lg',
  row: 'font-display-soft text-title-md',
} as const;

/**
 * A rupee figure.
 *
 * fontVariant tabular-nums keeps amounts aligned down a column of
 * transactions; without it the digits are proportional and the column ragged.
 */
export function Amount({ value, signed = false, paise = false, size = 'row' }: AmountProps) {
  const direction = directionOf(value);
  const reduceMotion = useReducedMotion();
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration: reduceMotion ? 0 : 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [animatedValue, reduceMotion, value]);

  useAnimatedReaction(
    () => animatedValue.value,
    (current) => {
      runOnJS(setDisplayValue)(current);
    },
  );

  return (
    <Animated.Text
      className={`${sizeClass[size]} ${signed ? directionClass[direction] : 'text-foreground'}`}
      style={{ fontVariant: ['tabular-nums'] }}
      // A currency figure must never wrap: breaking ₹8,10,000 across two lines
      // reads as two different numbers. Shrink to fit instead.
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {formatInr(displayValue, { paise, signed })}
    </Animated.Text>
  );
}
