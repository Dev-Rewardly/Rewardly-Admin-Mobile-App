// hooks/useDashboard.ts
// Loads every Dashboard source in parallel. Each lands in its own Measured
// slot, so one failure marks only its own box -- the rest still show -- and a
// slot never holds 0 while loading or after a failure.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api/dashboard';
import { loadingM, measured, unavailable, type Measured } from '@/lib/dashboard/attention';
import type { Coverage } from '@/lib/dashboard/coverage';
import type { OversightCounts } from '@/lib/dashboard/oversight';

export interface DashboardData {
  analytics: Measured<api.Analytics>;
  newMembers: Measured<{ today: number; yesterday: number }>;
  coverage: Measured<Coverage>;
  baseRate: Measured<number | null>;
  receiptStats: Measured<{ pending: number; flagged: number }>;
  oldestPendingAt: Measured<string | null>;
  oversight: Measured<OversightCounts>;
  awaitingOnboarding: Measured<number>;
  settlementsDue: Measured<number>;
  failedRedemptions: Measured<number>;
  promotionsOverdue: Measured<number>;
  trialDaysLeft: Measured<number | null>;
  /** When the figures were read; null until the first load settles. */
  asOf: Date | null;
}

const initial = (): DashboardData => ({
  analytics: loadingM(),
  newMembers: loadingM(),
  coverage: loadingM(),
  baseRate: loadingM(),
  receiptStats: loadingM(),
  oldestPendingAt: loadingM(),
  oversight: loadingM(),
  awaitingOnboarding: loadingM(),
  settlementsDue: loadingM(),
  failedRedemptions: loadingM(),
  promotionsOverdue: loadingM(),
  trialDaysLeft: loadingM(),
  asOf: null,
});

type Slot = Exclude<keyof DashboardData, 'asOf'>;

export function useDashboard() {
  const { claims, getAccessToken } = useAuth();
  const coalitionId = claims?.coalitionId ?? null;
  const [data, setData] = useState<DashboardData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  // A newer load supersedes an older one still in flight.
  const generation = useRef(0);

  const load = useCallback(
    async (mode: 'first' | 'refresh') => {
      const gen = ++generation.current;
      // A refresh keeps the figures on screen while it reads; only the first
      // load shows placeholders.
      if (mode === 'first') setData(initial());

      const put = <K extends Slot>(key: K, value: DashboardData[K]) => {
        if (gen === generation.current) setData((d) => ({ ...d, [key]: value }));
      };
      const run = <K extends Slot>(key: K, p: Promise<DashboardData[K] extends Measured<infer T> ? T : never>) =>
        p.then(
          (v) => put(key, measured(v) as DashboardData[K]),
          () => put(key, unavailable() as DashboardData[K]),
        );

      await Promise.all([
        run('analytics', api.getAnalytics(getAccessToken)),
        run('newMembers', api.getNewMembers(getAccessToken)),
        run('coverage', api.getCoverage(getAccessToken)),
        coalitionId
          ? run('baseRate', api.getBaseRate(getAccessToken, coalitionId))
          : Promise.resolve(put('baseRate', measured(null))),
        run('receiptStats', api.getReceiptStats(getAccessToken)),
        run('oldestPendingAt', api.getOldestPendingAt(getAccessToken)),
        run('oversight', api.getOversight(getAccessToken)),
        run('awaitingOnboarding', api.getAwaitingOnboarding(getAccessToken)),
        run('settlementsDue', api.getSettlementsDue(getAccessToken)),
        run('failedRedemptions', api.getFailedRedemptions(getAccessToken)),
        run('promotionsOverdue', api.getPromotionsOverdue(getAccessToken)),
        run('trialDaysLeft', api.getTrialDaysLeft(getAccessToken)),
      ]);
      if (gen === generation.current) setData((d) => ({ ...d, asOf: new Date() }));
    },
    [coalitionId, getAccessToken],
  );

  useEffect(() => {
    void load('first');
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load('refresh');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return { data, refreshing, refresh };
}
