import { API } from '@/constants/api';
import { formatAmount, getCoalition } from '@/lib/api/coalition';

const token = async () => 'tok-123';
const ID = 'c1500015-0000-0000-0000-000000000015';

/** Answers by URL; anything unlisted is a 404. */
function mockRoutes(routes: Record<string, { status?: number; body: unknown }>) {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  global.fetch = jest.fn(async (url: unknown, init: unknown) => {
    const u = String(url);
    seen.push({ url: u, headers: ((init as RequestInit)?.headers ?? {}) as Record<string, string> });
    const r = routes[u];
    const status = r?.status ?? (r ? 200 : 404);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r?.body ?? {},
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;
  return seen;
}

afterEach(() => jest.resetAllMocks());

// The live answer from coalition-info, 2026-10-08.
const LIVE = {
  coalition_id: ID,
  coalition_name: 'Bishop Ranch',
  organization_name: null,
  status: 'ACTIVE',
  region: 'Americas',
  base_rate: 0.01,
  currency: 'USD',
  country_code: 'US',
};

describe('getCoalition', () => {
  it('reads name, region and currency from coalition-info', async () => {
    mockRoutes({ [API.coalitionInfo(ID)]: { body: LIVE } });
    await expect(getCoalition(token, ID)).resolves.toEqual({
      id: ID,
      name: 'Bishop Ranch',
      region: 'Americas',
      currency: 'USD',
    });
  });

  it('asks for the coalition in the token, and sends only the admin’s token', async () => {
    const seen = mockRoutes({ [API.coalitionInfo(ID)]: { body: LIVE } });
    await getCoalition(token, ID);
    expect(seen[0].url).toBe(API.coalitionInfo(ID));
    expect(seen[0].headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.stringify(seen[0].headers).toLowerCase()).not.toContain('x-api-key');
  });

  it('falls back to the registered name in settings when coalition-info has none', async () => {
    mockRoutes({
      [API.coalitionInfo(ID)]: { body: { ...LIVE, coalition_name: null } },
      [API.settingsCoalition]: { body: { name: 'New Coalition' } },
    });
    await expect(getCoalition(token, ID)).resolves.toMatchObject({ name: 'New Coalition' });
  });

  it('reports no name as null, never a made-up one', async () => {
    mockRoutes({ [API.coalitionInfo(ID)]: { body: { ...LIVE, coalition_name: '' } } });
    await expect(getCoalition(token, ID)).resolves.toMatchObject({ name: null });
  });

  it('fails when coalition-info fails, so the header keeps the Admin marker', async () => {
    mockRoutes({ [API.coalitionInfo(ID)]: { status: 500, body: {} } });
    await expect(getCoalition(token, ID)).rejects.toMatchObject({ code: 'SERVER' });
  });
});

describe('formatAmount', () => {
  it('shows the currency the portal shows: 17.91 USD is $17.91', () => {
    expect(formatAmount(17.91, 'USD', 'en')).toBe('$17.91');
  });

  it('shows the bare number when the currency is unknown, never a guessed symbol', () => {
    expect(formatAmount(17.91, null, 'en')).toBe('17.91');
  });

  it('does not throw on a code it cannot format', () => {
    expect(formatAmount(5, 'NOT-A-CODE', 'en')).toBe('NOT-A-CODE 5');
  });
});
