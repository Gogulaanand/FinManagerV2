// Polyfills first: crypto.getRandomValues backs the UUID generator used for
// synced row ids, and must be installed before any crypto call.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  useFonts as useManrope,
} from '@expo-google-fonts/manrope';
import {
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
  useFonts as useSora,
} from '@expo-google-fonts/sora';
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  useFonts as usePublicSans,
} from '@expo-google-fonts/public-sans';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

import { AppLock } from '../components/app-lock';
import { AppProviders } from '../components/providers';
import { ThemePreferenceProvider } from '../components/theme-preference';

import '../global.css';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
});

function RootLayout() {
  const { colorScheme } = useColorScheme();

  // Each weight is a separate face: React Native will not synthesise a bold
  // from the regular file, so a missing face renders as regular rather than
  // failing loudly.
  const [manropeLoaded] = useManrope({
    Manrope_400Regular,
    Manrope_500Medium,
  });
  const [soraLoaded] = useSora({ Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });
  const [publicSansLoaded] = usePublicSans({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
  });

  // Hold the shell back until the faces are in memory. Rendering first would
  // lay every screen out in the system font and reflow once it swaps.
  if (!manropeLoaded || !soraLoaded || !publicSansLoaded) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <ThemePreferenceProvider>
      <AppProviders>
        <AppLock>
          <Stack screenOptions={{ headerShown: false }} />
        </AppLock>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </AppProviders>
    </ThemePreferenceProvider>
  );
}

export default Sentry.wrap(RootLayout);
