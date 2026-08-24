import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'system' | 'dark';

const THEME_KEY = 'finmanager.mobile.theme';
const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>({ preference: 'system', setPreference: () => undefined });

/**
 * Keeps the explicit preference separate from NativeWind's resolved scheme.
 * NativeWind still owns the actual `dark:` class, while AsyncStorage records
 * whether that scheme came from the user or the operating system.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (!active || (stored !== 'light' && stored !== 'dark' && stored !== 'system')) return;
      setPreferenceState(stored);
      setColorScheme(stored);
    });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  const value = useMemo(
    () => ({
      preference,
      setPreference: (next: ThemePreference) => {
        setPreferenceState(next);
        setColorScheme(next);
        void AsyncStorage.setItem(THEME_KEY, next);
      },
    }),
    [preference, setColorScheme],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
