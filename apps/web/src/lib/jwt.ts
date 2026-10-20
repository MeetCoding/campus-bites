export type AccessClaims = { email?: string; roles?: string[] };

/**
 * Reads the claims of a Supabase access token (custom_access_token_hook adds `roles`). For the UI
 * gate only: the API verifies the signature and re-checks admin in the database on every call.
 */
export function readClaims(token: string): AccessClaims {
  const payload = token.split('.')[1];
  if (!payload) return {};
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AccessClaims;
  } catch {
    return {};
  }
}

export function isAdminToken(token: string): boolean {
  const { roles } = readClaims(token);
  return Array.isArray(roles) && roles.includes('admin');
}
