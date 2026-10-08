// lib/dashboard/coverage.ts
// Reward pool coverage and its band, ported from the portal's
// lib/settlements/coverage.ts. The band ladder must stay identical to the
// web's, or the phone says "Healthy" where the portal says "Watch".

export type CoverageBand = 'healthy' | 'watch' | 'restricted' | 'earn_paused' | 'backstop';

export interface Coverage {
  pointsOutstanding: number;
  /** In the coalition's currency. */
  liability: number;
  poolBalance: number;
  /** pool ÷ liability; null when nothing is owed (not Infinity, not 0). */
  ratio: number | null;
  band: CoverageBand;
  lastReconciledAt: string | null;
}

/** Sorted by `min` descending; bandFor takes the first match. */
const LADDER: { band: CoverageBand; min: number }[] = [
  { band: 'healthy', min: 1.5 },
  { band: 'watch', min: 1.2 },
  { band: 'restricted', min: 1.0 },
  { band: 'earn_paused', min: 0 },
];

export function bandFor(ratio: number | null, poolBalance: number): CoverageBand {
  if (poolBalance <= 0) return 'backstop';
  // Nothing owed yet is healthy by default, not "paused".
  if (ratio === null) return 'healthy';
  return LADDER.find((b) => ratio >= b.min)?.band ?? 'earn_paused';
}

/** The /settings/coverage body, bare or wrapped in {success, data}. */
export function toCoverage(body: unknown): Coverage {
  const b = body as Record<string, unknown> & { data?: Record<string, unknown> };
  const d = (b && typeof b === 'object' && b.data && typeof b.data === 'object' ? b.data : b) ?? {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const liability = num(d.liability);
  const poolBalance = num(d.pool_balance);
  const ratio = liability > 0 ? poolBalance / liability : null;
  return {
    pointsOutstanding: num(d.points_outstanding),
    liability,
    poolBalance,
    ratio,
    band: bandFor(ratio, poolBalance),
    lastReconciledAt: typeof d.last_reconciled_at === 'string' ? d.last_reconciled_at : null,
  };
}
