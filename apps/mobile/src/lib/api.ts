import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

/** Error from the Campus Bites API. `code` is stable (e.g. WHITELIST_DUPLICATE). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorBody = {
  detail?: { code?: string; message?: string } | { msg?: string }[] | string;
};

function toApiError(status: number, body: ErrorBody | null): ApiError {
  const detail = body?.detail;
  if (Array.isArray(detail)) {
    // FastAPI/Pydantic validation error: surface the first message.
    const msg = detail[0]?.msg?.replace(/^Value error, /, '') ?? 'Please check the form.';
    return new ApiError(status, 'VALIDATION_ERROR', msg);
  }
  if (detail && typeof detail === 'object') {
    return new ApiError(status, detail.code ?? 'ERROR', detail.message ?? 'Something went wrong.');
  }
  return new ApiError(status, 'ERROR', typeof detail === 'string' ? detail : 'Something went wrong.');
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown };

/** The only way the app talks to FastAPI: attaches the Supabase session JWT. */
export async function api<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, 'CONFIG', 'EXPO_PUBLIC_API_URL is not set.');
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the Campus Bites server.');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toApiError(response.status, json as ErrorBody | null);
  }
  return json as T;
}
