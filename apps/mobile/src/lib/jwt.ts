import type { Enums } from '@/lib/database.types';

export type AppRole = Enums<'app_role'>;

/** Custom claims added by public.custom_access_token_hook (supabase/migrations/003_auth.sql). */
export type AppClaims = {
  sub: string;
  email: string | null;
  phone: string | null;
  app_role: AppRole | null;
  roles: AppRole[];
  bhawan_id: string | null;
  scope_bhawan_ids: string[];
  outlet_ids: string[];
};

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  // UTF-8 decode without TextDecoder (not guaranteed on Hermes): bytes → %XX → string.
  return decodeURIComponent(
    Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Reads claims from an access token WITHOUT verifying it. Only for UI decisions —
 * Postgres (RLS) and FastAPI verify the signature and enforce access.
 */
export function decodeClaims(accessToken: string): AppClaims {
  const payload = JSON.parse(base64UrlDecode(accessToken.split('.')[1] ?? '')) as Record<
    string,
    unknown
  >;
  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' && payload.email ? payload.email : null,
    phone: typeof payload.phone === 'string' && payload.phone ? payload.phone : null,
    app_role: (payload.app_role as AppRole | null) ?? null,
    roles: stringArray(payload.roles) as AppRole[],
    bhawan_id: typeof payload.bhawan_id === 'string' ? payload.bhawan_id : null,
    scope_bhawan_ids: stringArray(payload.scope_bhawan_ids),
    outlet_ids: stringArray(payload.outlet_ids),
  };
}
