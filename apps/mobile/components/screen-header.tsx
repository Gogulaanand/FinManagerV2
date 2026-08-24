import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { useColorScheme } from 'nativewind';
import { Text, View } from 'react-native';

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <View className="gap-2 pt-2">
      {eyebrow ? (
        <Text className="font-data text-label uppercase tracking-[2px] text-primary">
          {eyebrow}
        </Text>
      ) : null}
      <View className="flex-row items-start gap-3">
        {icon ? (
          <View className="mt-1 size-10 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name={icon} size={20} color={scheme.primary} />
          </View>
        ) : null}
        <View className="flex-1 gap-1">
          <Text className="font-display text-display-md tracking-tight text-foreground">
            {title}
          </Text>
          {subtitle ? (
            <Text className="font-body text-body-md leading-5 text-foreground-muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function SectionHeading({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="font-display text-headline-md tracking-tight text-foreground">{title}</Text>
      {detail ? (
        <Text className="font-data text-caption uppercase tracking-wider text-foreground-muted">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
