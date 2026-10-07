import { readClaims, tokenExpiresAtMs } from '@/lib/auth/claims';

// Builds an unsigned JWT with a base64url payload, the way Keycloak emits them.
function jwt(payload: object): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

describe('readClaims', () => {
  it('reads coalition_id, identity and roles', () => {
    const c = readClaims(jwt({ sub: 's1', email: 'a@b.co', name: 'Ada', coalition_id: 'c1', realm_access: { roles: ['ADMIN'] } }));
    expect(c).toEqual({ sub: 's1', email: 'a@b.co', name: 'Ada', coalitionId: 'c1', roles: ['ADMIN'] });
  });

  it('falls back to tenant_id then organization_id, as the portal does', () => {
    expect(readClaims(jwt({ sub: 's', tenant_id: 't1' }))?.coalitionId).toBe('t1');
    expect(readClaims(jwt({ sub: 's', organization_id: 'o1' }))?.coalitionId).toBe('o1');
  });

  it('returns null when the token names no coalition: not a coalition admin', () => {
    expect(readClaims(jwt({ sub: 's', email: 'a@b.co' }))).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(readClaims('not-a-token')).toBeNull();
  });

  it('survives base64url characters in the payload', () => {
    expect(readClaims(jwt({ sub: 's', coalition_id: 'c', name: '???>>>~~~' }))?.name).toBe('???>>>~~~');
  });
});

describe('tokenExpiresAtMs', () => {
  it('converts exp seconds to ms', () => {
    expect(tokenExpiresAtMs(jwt({ exp: 1000 }))).toBe(1_000_000);
  });
  it('is null without exp', () => {
    expect(tokenExpiresAtMs(jwt({}))).toBeNull();
  });
});
