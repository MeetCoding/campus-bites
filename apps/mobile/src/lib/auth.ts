import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

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

/** Google sign-in via Supabase PKCE in an in-app browser (ARCHITECTURE.md §3.1). */
export async function signInWithGoogle(): Promise<AuthResult> {
  const redirectTo = Linking.createURL(OAUTH_REDIRECT_PATH);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // `hd` only narrows Google's account picker; the before_user_created hook enforces the domain.
      queryParams: { hd: 'iitr.ac.in', prompt: 'select_account' },
    },
  });
  if (error || !data.url) {
    return { ok: false, message: error?.message ?? 'Could not start Google sign-in.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { ok: false, cancelled: true, message: 'Sign-in cancelled.' };
  }

  const url = new URL(result.url);
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

/** Step 1 of vendor sign-in. V1 numbers are Supabase test numbers, so no SMS is sent. */
export async function sendVendorOtp(phoneE164: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
  return error ? { ok: false, message: error.message } : { ok: true };
}

/** Step 2: the 6-digit OTP / passcode. */
export async function verifyVendorOtp(phoneE164: string, token: string): Promise<AuthResult> {
  const { error } = await supabase.auth.verifyOtp({ phone: phoneE164, token, type: 'sms' });
  return error ? { ok: false, message: error.message } : { ok: true };
}
