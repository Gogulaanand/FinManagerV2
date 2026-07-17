import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { useColorScheme } from 'nativewind';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from './card';

export interface ModulePlaceholderProps {
  title: string;
  /** The phase that builds this module, so the shell is honest about what it is. */
  phase: number;
  summary: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * The designed state for a module whose feature work lands in a later phase.
 *
 * Mirrors apps/web's ModulePlaceholder. Deliberately not a TODO: the Phase 1
 * shell is meant to be navigable and look finished. Each of these is replaced
 * wholesale by the phase named in `phase`.
 */
export function ModulePlaceholder({ title, phase, summary, icon }: ModulePlaceholderProps) {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="gap-4 p-4">
        <Text className="font-display text-headline-lg text-foreground">{title}</Text>

        <Card className="items-center gap-3 py-12">
          <View className="size-12 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name={icon} size={24} color={scheme.primary} />
          </View>

          <Text className="text-center font-body text-body-md text-foreground-muted">
            {summary}
          </Text>

          <View className="rounded-full bg-surface-muted px-3 py-1">
            <Text className="font-body text-caption text-foreground-muted">
              Arrives in Phase {phase}
            </Text>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}
