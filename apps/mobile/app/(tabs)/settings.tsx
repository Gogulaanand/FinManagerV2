import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardLabel, CardTitle } from '../../components/card';
import { DeadmanSettings } from '../../components/settings/deadman-settings';
import { MobileDataRestore } from '../../components/settings/data-restore';
import { MobileSyncHealth } from '../../components/settings/sync-health';
import { useAuth } from '../../components/providers';
import { MobileSafeSignOut } from '../../components/safe-sign-out';

type Choice = 'light' | 'system' | 'dark';

const choices: ReadonlyArray<{
  value: Choice;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'system', label: 'System', icon: 'phone-portrait' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

/**
 * Settings is the theme toggle's home on mobile: there is no persistent header
 * to hang it off, and burning a tab-bar slot on it would break parity with the
 * web sidebar's six modules.
 *
 * Account, sync health, recovery export, and inactivity protection stay here so
 * the tab bar remains focused on day-to-day finance modules.
 */
export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const { session } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-12">
        <View className="flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="settings" size={21} color={scheme.primary} />
          </View>
          <Text className="font-display text-headline-lg text-foreground">Settings</Text>
        </View>

        <Card>
          <View className="mb-3 flex-row items-center gap-2">
            <Ionicons name="color-palette" size={18} color={scheme.primary} />
            <CardTitle>Appearance</CardTitle>
          </View>

          <View className="flex-row gap-2">
            {choices.map(({ value, label, icon }) => {
              // NativeWind reports the resolved scheme, not the stored choice,
              // so 'system' cannot be shown as active without tracking it
              // separately. Phase 3 persists this properly alongside the rest
              // of the user's preferences.
              const active = colorScheme === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setColorScheme(value)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  className={`flex-1 items-center gap-1 rounded-md py-3 ${
                    active ? 'bg-primary' : 'bg-surface-muted'
                  }`}
                >
                  <Ionicons
                    name={icon}
                    size={18}
                    color={active ? scheme.primaryForeground : scheme.foregroundMuted}
                  />
                  <Text
                    className={`font-body text-label ${
                      active ? 'text-primary-foreground' : 'text-foreground-muted'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card className="gap-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="person-circle" size={19} color={scheme.primary} />
            <CardTitle>Account</CardTitle>
          </View>
          {session ? (
            <>
              <Text className="font-body text-body-md text-foreground" numberOfLines={1}>
                {session.user.email}
              </Text>
              <CardLabel>Signed in. Your data syncs across your devices.</CardLabel>
              <MobileSafeSignOut />
            </>
          ) : (
            <>
              <CardLabel>Sign in to sync your finances across web and mobile.</CardLabel>
              <Pressable
                onPress={() => router.push('/login')}
                accessibilityRole="button"
                className="h-11 justify-center rounded-md bg-primary px-4"
              >
                <Text className="text-center font-body text-body-md text-primary-foreground">
                  Sign in
                </Text>
              </Pressable>
            </>
          )}
        </Card>
        <MobileSyncHealth />
        <MobileDataRestore />
        <DeadmanSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
