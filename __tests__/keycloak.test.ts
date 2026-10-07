import { AuthError, refreshTokens, revokeRefreshToken, signInWithPassword } from '@/lib/auth/keycloak';
import { KEYCLOAK_URLS } from '@/constants/keycloak';

function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

const adminToken = jwt({ sub: 's1', coalition_id: 'c1', exp: 2_000 });

function mockFetch(status: number, body: object) {
  const fn = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  (global as any).fetch = fn;
  return fn;
}

afterEach(() => jest.restoreAllMocks());

describe('signInWithPassword', () => {
  it('posts a password grant with no client secret and returns tokens', async () => {
    const fetchMock = mockFetch(200, { access_token: adminToken, refresh_token: 'r1', expires_in: 300 });
    const t = await signInWithPassword('  a@b.co ', 'pw', 0);
    expect(t).toEqual({ accessToken: adminToken, refreshToken: 'r1', expiresAt: 2_000_000 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(KEYCLOAK_URLS.token);
    const body = new URLSearchParams(init.body);
    expect(body.get('grant_type')).toBe('password');
    expect(body.get('username')).toBe('a@b.co');
    expect(body.has('client_secret')).toBe(false);
  });

  it('maps a rejected login to INVALID_CREDENTIALS', async () => {
    mockFetch(401, { error: 'invalid_grant' });
    await expect(signInWithPassword('a@b.co', 'bad')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('maps a confidential-client refusal to SERVER, not to wrong credentials', async () => {
    mockFetch(401, { error: 'unauthorized_client' });
    await expect(signInWithPassword('a@b.co', 'pw')).rejects.toMatchObject({ code: 'SERVER' });
  });

  it('refuses a login whose token names no coalition', async () => {
    mockFetch(200, { access_token: jwt({ sub: 's1' }), refresh_token: 'r1' });
    await expect(signInWithPassword('a@b.co', 'pw')).rejects.toMatchObject({ code: 'NOT_AN_ADMIN' });
  });

  it('maps a thrown fetch to NETWORK', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(signInWithPassword('a@b.co', 'pw')).rejects.toBeInstanceOf(AuthError);
    await expect(signInWithPassword('a@b.co', 'pw')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('refreshTokens', () => {
  it('treats a 4xx as an ended session and a 5xx as a transient failure', async () => {
    mockFetch(400, { error: 'invalid_grant' });
    await expect(refreshTokens('r')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    mockFetch(503, {});
    await expect(refreshTokens('r')).rejects.toMatchObject({ code: 'SERVER' });
  });
});

describe('revokeRefreshToken', () => {
  it('never throws, even offline', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(revokeRefreshToken('r')).resolves.toBeUndefined();
  });
});
