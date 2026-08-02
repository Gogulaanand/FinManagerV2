'use client';

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

import { getConnector, getPowerSync } from '@/lib/powersync';
import { supabase } from '@/lib/supabase';

export interface AuthApi {
  session: Session | null;
  /** True until the initial session lookup resolves; screens can hold UI back. */
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  /** Resolves the error, plus whether a confirmation email was actually sent. */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<string | null>;
  /** Attempts a bounded final sync and signs out only when the local state is safe. */
  signOut: () => Promise<FinalSyncResult>;
  forceSignOut: (confirmation: ForcedSignOutConfirmation) => Promise<void>;
  authTransitionError: string | null;
}

const AuthContext = createContext<AuthApi | null>(null);

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
          queueMicrotask(() => {
            void supabase.auth.signOut({ scope: 'local' });
          });
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

  // Track the current session. onAuthStateChange also fires an INITIAL_SESSION
  // event, so it seeds `session` on load and follows every sign-in/out. Setting
  // state from this async callback (not synchronously in the effect body) is
  // allowed by the set-state-in-effect rule.
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

  // Dev-only handle for manually exercising the offline -> reconnect sync path
  // (airplane-mode test). Guarded by NODE_ENV so it never ships to production.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    Object.assign(window, {
      __ps: {
        db,
        goOffline: () => db.disconnect(),
        goOnline: () => db.connect(getConnector()),
      },
    });
  }, [db]);

  // Every app open by a signed-in user writes one activity_log row - the
  // inactivity monitor's data source. Guard so it fires once per user id, not on
  // every token refresh.
  const loggedForUser = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    if (loggedForUser.current !== userId) {
      loggedForUser.current = userId;
      void logActivityWithRetry(db, userId, 'app_open', 'web');
    }
    // A tab left open for days never remounts, so returning to it must record a
    // fresh mark of its own rather than only retrying a failed one.
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        void recordActivityIfStale(db, userId, 'app_open', 'web');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [db, session]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return data.session ? activateSession(data.session) : null;
    },
    [activateSession],
  );

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

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error?.message ?? null;
  }, []);

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
      signUpWithPassword,
      signInWithGoogle,
      signOut,
      forceSignOut,
      authTransitionError,
    }),
    [
      session,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
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
