// lib/dashboard/oversight.ts
// The oversight counts the "Needs attention" list carries, ported from the
// portal's lib/audit/oversight.ts `oversightCounts`. A section the server
// could not read is null -- the list says "couldn't check", never 0.

type Section<T> = ({ available: true } & T) | { available: false };

export interface OversightOverview {
  money: Section<{ overdue: { count: number } }>;
  fraud: Section<{ overrides: number; flagged_approved: number; duplicate_receipts: number }>;
  approvals: Section<{ waiting: { overdue: number } }>;
  redemptions: Section<{ stuck: { count: number } }>;
  disputes: Section<{
    settlement: { status: string; count: number }[];
    member: { status: string; count: number }[];
  }>;
  security: Section<{
    team: { without_mfa: number };
    api_keys: { expiring: number };
    signins: null | { failed: number };
  }>;
  system: Section<{ spine: { severity: string; count: number }[] }>;
}

export interface OversightCounts {
  settlementsPastDue: number | null;
  criticalOverrides: number | null;
  flaggedApproved: number | null;
  duplicateReceipts: number | null;
  approvalsPastDeadline: number | null;
  lapsedRedemptionCodes: number | null;
  openDisputes: number | null;
  teamWithoutMfa: number | null;
  failedSignins: number | null;
  apiKeysExpiring: number | null;
  claimErrors: number | null;
}

const avail = <T,>(s: Section<T> | undefined): s is { available: true } & T =>
  !!s && (s as { available?: boolean }).available === true;

export function oversightCounts(o: Partial<OversightOverview>): OversightCounts {
  return {
    settlementsPastDue: avail(o.money) ? o.money.overdue.count : null,
    criticalOverrides: avail(o.fraud) ? o.fraud.overrides : null,
    flaggedApproved: avail(o.fraud) ? o.fraud.flagged_approved : null,
    duplicateReceipts: avail(o.fraud) ? o.fraud.duplicate_receipts : null,
    approvalsPastDeadline: avail(o.approvals) ? o.approvals.waiting.overdue : null,
    lapsedRedemptionCodes: avail(o.redemptions) ? o.redemptions.stuck.count : null,
    openDisputes: avail(o.disputes)
      ? [...o.disputes.settlement, ...o.disputes.member]
          .filter((d) => d.status === 'OPEN')
          .reduce((a, d) => a + d.count, 0)
      : null,
    teamWithoutMfa: avail(o.security) ? o.security.team.without_mfa : null,
    failedSignins: avail(o.security) && o.security.signins ? o.security.signins.failed : null,
    apiKeysExpiring: avail(o.security) ? o.security.api_keys.expiring : null,
    claimErrors: avail(o.system)
      ? o.system.spine.filter((e) => e.severity === 'E').reduce((a, e) => a + e.count, 0)
      : null,
  };
}
