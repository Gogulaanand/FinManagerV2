// Polyfills first: crypto.getRandomValues backs the UUID generator used for
// synced row ids, and must be installed before any crypto call.
import 'react-native-get-random-values';

import { Inter_400Regular, Inter_500Medium, useFonts as useInter } from '@expo-google-fonts/inter';
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts as useManrope,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

import { AppLock } from '../components/app-lock';
import { AppProviders } from '../components/providers';

import '../global.css';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  // Each weight is a separate face: React Native will not synthesise a bold
  // from the regular file, so a missing face renders as regular rather than
  // failing loudly.
  const [manropeLoaded] = useManrope({
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium });

  // Hold the shell back until the faces are in memory. Rendering first would
  // lay every screen out in the system font and reflow once it swaps.
  if (!manropeLoaded || !interLoaded) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <AppProviders>
      <AppLock>
        <Stack screenOptions={{ headerShown: false }} />
      </AppLock>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </AppProviders>
  );
}
