import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../mobile/src/lib/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Set when the build is missing its env vars; App shows it instead of a broken page. */
export const configError =
  !url || !key || !import.meta.env.VITE_API_URL
    ? 'Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_API_URL (see apps/web/.env.example).'
    : null;

/**
 * Publishable key only (RLS applies). Used for Google sign-in and plain reads; every write goes
 * through FastAPI (lib/api.ts). PKCE: Google returns ?code=…, which the client exchanges itself.
 */
export const supabase = createClient<Database>(url ?? 'http://localhost', key ?? 'missing', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
