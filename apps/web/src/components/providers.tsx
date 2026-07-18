'use client';

import { logActivity } from '@finmanager/sync';
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
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
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

  // Track the current session. onAuthStateChange also fires an INITIAL_SESSION
  // event, so it seeds `session` on load and follows every sign-in/out. Setting
  // state from this async callback (not synchronously in the effect body) is
  // allowed by the set-state-in-effect rule.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // Keep PowerSync's connection in lockstep with auth. Signed in -> connect and
  // sync; signed out -> disconnect and wipe the local DB so the next user on
  // this browser never sees the previous user's rows.
  useEffect(() => {
    if (session) {
      void db.connect(getConnector());
    } else {
      void db.disconnectAndClear();
    }
  }, [db, session]);

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
    if (!userId || loggedForUser.current === userId) return;
    loggedForUser.current = userId;
    void logActivity(db, userId, 'app_open', 'web').catch(() => {
      // Best-effort: a logging failure must never surface or block the app.
    });
  }, [db, session]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthApi>(
    () => ({
      session,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, signInWithPassword, signUpWithPassword, signInWithGoogle, signOut],
  );

  return (
    <PowerSyncContext.Provider value={db}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </PowerSyncContext.Provider>
  );
}
