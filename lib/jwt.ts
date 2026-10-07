// lib/jwt.ts
// JWTs are base64url (RFC 4648 section 5): plain atob() throws on '-' / '_', so
// every decode goes through this normaliser. This reads claims for display and
// routing only. It is never an authorisation decision; the server verifies.

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}
