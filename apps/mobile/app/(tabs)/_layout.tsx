import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { Tabs, useRouter, type Href } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../components/providers';

type RouteName =
  'index' | 'expenses' | 'portfolio' | 'insights' | 'more' | 'goals' | 'tax' | 'settings';
type DockRoute = { key: string; name: RouteName };
type QuickAction = {
  readonly href: string;
  readonly label: string;
  readonly icon: keyof typeof Ionicons.glyphMap;
};
type DockProps = {
  state: { index: number; routes: readonly DockRoute[] };
  navigation: { navigate: (name: string) => void };
  onMore: () => void;
  onQuickAdd: (action: QuickAction) => void;
  canQuickAdd: boolean;
};

const destinations: readonly {
  name: RouteName;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'expenses', title: 'Spend', icon: 'receipt-outline' },
  { name: 'portfolio', title: 'Wealth', icon: 'trending-up-outline' },
  { name: 'insights', title: 'Insights', icon: 'sparkles-outline' },
  { name: 'more', title: 'More', icon: 'ellipsis-horizontal' },
];

const moreItems = [
  {
    route: '/tax',
    title: 'Tax planning',
    detail: 'Compare regimes and take-home',
    icon: 'calculator',
  },
  {
    route: '/goals',
    title: 'Goals & FIRE',
    detail: 'Track the milestones that matter',
    icon: 'flag-outline',
  },
  {
    route: '/settings',
    title: 'Settings',
    detail: 'Appearance, account, and recovery',
    icon: 'settings-outline',
  },
] as const;

const quickActions: Partial<Record<RouteName, QuickAction>> = {
  index: { href: '/transaction/new', label: 'Add transaction', icon: 'receipt-outline' },
  expenses: { href: '/transaction/new', label: 'Add transaction', icon: 'receipt-outline' },
  portfolio: { href: '/holding/new', label: 'Add holding', icon: 'trending-up-outline' },
  goals: { href: '/goal/new', label: 'Add goal', icon: 'flag-outline' },
};

function QuietDock({ state, navigation, onMore, onQuickAdd, canQuickAdd }: DockProps) {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const quickAction = canQuickAdd && activeName ? quickActions[activeName] : undefined;

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 items-center">
      <View
        className="relative mx-5 mb-3 self-stretch max-w-md flex-row items-center justify-between rounded-[28px] border border-border/80 bg-surface/95 px-2 py-2 shadow-lg"
        style={{ paddingBottom: Math.max(insets.bottom, 8) + 8 }}
      >
        {destinations.map((destination) => {
          const active = activeName === destination.name;
          return (
            <Pressable
              key={destination.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={destination.title}
              onPress={() => {
                if (destination.name === 'more') onMore();
                else navigation.navigate(destination.name);
              }}
              className="min-h-11 min-w-14 flex-1 items-center justify-center gap-1 rounded-2xl px-1"
            >
              <Ionicons
                name={destination.icon}
                size={21}
                color={active ? scheme.primary : scheme.foregroundMuted}
              />
              <Text
                className={`font-data text-[10px] ${active ? 'text-primary' : 'text-foreground-muted'}`}
              >
                {destination.title}
              </Text>
            </Pressable>
          );
        })}
        {quickAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={quickAction.label}
            onPress={() => onQuickAdd(quickAction)}
            className="absolute left-1/2 top-0 size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-accent shadow-lg"
          >
            <Ionicons name={quickAction.icon} size={22} color={scheme.accentForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MoreSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close more menu"
        className="flex-1 justify-end bg-foreground/25"
        onPress={onClose}
      >
        {children}
      </Pressable>
    </Modal>
  );
}

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <QuietDock
            state={props.state as DockProps['state']}
            navigation={props.navigation}
            onMore={() => setMoreOpen(true)}
            onQuickAdd={(action) => router.push(action.href as Href)}
            canQuickAdd={Boolean(session) && !authLoading}
          />
        )}
        screenOptions={{ headerShown: false }}
      >
        {destinations.map(({ name }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{ title: name === 'index' ? 'Home' : name }}
          />
        ))}
        <Tabs.Screen name="tax" options={{ href: null }} />
        <Tabs.Screen name="goals" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <Pressable
          accessibilityRole="menu"
          className="rounded-t-3xl border-t border-border bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="font-display text-headline-md tracking-tight text-foreground">
                More
              </Text>
              <Text className="font-body text-caption text-foreground-muted">
                Plan, protect, and tune your money
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="size-11 items-center justify-center rounded-full bg-surface-muted"
              onPress={() => setMoreOpen(false)}
            >
              <Ionicons name="close" size={20} color={scheme.foregroundMuted} />
            </Pressable>
          </View>
          {moreItems.map((item) => (
            <Pressable
              key={item.route}
              accessibilityRole="menuitem"
              onPress={() => {
                setMoreOpen(false);
                router.push(item.route as Href);
              }}
              className="min-h-16 flex-row items-center gap-3 border-t border-border/70 py-3"
            >
              <View className="size-10 items-center justify-center rounded-full bg-primary/10">
                <Ionicons name={item.icon} size={20} color={scheme.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-body text-body-md text-foreground">{item.title}</Text>
                <Text className="font-body text-caption text-foreground-muted">{item.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={scheme.foregroundMuted} />
            </Pressable>
          ))}
        </Pressable>
      </MoreSheet>
    </>
  );
}
