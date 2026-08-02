import {
  assertForcedSignOutAllowed,
  disconnectForSessionLoss,
  logActivityWithRetry,
  reconcileLocalAccount,
  recordActivityIfStale,
  waitForFinalSync,
  type FinalSyncResult,
  type ForcedSignOutConfirmation,
} from '@finmanager/sync';
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
  /** Attempts a bounded final sync and signs out only when the local state is safe. */
  signOut: () => Promise<FinalSyncResult>;
  forceSignOut: (confirmation: ForcedSignOutConfirmation) => Promise<void>;
  authTransitionError: string | null;
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
  const [authTransitionError, setAuthTransitionError] = useState<string | null>(null);
  const clearOnSessionLoss = useRef(false);
  const transitionQueue = useRef<Promise<void>>(Promise.resolve());
  const activeTransition = useRef<{
    readonly accessToken: string;
    readonly promise: Promise<string | null>;
  } | null>(null);

  const enqueueTransition = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const result = transitionQueue.current.then(work, work);
    transitionQueue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const activateSession = useCallback(
    (nextSession: Session): Promise<string | null> => {
      if (activeTransition.current?.accessToken === nextSession.access_token) {
        return activeTransition.current.promise;
      }
      const promise = enqueueTransition(async () => {
        const reconciliation = await reconcileLocalAccount(db, nextSession.user.id);
        if (reconciliation.status === 'blocked') {
          await disconnectForSessionLoss(db, 'preserve');
          setSession(null);
          const message =
            'This device still has unsynced work for another account. Sign back into that account to sync or export it before switching.';
          setAuthTransitionError(message);
          void supabase.auth.signOut({ scope: 'local' });
          return message;
        }
        await db.connect(getConnector());
        setAuthTransitionError(null);
        setSession(nextSession);
        return null;
      }).finally(() => setLoading(false));
      activeTransition.current = { accessToken: nextSession.access_token, promise };
      return promise;
    },
    [db, enqueueTransition],
  );

  const handleSessionLoss = useCallback(() => {
    // Clear synchronously so an immediately restored event with the same
    // access token cannot reuse the completed pre-loss transition.
    activeTransition.current = null;
    setSession(null);
    return enqueueTransition(async () => {
      const mode = clearOnSessionLoss.current ? 'clear' : 'preserve';
      clearOnSessionLoss.current = false;
      await disconnectForSessionLoss(db, mode);
      setLoading(false);
    });
  }, [db, enqueueTransition]);

  // onAuthStateChange fires INITIAL_SESSION on mount and follows every change.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        void activateSession(nextSession);
      } else {
        void handleSessionLoss();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [activateSession, handleSessionLoss]);

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

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return data.session ? activateSession(data.session) : null;
    },
    [activateSession],
  );

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
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) return sessionError.message;
    return sessionData.session ? activateSession(sessionData.session) : null;
  }, [activateSession]);

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      // No session means the project requires confirmation and Supabase has sent
      // the email; a session means it is disabled and the user is already in.
      const { data, error } = await supabase.auth.signUp({ email, password });
      const transitionError = data.session ? await activateSession(data.session) : null;
      return {
        error: error?.message ?? transitionError,
        needsConfirmation: !error && !data.session,
      };
    },
    [activateSession],
  );

  const completeSignOut = useCallback(async () => {
    clearOnSessionLoss.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      clearOnSessionLoss.current = false;
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<FinalSyncResult> => {
    if (!session) throw new Error('No authenticated session is available to sign out.');
    const result = await waitForFinalSync(db, session.user.id);
    if (result.status === 'ready') await completeSignOut();
    return result;
  }, [completeSignOut, db, session]);

  const forceSignOut = useCallback(
    async (confirmation: ForcedSignOutConfirmation) => {
      assertForcedSignOutAllowed(confirmation);
      await completeSignOut();
    },
    [completeSignOut],
  );

  const value = useMemo<AuthApi>(
    () => ({
      session,
      loading,
      signInWithPassword,
      signInWithGoogle,
      signUpWithPassword,
      signOut,
      forceSignOut,
      authTransitionError,
    }),
    [
      session,
      loading,
      signInWithPassword,
      signInWithGoogle,
      signUpWithPassword,
      signOut,
      forceSignOut,
      authTransitionError,
    ],
  );

  return (
    <PowerSyncContext.Provider value={db}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </PowerSyncContext.Provider>
  );
}
