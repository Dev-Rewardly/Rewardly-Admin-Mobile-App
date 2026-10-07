// lib/api/client.ts
// One place that talks to the gateway, so auth, timeouts and error shape are
// decided once instead of per screen.

import { API_TIMEOUT_MS } from '../../constants/api';

export type ApiErrorCode =
  | 'NO_SESSION'
  // Refused by this app before the request leaves, because the server would
  // refuse it anyway with a 422 that reads like an outage.
  | 'REASON_REQUIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TIMEOUT'
  | 'OFFLINE'
  | 'SERVER'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;

  constructor(code: ApiErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Map a status to a code the UI can branch on without parsing prose.
 *
 * 401 and 403 are kept apart on purpose. 401 means the session died and the
 * right move is to sign in again; 403 means this admin may not do this and
 * signing in again changes nothing. Collapsing them sends someone round a
 * login loop that cannot succeed.
 */
function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  body?: unknown;
  /** Returns a fresh token, or null when there is no session. */
  getAccessToken: () => Promise<string | null>;
  signal?: AbortSignal;
}

/**
 * THE TOKEN IS THE ADMIN'S OWN, AND NOTHING ELSE IS SENT.
 *
 * No client secret, no service token, no API key baked into the bundle. A
 * mobile binary cannot keep a secret — anyone with the APK has it — so the
 * only credential here is the one the admin obtained by signing in. If an
 * endpoint needs more than that, it is not callable from this app and must be
 * fixed server-side rather than worked around here.
 */
export async function apiFetch<T>(url: string, opts: RequestOptions): Promise<T> {
  const token = await opts.getAccessToken();
  if (!token) {
    throw new ApiError('NO_SESSION', 'You are signed out.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal ?? controller.signal,
    });
  } catch (err) {
    // An abort we caused is a timeout; anything else on a phone is the network.
    // Both are distinct from "the server said no", which the UI words
    // differently -- a retry helps here and does not help a 403.
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'The request took too long.');
    }
    throw new ApiError('OFFLINE', 'No connection.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(codeForStatus(res.status), detail || `Request failed (${res.status})`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
