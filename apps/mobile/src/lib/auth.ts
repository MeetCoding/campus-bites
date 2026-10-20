import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Lets the in-app browser hand control back on web; a no-op on native.
WebBrowser.maybeCompleteAuthSession();

export type AuthResult = { ok: true } | { ok: false; cancelled?: boolean; message: string };

/** Route that catches the OAuth redirect: campusbites://auth-callback (or exp://…/--/auth-callback). */
export const OAUTH_REDIRECT_PATH = 'auth-callback';

function readParam(url: URL, name: string): string | null {
  // GoTrue puts PKCE codes in the query and errors in the query or the fragment.
  const fromFragment = new URLSearchParams(url.hash.replace(/^#/, '')).get(name);
  return url.searchParams.get(name) ?? fromFragment;
}

/**
 * Google sign-in via Supabase PKCE in an in-app browser (ARCHITECTURE.md §3.1). On web the whole
 * page goes to Google and comes back to /auth-callback, which calls completeWebGoogleSignIn():
 * a popup can't hand the code back because Google's Cross-Origin-Opener-Policy cuts it off.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = Linking.createURL(OAUTH_REDIRECT_PATH);
  const web = Platform.OS === 'web';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: !web,
      // `hd` only narrows Google's account picker; the before_user_created hook enforces the domain.
      queryParams: { hd: 'iitr.ac.in', prompt: 'select_account' },
    },
  });
  if (error || !data.url) {
    return { ok: false, message: error?.message ?? 'Could not start Google sign-in.' };
  }
  if (web) return { ok: true }; // the browser is already navigating to Google

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { ok: false, cancelled: true, message: 'Sign-in cancelled.' };
  }
  return exchangeRedirect(result.url);
}

/** Web only: finishes the redirect flow on /auth-callback. */
export function completeWebGoogleSignIn(): Promise<AuthResult> {
  return exchangeRedirect(window.location.href);
}

async function exchangeRedirect(redirectUrl: string): Promise<AuthResult> {
  const url = new URL(redirectUrl);
  const failure = readParam(url, 'error_description') ?? readParam(url, 'error');
  if (failure) {
    return { ok: false, message: failure.replace(/\+/g, ' ') };
  }
  const code = readParam(url, 'code');
  if (!code) {
    return { ok: false, message: 'Google sign-in did not return a code. Please try again.' };
  }
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  return exchangeError ? { ok: false, message: exchangeError.message } : { ok: true };
}

/** Accepts a 10-digit Indian mobile (spaces/dashes allowed) and returns +91XXXXXXXXXX. */
export function toIndianE164(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/**
 * Vendor sign-in: phone + the 6-digit passcode an admin set in the web console (a Supabase
 * password on the vendor's phone account). No SMS is sent.
 */
export async function signInVendor(phoneE164: string, passcode: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ phone: phoneE164, password: passcode });
  if (!error) return { ok: true };
  return {
    ok: false,
    message:
      error.code === 'invalid_credentials'
        ? 'Wrong number or passcode. Ask the Campus Bites admin to reset your passcode.'
        : error.message,
  };
}
