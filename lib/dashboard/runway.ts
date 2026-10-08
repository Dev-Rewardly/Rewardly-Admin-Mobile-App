// lib/dashboard/runway.ts
// How long the reward pool lasts, ported from the portal's
// lib/dashboard/runway.ts (same rule, same tests' cases).
//
// Burn is MONEY per day, averaged over the series, so a quiet morning does not
// make it zero. Points become money from the ledger's own costUsd first, and
// only otherwise from base_rate (points PER currency unit: cost = points/rate).
// When nothing can price the points the basis is 'unvalued' and no number is
// shown -- never money divided by points.

export type BurnBasis = 'series' | 'today' | 'unvalued' | 'none';

export interface BurnPoint {
  date: string;
  pointsIssued?: number | null;
  costUsd?: number | null;
}

export interface RunwayEstimate {
  dailyBurn: number | null;
  days: number | null;
  basis: BurnBasis;
  daysMeasured: number;
}

const rateOf = (rate: number | null | undefined): number | null =>
  typeof rate === 'number' && rate > 0 ? rate : null;

function costOf(point: BurnPoint, rate: number | null): number | null {
  if (typeof point.costUsd === 'number') return point.costUsd;
  const points = point.pointsIssued ?? 0;
  if (points === 0) return 0;
  return rate === null ? null : points / rate;
}

const hadIssuance = (p: BurnPoint) => (p.pointsIssued ?? 0) > 0 || (p.costUsd ?? 0) > 0;

export function estimateBurn(
  series: readonly BurnPoint[] | null | undefined,
  pointsIssuedToday: number | null | undefined,
  pointsRate?: number | null,
): { dailyBurn: number | null; basis: BurnBasis; daysMeasured: number } {
  const rate = rateOf(pointsRate);
  const days = (series ?? [])
    .filter((p) => p && typeof p.date === 'string')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  // Trailing days with no issuance have not happened yet; averaging them in
  // would make the runway look longer than it is.
  let end = days.length;
  while (end > 0 && !hadIssuance(days[end - 1])) end -= 1;
  const window = days.slice(0, end);

  if (window.length > 0) {
    let total = 0;
    for (const p of window) {
      const cost = costOf(p, rate);
      if (cost === null) return { dailyBurn: null, basis: 'unvalued', daysMeasured: window.length };
      total += cost;
    }
    const mean = total / window.length;
    if (mean > 0) return { dailyBurn: mean, basis: 'series', daysMeasured: window.length };
  }

  if ((pointsIssuedToday ?? 0) > 0) {
    const cost = costOf({ date: 'today', pointsIssued: pointsIssuedToday }, rate);
    if (cost === null || cost <= 0) return { dailyBurn: null, basis: 'unvalued', daysMeasured: 1 };
    return { dailyBurn: cost, basis: 'today', daysMeasured: 1 };
  }
  return { dailyBurn: null, basis: 'none', daysMeasured: 0 };
}

/** @param poolBalance the pool shown on the card (coverage), in currency. */
export function estimateRunway(
  poolBalance: number | null | undefined,
  series: readonly BurnPoint[] | null | undefined,
  pointsIssuedToday: number | null | undefined,
  pointsRate?: number | null,
): RunwayEstimate {
  const { dailyBurn, basis, daysMeasured } = estimateBurn(series, pointsIssuedToday, pointsRate);
  if (poolBalance == null || dailyBurn == null || dailyBurn <= 0) {
    return { dailyBurn, days: null, basis, daysMeasured };
  }
  return { dailyBurn, days: Math.floor(poolBalance / dailyBurn), basis, daysMeasured };
}

/**
 * What the card shows, as an i18n key plus params. Never "~0d": a real zero is
 * "under a day", and past a year the exact figure is not actionable.
 */
export function runwayLabel(days: number | null): { key: string; days?: number } {
  if (days === null) return { key: 'dashboard.runway.unknown' };
  if (days <= 0) return { key: 'dashboard.runway.under_a_day' };
  if (days > 365) return { key: 'dashboard.runway.over_a_year' };
  return { key: 'dashboard.runway.days', days };
}

/** Why the card shows what it shows -- the basis, as an i18n key plus params. */
export function runwayNote(e: RunwayEstimate): { key: string; count?: number } {
  if (e.days === null) {
    if (e.basis === 'none') return { key: 'dashboard.runway.note_none' };
    if (e.basis === 'unvalued') return { key: 'dashboard.runway.note_unvalued' };
    return { key: 'dashboard.runway.note_missing' };
  }
  if (e.basis === 'today') return { key: 'dashboard.runway.note_today' };
  return { key: 'dashboard.runway.note_series', count: e.daysMeasured };
}
