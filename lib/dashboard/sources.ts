// lib/dashboard/sources.ts
// Builds the "Needs attention" list from what the dashboard loaded, in the
// portal's order and tones (components/coalition/Dashboard.tsx
// attentionSources, 2026-10-08). Pure, so the rules are tested.
//
// Left out on purpose, both deliberate:
//   - "treasury below threshold": the portal computes it from bundled demo
//     data (lib/data isLowTreasury), not from anything live.
//   - "failed payouts": settlements are never given status 'failed' by the
//     backend, so it can only ever read 0.
//   - "verification action required": needs the portal's setup-status
//     source, which this app does not read yet.

import {
  asCount,
  measured,
  oldestDays,
  queueTone,
  unavailable,
  type AttentionSource,
  type Measured,
} from './attention';
import type { Coverage } from './coverage';
import type { OversightCounts } from './oversight';

export interface AttentionInputs {
  receiptStats: Measured<{ pending: number; flagged: number }>;
  oldestPendingAt: Measured<string | null>;
  oversight: Measured<OversightCounts>;
  coverage: Measured<Coverage>;
  awaitingOnboarding: Measured<number>;
  settlementsDue: Measured<number>;
  failedRedemptions: Measured<number>;
  promotionsOverdue: Measured<number>;
  trialDaysLeft: Measured<number | null>;
}

const map = <T, R>(m: Measured<T>, f: (v: T) => R): Measured<R> => (m.state === 'ok' ? measured(f(m.value)) : m);

/** A trial ending is work only while it is close: from 7 days out. */
export const TRIAL_ALERT_DAYS = 7;

export function attentionSources(d: AttentionInputs, now = Date.now()): AttentionSource[] {
  const fromOversight = (pick: (c: OversightCounts) => number | null): Measured<number> => {
    if (d.oversight.state !== 'ok') return d.oversight;
    const v = pick(d.oversight.value);
    return v === null ? unavailable<number>() : measured(v);
  };

  const pastDue = fromOversight((c) => c.settlementsPastDue);
  const anyPastDue = pastDue.state === 'ok' && pastDue.value > 0;

  const oldest = map(d.oldestPendingAt, (at) => (at ? oldestDays([at], now) : null));

  // One line when the overview cannot be read -- not ten "couldn't check"s.
  const oversight: AttentionSource[] =
    d.oversight.state === 'unavailable'
      ? [{ id: 'oversight', count: unavailable<number>(), tone: 'neutral' }]
      : [
          { id: 'claim_errors', count: fromOversight((c) => c.claimErrors), tone: 'error' },
          { id: 'fraud_overrides', count: fromOversight((c) => c.criticalOverrides), tone: 'error' },
          { id: 'approvals_late', count: fromOversight((c) => c.approvalsPastDeadline), tone: 'warning' },
          { id: 'flagged_approved', count: fromOversight((c) => c.flaggedApproved), tone: 'warning' },
          { id: 'duplicates', count: fromOversight((c) => c.duplicateReceipts), tone: 'warning' },
          { id: 'lapsed_codes', count: fromOversight((c) => c.lapsedRedemptionCodes), tone: 'warning' },
          { id: 'disputes', count: fromOversight((c) => c.openDisputes), tone: 'warning' },
          { id: 'mfa', count: fromOversight((c) => c.teamWithoutMfa), tone: 'warning' },
          { id: 'failed_signins', count: fromOversight((c) => c.failedSignins), tone: 'neutral' },
          { id: 'api_keys', count: fromOversight((c) => c.apiKeysExpiring), tone: 'neutral' },
        ];

  return [
    anyPastDue
      ? { id: 'settlements_past_due', count: pastDue, tone: 'error' }
      : { id: 'settlements_due', count: d.settlementsDue, tone: 'neutral' },
    {
      id: 'approvals',
      count: map(d.receiptStats, (s) => s.pending),
      oldestDays: oldest,
      // Age decides the tone: 21 days is not the same situation as 2 hours.
      tone: queueTone(oldest),
    },
    { id: 'failed_redemptions', count: d.failedRedemptions, tone: 'error' },
    { id: 'coverage', count: asCount(map(d.coverage, (c) => c.band !== 'healthy')), tone: 'warning' },
    { id: 'flagged', count: map(d.receiptStats, (s) => s.flagged), tone: 'warning' },
    ...oversight,
    { id: 'participants', count: d.awaitingOnboarding, tone: 'neutral' },
    { id: 'promotions', count: d.promotionsOverdue, tone: 'neutral' },
    {
      id: 'trial',
      count: map(d.trialDaysLeft, (days) => (days !== null && days <= TRIAL_ALERT_DAYS ? days : 0)),
      tone: 'neutral',
    },
  ];
}
