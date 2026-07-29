import { logActivityWithRetry, recordActivityIfStale } from '@finmanager/sync';
import { PowerSyncContext } from '@powersync/react';
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform as RNPlatform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getConnector, getPowerSync } from '../lib/powersync';
import { supabase } from '../lib/supabase';

export interface AuthApi {
  session: Session | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  /** Resolves the error, plus whether a confirmation email was actually sent. */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);
WebBrowser.maybeCompleteAuthSession();

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AppProviders>');
  return ctx;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const db = getPowerSync();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // onAuthStateChange fires INITIAL_SESSION on mount and follows every change.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // Connect PowerSync when signed in; disconnect and wipe local data on sign-out
  // so the next account on this device never sees the previous one's rows.
  useEffect(() => {
    if (session) {
      void db.connect(getConnector());
    } else {
      void db.disconnectAndClear();
    }
  }, [db, session]);

  // One activity_log row per app open by a signed-in user (dead-man switch data).
  const loggedForUser = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const platform = RNPlatform.OS === 'android' ? 'android' : 'ios';
    if (loggedForUser.current !== userId) {
      loggedForUser.current = userId;
      void logActivityWithRetry(db, userId, 'app_open', platform);
    }
    // An app that is only ever backgrounded never remounts, so each return to
    // the foreground must record a fresh mark, not just retry a failed one.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recordActivityIfStale(db, userId, 'app_open', platform);
    });
    return () => subscription.remove();
  }, [db, session]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return error.message;
    if (!data.url) return 'Google sign-in did not return an authorization URL.';
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success')
      return result.type === 'cancel' ? null : 'Google sign-in failed.';

    const parameters = new URL(result.url.replace('#', '?')).searchParams;
    const authError = parameters.get('error_description') ?? parameters.get('error');
    if (authError) return authError;
    const accessToken = parameters.get('access_token');
    const refreshToken = parameters.get('refresh_token');
    if (!accessToken || !refreshToken) return 'Google sign-in returned an incomplete session.';
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return sessionError?.message ?? null;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    // No session means the project requires confirmation and Supabase has sent
    // the email; a session means it is disabled and the user is already in.
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthApi>(
    () => ({
      session,
      loading,
      signInWithPassword,
      signInWithGoogle,
      signUpWithPassword,
      signOut,
    }),
    [session, loading, signInWithPassword, signInWithGoogle, signUpWithPassword, signOut],
  );

  return (
    <PowerSyncContext.Provider value={db}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </PowerSyncContext.Provider>
  );
}
