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

import { getConnector, getPowerSync } from '../lib/powersync';
import { supabase } from '../lib/supabase';

export interface AuthApi {
  session: Session | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
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
    if (!userId || loggedForUser.current === userId) return;
    loggedForUser.current = userId;
    void logActivity(db, userId, 'app_open', 'ios').catch(() => {
      // Best-effort; never surface a logging failure.
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ session, loading, signInWithPassword, signUpWithPassword, signOut }),
    [session, loading, signInWithPassword, signUpWithPassword, signOut],
  );

  return (
    <PowerSyncContext.Provider value={db}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </PowerSyncContext.Provider>
  );
}
