import { API } from '@/constants/api';
import * as api from '@/lib/api/dashboard';
import { relativeAge, visibleActivity, type ActivityRow } from '@/lib/dashboard/activity';
import {
  loadingM,
  measured,
  oldestDays,
  queueTone,
  stripState,
  unavailable,
  type AttentionSource,
} from '@/lib/dashboard/attention';
import { bandFor, toCoverage } from '@/lib/dashboard/coverage';
import { oversightCounts } from '@/lib/dashboard/oversight';
import { estimateRunway, runwayLabel, runwayNote } from '@/lib/dashboard/runway';
import { attentionSources, type AttentionInputs } from '@/lib/dashboard/sources';

const token = async () => 'tok-123';
const DAY = 86_400_000;

function mockRoutes(routes: Record<string, { status?: number; body: unknown }>) {
  const seen: string[] = [];
  global.fetch = jest.fn(async (url: unknown) => {
    const u = String(url);
    seen.push(u);
    const r = routes[u];
    const status = r?.status ?? (r ? 200 : 404);
    return { ok: status >= 200 && status < 300, status, json: async () => r?.body ?? {}, text: async () => '' } as Response;
  }) as unknown as typeof fetch;
  return seen;
}

afterEach(() => jest.resetAllMocks());

// ── Reward pool band: the portal's ladder ─────────────────────────────────────

describe('bandFor matches the portal', () => {
  it.each([
    [2, 100, 'healthy'],
    [1.5, 100, 'healthy'],
    [1.3, 100, 'watch'],
    [1.0, 100, 'restricted'],
    [0.5, 100, 'earn_paused'],
    [null, 100, 'healthy'], // nothing owed yet is not a shortfall
    [3, 0, 'backstop'], // an empty pool, whatever the ratio
  ])('ratio %p, pool %p -> %p', (ratio, pool, band) => {
    expect(bandFor(ratio as number | null, pool as number)).toBe(band);
  });

  it('reads the live Bishop Ranch pool as healthy', () => {
    const c = toCoverage({ pool_balance: 248695, liability: 38.13, points_outstanding: 3813 });
    expect(c.band).toBe('healthy');
    expect(c.poolBalance).toBe(248695);
    expect(c.liability).toBe(38.13);
  });

  it('accepts the body wrapped in {success, data}', () => {
    expect(toCoverage({ success: true, data: { pool_balance: 10, liability: 10 } }).band).toBe('restricted');
  });
});

// ── Runway: the portal's rule ─────────────────────────────────────────────────

describe('runway', () => {
  it('averages money per day and floors the days', () => {
    const series = [
      { date: '2026-10-06', pointsIssued: 100, costUsd: 1 },
      { date: '2026-10-07', pointsIssued: 300, costUsd: 3 },
    ];
    const r = estimateRunway(100, series, 0, null);
    expect(r).toMatchObject({ dailyBurn: 2, days: 50, basis: 'series', daysMeasured: 2 });
    expect(runwayLabel(r.days)).toEqual({ key: 'dashboard.runway.days', days: 50 });
    expect(runwayNote(r)).toEqual({ key: 'dashboard.runway.note_series', count: 2 });
  });

  it('prices points with base_rate (points PER unit) when the ledger did not', () => {
    const r = estimateRunway(10, [{ date: 'd', pointsIssued: 500, costUsd: null }], 0, 100);
    expect(r.dailyBurn).toBe(5); // 500 / 100, never 500 x 100
    expect(r.days).toBe(2);
  });

  it('ignores trailing days with no issuance', () => {
    const r = estimateRunway(
      100,
      [
        { date: '1', pointsIssued: 100, costUsd: 4 },
        { date: '2', pointsIssued: 0, costUsd: null },
      ],
      0,
      null,
    );
    expect(r.daysMeasured).toBe(1);
    expect(r.days).toBe(25);
  });

  it('says it cannot price the points rather than inventing a figure', () => {
    const r = estimateRunway(100, [{ date: 'd', pointsIssued: 50, costUsd: null }], 0, null);
    expect(r).toMatchObject({ days: null, basis: 'unvalued' });
    expect(runwayLabel(r.days).key).toBe('dashboard.runway.unknown');
  });

  it('labels a year or more as >1 year, and never ~0d', () => {
    expect(runwayLabel(400).key).toBe('dashboard.runway.over_a_year');
    expect(runwayLabel(0).key).toBe('dashboard.runway.under_a_day');
  });
});

// ── Needs attention ───────────────────────────────────────────────────────────

const src = (id: string, count: AttentionSource['count']): AttentionSource => ({ id, count, tone: 'neutral' });

describe('stripState: all clear is a conclusion, not an absence', () => {
  it('shows known work even when another source failed', () => {
    const s = stripState([src('a', measured(3)), src('b', unavailable())]);
    expect(s.kind).toBe('items');
    if (s.kind === 'items') expect(s.unreachable.map((x) => x.id)).toEqual(['b']);
  });
  it('is loading, not all clear, while anything is still loading', () => {
    expect(stripState([src('a', measured(0)), src('b', loadingM())]).kind).toBe('loading');
  });
  it('is unavailable, not all clear, when a source failed and none has work', () => {
    expect(stripState([src('a', measured(0)), src('b', unavailable())]).kind).toBe('unavailable');
  });
  it('is all clear only when every source reported zero', () => {
    expect(stripState([src('a', measured(0)), src('b', measured(0))]).kind).toBe('all-clear');
  });
});

describe('approvals age', () => {
  it('colours the queue by its oldest item, as the portal does', () => {
    expect(queueTone(measured(1))).toBe('neutral');
    expect(queueTone(measured(3))).toBe('warning');
    expect(queueTone(measured(21))).toBe('error');
  });
  it('counts whole days', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    expect(oldestDays(['2026-10-05T11:00:00Z'], now)).toBe(3);
    expect(oldestDays([null, 'nonsense'], now)).toBeNull();
  });
});

const allOk = (over: Partial<AttentionInputs> = {}): AttentionInputs => ({
  receiptStats: measured({ pending: 0, flagged: 0 }),
  oldestPendingAt: measured(null),
  oversight: measured(oversightCounts({})), // every section absent -> null counts
  coverage: measured(toCoverage({ pool_balance: 100, liability: 10 })),
  awaitingOnboarding: measured(0),
  settlementsDue: measured(0),
  failedRedemptions: measured(0),
  promotionsOverdue: measured(0),
  trialDaysLeft: measured(null),
  ...over,
});

describe('attentionSources', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  const overview = {
    money: { available: true as const, overdue: { count: 0 } },
    fraud: { available: true as const, overrides: 0, flagged_approved: 3, duplicate_receipts: 0 },
    approvals: { available: true as const, waiting: { overdue: 0 } },
    redemptions: { available: true as const, stuck: { count: 0 } },
    disputes: { available: true as const, settlement: [], member: [{ status: 'OPEN', count: 2 }, { status: 'CLOSED', count: 5 }] },
    security: { available: true as const, team: { without_mfa: 9 }, api_keys: { expiring: 0 }, signins: null },
    system: { available: true as const, spine: [] },
  };

  it('reproduces the web chips for Bishop Ranch', () => {
    const sources = attentionSources(
      allOk({ oversight: measured(oversightCounts(overview)), awaitingOnboarding: measured(21) }),
      now,
    );
    const s = stripState(sources);
    expect(s.kind).toBe('items');
    if (s.kind !== 'items') return;
    const shown = Object.fromEntries(s.items.map((i) => [i.id, i.count.state === 'ok' ? i.count.value : null]));
    expect(shown).toEqual({ flagged_approved: 3, disputes: 2, mfa: 9, participants: 21 });
    // failed sign-ins has no sign-in data: couldn't check, never 0
    expect(s.unreachable.map((u) => u.id)).toEqual(['failed_signins']);
  });

  it('collapses an unreadable overview into one "oversight checks" line', () => {
    const ids = attentionSources(allOk({ oversight: unavailable() }), now).map((s) => s.id);
    expect(ids).toContain('oversight');
    expect(ids).not.toContain('mfa');
  });

  it('says past due, in red, when the server reports overdue settlements', () => {
    const o = { ...overview, money: { available: true as const, overdue: { count: 2 } } };
    const first = attentionSources(allOk({ oversight: measured(oversightCounts(o)) }), now)[0];
    expect(first).toMatchObject({ id: 'settlements_past_due', tone: 'error' });
  });

  it('turns the approvals chip red when the oldest has waited 7+ days', () => {
    const a = attentionSources(
      allOk({ receiptStats: measured({ pending: 4, flagged: 0 }), oldestPendingAt: measured('2026-09-30T12:00:00Z') }),
      now,
    ).find((s) => s.id === 'approvals');
    expect(a).toMatchObject({ tone: 'error', count: { state: 'ok', value: 4 }, oldestDays: { state: 'ok', value: 8 } });
  });

  it('raises coverage only when the band is not healthy', () => {
    const watch = attentionSources(allOk({ coverage: measured(toCoverage({ pool_balance: 13, liability: 10 })) }), now);
    expect(watch.find((s) => s.id === 'coverage')?.count).toEqual(measured(1));
  });

  it('counts a trial only in its last 7 days', () => {
    const t = (days: number) => attentionSources(allOk({ trialDaysLeft: measured(days) }), now).find((s) => s.id === 'trial')?.count;
    expect(t(12)).toEqual(measured(0));
    expect(t(5)).toEqual(measured(5));
  });
});

// ── Recent activity ───────────────────────────────────────────────────────────

describe('recent activity', () => {
  const row = (over: Partial<ActivityRow>): ActivityRow => ({ kind: 'earn', id: '1', at: null, participant: 'Equinox', points: 10, ...over });

  it('drops zero-point and nameless rows, and keeps the limit', () => {
    const rows = [row({ id: 'a', points: 0 }), row({ id: 'b', participant: '' }), row({ id: 'c' }), row({ id: 'd' }), row({ id: 'e' })];
    expect(visibleActivity(rows, 2).map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('words ages compactly', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    expect(relativeAge('2026-10-08T11:59:40Z', now)).toEqual({ key: 'dashboard.ago.now' });
    expect(relativeAge('2026-10-08T11:30:00Z', now)).toEqual({ key: 'dashboard.ago.minutes', count: 30 });
    expect(relativeAge('2026-10-07T10:00:00Z', now)).toEqual({ key: 'dashboard.ago.days', count: 1 });
    expect(relativeAge(null, now)).toBeNull();
  });
});

// ── API reads: a failure is never a zero ──────────────────────────────────────

describe('dashboard API', () => {
  it('reads today, the series and activity from /analytics?period=30d', async () => {
    const seen = mockRoutes({
      [`${API.analytics}?period=30d`]: {
        body: {
          success: true,
          today: { pointsIssued: 144, pointsRedeemed: 0, membersActive: 1, gmv: 80.52, transactions: 3, redemptions: 0 },
          earnSeries: [{ date: '2026-10-07', pointsIssued: 100, costUsd: null }],
          recentActivity: [{ kind: 'redeem', id: 'r', at: null, participant: 'THE LOT Cinema', points: 50 }],
        },
      },
    });
    const a = await api.getAnalytics(token);
    expect(seen).toEqual([`${API.analytics}?period=30d`]);
    expect(a.today).toEqual({ pointsIssued: 144, pointsRedeemed: 0, membersActive: 1, gmv: 80.52 });
    expect(a.earnSeries).toHaveLength(1);
    expect(a.recentActivity[0].participant).toBe('THE LOT Cinema');
  });

  it('keeps today null when the server could not compute it', async () => {
    mockRoutes({ [`${API.analytics}?period=30d`]: { body: { success: true, today: null } } });
    expect((await api.getAnalytics(token)).today).toBeNull();
  });

  it('throws instead of returning 0 when a count is missing', async () => {
    mockRoutes({ [API.receiptStats]: { body: { success: true } } });
    await expect(api.getReceiptStats(token)).rejects.toThrow();
  });

  it('asks for the single oldest pending receipt', async () => {
    const url = `${API.receipts}?statuses=pending&order=oldest&page=1&page_size=1`;
    mockRoutes({ [url]: { body: { receipts: [{ submitted_at: '2026-10-01T00:00:00Z' }] } } });
    expect(await api.getOldestPendingAt(token)).toBe('2026-10-01T00:00:00Z');
  });

  it('asks the overview for the last 30 days', async () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    const from = new Date(now - 30 * DAY).toISOString().slice(0, 10);
    const seen = mockRoutes({
      [`${API.auditLogs}?source=overview&from=${from}`]: { body: { fraud: { available: false } } },
    });
    await api.getOversight(token, now);
    expect(seen[0]).toContain('source=overview&from=2026-09-08');
  });

  it('treats an overview with no sections as a failure, so it shows as one line', async () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    const from = new Date(now - 30 * DAY).toISOString().slice(0, 10);
    mockRoutes({ [`${API.auditLogs}?source=overview&from=${from}`]: { body: { success: false } } });
    await expect(api.getOversight(token, now)).rejects.toThrow();
  });

  it('counts overdue promotions from either response shape', async () => {
    const url = `${API.promotions}?page=1&page_size=100`;
    mockRoutes({ [url]: { body: { data: { items: [{ status: 'Activation overdue' }, { status: 'active' }] } } } });
    expect(await api.getPromotionsOverdue(token)).toBe(1);
  });

  it('reports a trial only while one is running', async () => {
    mockRoutes({ [API.billing]: { body: { is_trial: false, trial_days_left: 5 } } });
    expect(await api.getTrialDaysLeft(token)).toBeNull();
  });

  it('reads base_rate from the wrapped or bare config, and ignores 0', async () => {
    const url = `${API.coalitionConfig}?coalition_id=c1`;
    mockRoutes({ [url]: { body: { success: true, data: { base_rate: 100 } } } });
    expect(await api.getBaseRate(token, 'c1')).toBe(100);
    mockRoutes({ [url]: { body: { base_rate: 0 } } });
    expect(await api.getBaseRate(token, 'c1')).toBeNull();
  });
});
