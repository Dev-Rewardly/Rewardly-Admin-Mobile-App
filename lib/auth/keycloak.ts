// lib/auth/keycloak.ts
// Keycloak token calls: password grant (the portal's existing login), refresh,
// and logout. No client secret; see constants/keycloak.ts.
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_URLS } from '@/constants/keycloak';
import { readClaims, tokenExpiresAtMs } from '@/lib/auth/claims';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. From the token's own `exp`, falling back to `expires_in`. */
  expiresAt: number;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS' // wrong email or password
  | 'NOT_AN_ADMIN' // authenticated, but the token names no coalition
  | 'SESSION_EXPIRED' // refresh token no longer valid
  | 'NETWORK'
  | 'SERVER';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

async function post(url: string, params: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch {
    throw new AuthError('NETWORK');
  }
}

function toTokens(body: TokenResponse, now: number): Tokens {
  if (!body.access_token || !body.refresh_token) throw new AuthError('SERVER');
  const expiresAt = tokenExpiresAtMs(body.access_token) ?? now + (body.expires_in ?? 300) * 1000;
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt };
}

export async function signInWithPassword(
  email: string,
  password: string,
  now: number = Date.now(),
): Promise<Tokens> {
  const res = await post(KEYCLOAK_URLS.token, {
    client_id: KEYCLOAK_CLIENT_ID,
    grant_type: 'password',
    username: email.trim(),
    password,
    scope: 'openid profile email',
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    if (res.status >= 500 || body.error === 'unauthorized_client') throw new AuthError('SERVER');
    throw new AuthError('INVALID_CREDENTIALS');
  }
  const tokens = toTokens(body, now);
  // A valid Keycloak login that names no coalition is not a coalition admin.
  if (!readClaims(tokens.accessToken)) throw new AuthError('NOT_AN_ADMIN');
  return tokens;
}

export async function refreshTokens(refreshToken: string, now: number = Date.now()): Promise<Tokens> {
  const res = await post(KEYCLOAK_URLS.token, {
    client_id: KEYCLOAK_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    // 4xx = the refresh token is dead; 5xx = Keycloak is, and the session may be fine.
    throw new AuthError(res.status >= 500 ? 'SERVER' : 'SESSION_EXPIRED');
  }
  return toTokens(body, now);
}

/** Revokes the refresh token server-side. Best effort: sign-out is never blocked by it. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await post(KEYCLOAK_URLS.logout, { client_id: KEYCLOAK_CLIENT_ID, refresh_token: refreshToken });
  } catch {
    /* the local session is cleared regardless */
  }
}
