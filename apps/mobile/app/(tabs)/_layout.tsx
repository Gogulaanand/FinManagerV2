import { Ionicons } from '@expo/vector-icons';
import { color, typography } from '@finmanager/tokens';
import { Tabs, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const visibleTabs = [
  { name: 'index', title: 'Dashboard', icon: 'grid' },
  { name: 'expenses', title: 'Expenses', icon: 'receipt' },
  { name: 'portfolio', title: 'Portfolio', icon: 'trending-up' },
  { name: 'insights', title: 'Insights', icon: 'sparkles' },
] as const;

const moreItems = [
  { route: '/tax', title: 'Tax', detail: 'Compare regimes and take-home', icon: 'business' },
  { route: '/goals', title: 'Goals', detail: 'Goals, retirement, and FIRE', icon: 'flag' },
  {
    route: '/settings',
    title: 'Settings',
    detail: 'Account and app preferences',
    icon: 'settings',
  },
] as const;

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: scheme.primary,
          tabBarInactiveTintColor: scheme.foregroundMuted,
          tabBarStyle: {
            backgroundColor: scheme.surface,
            borderTopColor: scheme.border,
          },
          tabBarLabelStyle: {
            fontFamily: 'Inter_500Medium',
            fontSize: typography.label.size,
          },
          tabBarAllowFontScaling: false,
        }}
      >
        {visibleTabs.map(({ name, title, icon }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarIcon: ({ color: tint, size, focused }) => (
                <Ionicons name={focused ? icon : `${icon}-outline`} size={size} color={tint} />
              ),
            }}
          />
        ))}
        <Tabs.Screen
          name="more"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setMoreOpen(true);
            },
          }}
          options={{
            title: 'More',
            tabBarIcon: ({ color: tint, size }) => (
              <Ionicons name="ellipsis-horizontal" size={size} color={tint} />
            ),
          }}
        />
        <Tabs.Screen name="tax" options={{ href: null }} />
        <Tabs.Screen name="goals" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      <Modal
        visible={moreOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close more menu"
          className="flex-1 justify-end bg-foreground/20"
          onPress={() => setMoreOpen(false)}
        >
          <Pressable
            accessibilityRole="menu"
            className="rounded-t-lg bg-surface p-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-display text-headline-md text-foreground">More</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="size-10 items-center justify-center rounded-md"
                onPress={() => setMoreOpen(false)}
              >
                <Ionicons name="close" size={24} color={scheme.foregroundMuted} />
              </Pressable>
            </View>
            {moreItems.map((item, index) => (
              <Pressable
                key={item.route}
                accessibilityRole="menuitem"
                onPress={() => {
                  setMoreOpen(false);
                  router.push(item.route);
                }}
                className={`flex-row items-center gap-3 py-4 ${
                  index < moreItems.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <Ionicons name={item.icon} size={22} color={scheme.foregroundMuted} />
                <View className="flex-1">
                  <Text className="font-body text-body-md text-foreground">{item.title}</Text>
                  <Text className="font-body text-caption text-foreground-muted">
                    {item.detail}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={scheme.foregroundMuted} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
