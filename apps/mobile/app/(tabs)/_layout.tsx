import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';

/**
 * The six modules, in the same order as the web sidebar.
 *
 * Icon names are Ionicons rather than the web's lucide set - the two platforms
 * share tokens and structure, not icon vendors.
 */
const tabs = [
  { name: 'index', title: 'Dashboard', icon: 'grid' },
  { name: 'tax', title: 'Tax', icon: 'business' },
  { name: 'expenses', title: 'Expenses', icon: 'receipt' },
  { name: 'portfolio', title: 'Portfolio', icon: 'trending-up' },
  { name: 'goals', title: 'Goals', icon: 'flag' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
] as const;

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  // The tab bar is a native component and takes real color values, not
  // classNames, so it reads the scheme from tokens directly.
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
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
          // 10px, and no Dynamic Type scaling: six tabs have to share the
          // width, and 'Dashboard' truncates to 'Dashboa...' at 11px.
          fontSize: 10,
        },
        tabBarAllowFontScaling: false,
      }}
    >
      {tabs.map(({ name, title, icon }) => (
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
    </Tabs>
  );
}
