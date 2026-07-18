/**
 * Biometric app lock. When a signed-in user's device has enrolled biometrics
 * (Face ID / Touch ID / device passcode), FinManager locks on cold start and
 * whenever it returns to the foreground, requiring authentication to reveal the
 * financial data. Devices without enrolled biometrics pass through unlocked, so
 * the lock never strands a user who cannot satisfy it.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { useAuth } from './providers';

async function biometricsAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

export function AppLock({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [locked, setLocked] = useState(false);
  const lockedOnce = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Lock once when a signed-in session first appears (cold start or sign-in).
  useEffect(() => {
    if (!session || lockedOnce.current) return;
    let alive = true;
    void (async () => {
      if ((await biometricsAvailable()) && alive) {
        lockedOnce.current = true;
        setLocked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  // Re-lock whenever the app returns to the foreground while signed in.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && sessionRef.current) {
        void biometricsAvailable().then((ok) => {
          if (ok) setLocked(true);
        });
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  const authenticate = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock FinManager',
    });
    if (result.success) setLocked(false);
  }, []);

  // Prompt as soon as we enter the locked state.
  useEffect(() => {
    if (locked) void authenticate();
  }, [locked, authenticate]);

  if (locked) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
        <Text className="font-display text-headline-md text-foreground">FinManager is locked</Text>
        <Text className="text-center font-body text-body-md text-foreground-muted">
          Authenticate to keep your financial data private.
        </Text>
        <Pressable
          onPress={() => void authenticate()}
          accessibilityRole="button"
          className="rounded-md bg-primary px-5 py-3"
        >
          <Text className="font-body text-body-md text-primary-foreground">Unlock</Text>
        </Pressable>
      </View>
    );
  }
  return <>{children}</>;
}
