import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { isAdminToken, readClaims } from '@/lib/jwt';
import { supabase } from '@/lib/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out'; notice: string | null }
  | { status: 'admin'; email: string; userId: string };

type SessionContextValue = SessionState & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Reads an OAuth error Supabase sent back in the URL (e.g. the sign-up hook refusing a non-IITR
 * account) and removes it from the address bar.
 */
function takeOAuthError(): string | null {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const message =
    url.searchParams.get('error_description') ?? hash.get('error_description') ?? null;
  if (message) {
    window.history.replaceState(null, '', url.pathname);
  }
  return message?.replace(/\+/g, ' ') ?? null;
}

/**
 * Only admins get past sign-in: any other account (e.g. an IITR student) is signed straight out
 * with a notice. Admins are the emails on the Admins page (role_assignments + admin_invites).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const notice = useRef<string | null>(takeOAuthError());

  useEffect(() => {
    function apply(session: Session | null) {
      if (!session) {
        queryClient.clear();
        setState({ status: 'signed-out', notice: notice.current });
        return;
      }
      if (isAdminToken(session.access_token)) {
        notice.current = null;
        setState({
          status: 'admin',
          email: session.user.email ?? readClaims(session.access_token).email ?? '',
          userId: session.user.id,
        });
        return;
      }
      notice.current = `${session.user.email ?? 'This account'} isn't a Campus Bites admin. Ask an admin to add you.`;
      void supabase.auth.signOut();
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase advises not to await its own calls inside this callback.
      setTimeout(() => apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  async function signIn() {
    notice.current = null;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setState({ status: 'signed-out', notice: error.message });
  }

  async function signOut() {
    notice.current = null;
    await supabase.auth.signOut();
  }

  return (
    <SessionContext.Provider value={{ ...state, signIn, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
