import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { defaultMode, modesFor, type Mode } from '@/features/auth/modes';
import { registerForPush, unregisterPush } from '@/features/notifications/push';
import { signInWithGoogle as startGoogleSignIn } from '@/lib/auth';
import { decodeClaims, type AppClaims } from '@/lib/jwt';
import { supabase } from '@/lib/supabase';

type SessionState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  session: Session | null;
  claims: AppClaims | null;
  /** Role groups this user may enter, e.g. ['student', 'staff'] for a Mess Secretary. */
  modes: Mode[];
  mode: Mode | null;
  setMode: (mode: Mode) => void;
  /** Students must pick their Bhawan before anything else. */
  needsOnboarding: boolean;
  /** Last Google sign-in failure; lives here so it survives the OAuth redirect remount. */
  authError: string | null;
  googleSignInPending: boolean;
  signInWithGoogle: () => Promise<void>;
  clearAuthError: () => void;
  /** Re-issues the JWT so new claims (Bhawan, roles) take effect immediately. */
  refreshClaims: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleSignInPending, setGoogleSignInPending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signed-in' : 'signed-out');
      if (!next) {
        setChosenMode(null);
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const claims = useMemo(
    () => (session ? decodeClaims(session.access_token) : null),
    [session],
  );
  const modes = useMemo(() => modesFor(claims?.roles ?? []), [claims]);
  const mode =
    chosenMode && modes.includes(chosenMode) ? chosenMode : defaultMode(claims?.app_role ?? null, modes);
  const needsOnboarding = !!claims && claims.roles.includes('student') && !claims.bhawan_id;

  // Register this device for push once per signed-in user with a Campus Bites role.
  const pushUserId = claims && modes.length > 0 ? claims.sub : null;
  useEffect(() => {
    if (!pushUserId) return;
    registerForPush().then((result) => {
      if (result.status === 'skipped' && __DEV__) {
        console.info(`[push] not registered: ${result.reason}`);
      }
    });
  }, [pushUserId]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setGoogleSignInPending(true);
    try {
      const result = await startGoogleSignIn();
      if (!result.ok && !result.cancelled) {
        setAuthError(result.message);
      }
    } finally {
      setGoogleSignInPending(false);
    }
  }, []);

  const refreshClaims = useCallback(async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    // Needs the session for RLS, so it runs before signOut; never block sign-out on it.
    await unregisterPush().catch(() => undefined);
    await supabase.auth.signOut();
  }, []);

  const value: SessionState = {
    status,
    session,
    claims,
    modes,
    mode,
    setMode: setChosenMode,
    needsOnboarding,
    authError,
    googleSignInPending,
    signInWithGoogle,
    clearAuthError: () => setAuthError(null),
    refreshClaims,
    signOut,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}
