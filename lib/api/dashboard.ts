// lib/api/dashboard.ts
// Every read the Dashboard tab makes. Each mirrors one call the portal's
// dashboard makes through its own server (apps/coalition-portal, traced
// 2026-10-08), so the phone and the web show the same numbers.
//
// Every function either returns a real value or THROWS. None turns a failure
// into 0: the screen maps a throw to "couldn't load", and a zero that means
// "unknown" is how a dashboard says "all clear" during an outage.

import { API } from '../../constants/api';
import { toCoverage, type Coverage } from '../dashboard/coverage';
import { oversightCounts, type OversightCounts, type OversightOverview } from '../dashboard/oversight';
import type { ActivityRow } from '../dashboard/activity';
import type { BurnPoint } from '../dashboard/runway';
import { apiFetch } from './client';

type Token = () => Promise<string | null>;

/** Some upstream routes wrap their body in {success, data}; most do not. */
function unwrap<T>(body: unknown): T {
  const b = body as { data?: unknown };
  return (b && typeof b === 'object' && b.data && typeof b.data === 'object' ? b.data : body) as T;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── Today, the earn series and recent activity: one call ─────────────────────

export interface TodayFigures {
  pointsIssued: number;
  pointsRedeemed: number;
  membersActive: number;
  gmv: number;
}

export interface Analytics {
  /** null when the server could not compute today (it says so with null). */
  today: TodayFigures | null;
  earnSeries: BurnPoint[];
  recentActivity: ActivityRow[];
}

/**
 * GET /analytics?period=30d. 30 days is the portal dashboard's default range,
 * and the runway averages the same window the web's does.
 */
export async function getAnalytics(getAccessToken: Token): Promise<Analytics> {
  const body = await apiFetch<{
    today?: Partial<TodayFigures> | null;
    earnSeries?: BurnPoint[];
    recentActivity?: ActivityRow[];
  }>(`${API.analytics}?period=30d`, { getAccessToken });

  const t = body.today;
  return {
    today:
      t && typeof t === 'object'
        ? {
            pointsIssued: num(t.pointsIssued) ?? 0,
            pointsRedeemed: num(t.pointsRedeemed) ?? 0,
            membersActive: num(t.membersActive) ?? 0,
            gmv: num(t.gmv) ?? 0,
          }
        : null,
    earnSeries: Array.isArray(body.earnSeries) ? body.earnSeries : [],
    recentActivity: Array.isArray(body.recentActivity) ? body.recentActivity : [],
  };
}

/** Members who registered today and yesterday. */
export async function getNewMembers(getAccessToken: Token): Promise<{ today: number; yesterday: number }> {
  const b = unwrap<{ today?: unknown; yesterday?: unknown }>(await apiFetch(API.newMembers, { getAccessToken }));
  const today = num(b.today);
  if (today === null) throw new Error('new-members: no figure');
  return { today, yesterday: num(b.yesterday) ?? 0 };
}

// ── Reward pool ──────────────────────────────────────────────────────────────

export async function getCoverage(getAccessToken: Token): Promise<Coverage> {
  return toCoverage(await apiFetch(API.coverage, { getAccessToken }));
}

/**
 * Points per currency unit (100 = a cent a point), or null when unset. Null is
 * not an error: the runway then says the points cannot be priced.
 */
export async function getBaseRate(getAccessToken: Token, coalitionId: string): Promise<number | null> {
  const b = unwrap<{ base_rate?: unknown }>(
    await apiFetch(`${API.coalitionConfig}?coalition_id=${encodeURIComponent(coalitionId)}`, { getAccessToken }),
  );
  const r = num(b.base_rate);
  return r !== null && r > 0 ? r : null;
}

// ── Needs attention sources ──────────────────────────────────────────────────

/**
 * Pending and flagged counts from a real COUNT(*), not a page of rows.
 * NB: verification-api answers success with zeros on its own internal error,
 * the same as the portal sees -- that is a server-side fix.
 */
export async function getReceiptStats(getAccessToken: Token): Promise<{ pending: number; flagged: number }> {
  const b = await apiFetch<{ pending_count?: unknown; flagged_count?: unknown }>(API.receiptStats, { getAccessToken });
  const pending = num(b.pending_count);
  const flagged = num(b.flagged_count);
  if (pending === null || flagged === null) throw new Error('receipts/stats: no counts');
  return { pending, flagged };
}

/**
 * Submission time of the OLDEST pending receipt, or null when none is pending.
 *
 * The portal takes the oldest of the first 20 receipts of any status, which
 * can understate the age. Asking the server for one pending row, oldest first,
 * gives the real oldest -- the same list call Approvals already makes.
 */
export async function getOldestPendingAt(getAccessToken: Token): Promise<string | null> {
  const b = await apiFetch<{ receipts?: { submitted_at?: string | null; created_at?: string | null }[] }>(
    `${API.receipts}?statuses=pending&order=oldest&page=1&page_size=1`,
    { getAccessToken },
  );
  const first = b.receipts?.[0];
  return first ? first.submitted_at ?? first.created_at ?? null : null;
}

/** The oversight facts for the last 30 days, as the portal's dashboard asks. */
export async function getOversight(getAccessToken: Token, now = Date.now()): Promise<OversightCounts> {
  const from = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);
  const body = await apiFetch(`${API.auditLogs}?source=overview&from=${from}`, { getAccessToken });
  const overview = unwrap<Partial<OversightOverview>>(body);
  // A body with none of the sections is not an overview (e.g. {success:false}).
  // Throwing makes it ONE "couldn't check" line, not ten.
  const sections = ['money', 'fraud', 'approvals', 'redemptions', 'disputes', 'security', 'system'] as const;
  if (!overview || !sections.some((k) => typeof overview[k] === 'object' && overview[k] !== null)) {
    throw new Error('audit overview: no sections');
  }
  return oversightCounts(overview);
}

export async function getAwaitingOnboarding(getAccessToken: Token): Promise<number> {
  const b = unwrap<{ awaiting_onboarding?: unknown }>(await apiFetch(API.participantSummary, { getAccessToken }));
  const n = num(b.awaiting_onboarding);
  if (n === null) throw new Error('participants/summary: no count');
  return n;
}

/** Settlements waiting to be paid (status pending), from the server's max page of 200, as the portal counts. */
export async function getSettlementsDue(getAccessToken: Token): Promise<number> {
  const b = unwrap<{ settlements?: { status?: string }[] }>(
    await apiFetch(`${API.settlements}?page_size=200`, { getAccessToken }),
  );
  if (!Array.isArray(b.settlements)) throw new Error('settlements: no list');
  return b.settlements.filter((s) => s.status === 'pending').length;
}

/** Redemptions that failed: a member charged points and given nothing. */
export async function getFailedRedemptions(getAccessToken: Token): Promise<number> {
  const b = unwrap<{ redemptions?: { status?: string }[] }>(
    await apiFetch(`${API.redemptions}?type=QR_CODE`, { getAccessToken }),
  );
  if (!Array.isArray(b.redemptions)) throw new Error('redemptions: no list');
  return b.redemptions.filter((r) => (r.status ?? '').toLowerCase() === 'failed').length;
}

/** Promotions past their start date that never went live. */
export async function getPromotionsOverdue(getAccessToken: Token): Promise<number> {
  const body = await apiFetch<{ items?: unknown; data?: { items?: unknown } }>(
    `${API.promotions}?page=1&page_size=100`,
    { getAccessToken },
  );
  const items = (body.data?.items ?? body.items) as { status?: string }[] | undefined;
  if (!Array.isArray(items)) throw new Error('promotions: no list');
  return items.filter((p) => (p.status ?? '').toLowerCase() === 'activation overdue').length;
}

/** Days left on a trial, or null when not on one. */
export async function getTrialDaysLeft(getAccessToken: Token): Promise<number | null> {
  const b = unwrap<{ is_trial?: unknown; trial_days_left?: unknown }>(await apiFetch(API.billing, { getAccessToken }));
  const days = num(b.trial_days_left);
  return b.is_trial === true && days !== null && days > 0 ? days : null;
}
