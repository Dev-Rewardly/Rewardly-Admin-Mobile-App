// lib/auth/claims.ts
// What the app reads from the access token. Display and routing only.
import { decodeJwtPayload } from '@/lib/jwt';

export interface AdminClaims {
  sub: string;
  email: string | null;
  name: string | null;
  coalitionId: string;
  roles: string[];
}

interface RawClaims {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  coalition_id?: string;
  tenant_id?: string;
  organization_id?: string;
  realm_access?: { roles?: string[] };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/**
 * The coalition is whatever the token says; the app never picks one. The same
 * three claims, in the same order, that the portal's /api/auth/refresh reads.
 * Null when the token names no coalition: that account is not a coalition admin
 * and the app must refuse the session rather than guess.
 */
export function readClaims(accessToken: string): AdminClaims | null {
  const raw = decodeJwtPayload<RawClaims>(accessToken);
  if (!raw) return null;
  const coalitionId = str(raw.coalition_id) ?? str(raw.tenant_id) ?? str(raw.organization_id);
  const sub = str(raw.sub);
  if (!coalitionId || !sub) return null;
  return {
    sub,
    email: str(raw.email),
    name: str(raw.name) ?? str(raw.preferred_username),
    coalitionId,
    roles: Array.isArray(raw.realm_access?.roles) ? raw.realm_access.roles : [],
  };
}

export function tokenExpiresAtMs(accessToken: string): number | null {
  const exp = decodeJwtPayload<{ exp?: number }>(accessToken)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}
