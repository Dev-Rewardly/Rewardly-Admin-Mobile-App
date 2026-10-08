// context/CoalitionContext.tsx
// The signed-in admin's coalition, loaded ONCE for every tab rather than per
// screen. null until it arrives, and null if it cannot be read: every consumer
// must look right without it (the header falls back to the Admin marker,
// amounts to the bare number).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { getCoalition, type Coalition } from '@/lib/api/coalition';

interface CoalitionContextValue {
  coalition: Coalition | null;
  /**
   * Try again if the first load failed. A no-op once the coalition is known,
   * so it is safe to call on every pull-to-refresh.
   */
  retry: () => void;
}

const CoalitionContext = createContext<CoalitionContextValue>({ coalition: null, retry: () => {} });

export function CoalitionProvider({ children }: { children: React.ReactNode }) {
  const { claims, getAccessToken } = useAuth();
  const coalitionId = claims?.coalitionId ?? null;
  const [coalition, setCoalition] = useState<Coalition | null>(null);
  // Bumped by retry(); a failed load would otherwise last the whole session,
  // because nothing else changes to trigger another.
  const [attempt, setAttempt] = useState(0);

  // A different admin is a different coalition: forget the old one at once.
  useEffect(() => {
    setCoalition(null);
  }, [coalitionId]);

  useEffect(() => {
    if (!coalitionId) return;
    let cancelled = false;
    getCoalition(getAccessToken, coalitionId)
      .then((c) => {
        if (!cancelled) setCoalition(c);
      })
      .catch(() => {
        // Not shown as an error: nothing the admin does depends on the name.
      });
    return () => {
      cancelled = true;
    };
  }, [coalitionId, getAccessToken, attempt]);

  const loaded = coalition !== null;
  const retry = useCallback(() => {
    if (!loaded) setAttempt((n) => n + 1);
  }, [loaded]);

  const value = useMemo(() => ({ coalition, retry }), [coalition, retry]);
  return <CoalitionContext.Provider value={value}>{children}</CoalitionContext.Provider>;
}

export function useCoalition(): Coalition | null {
  return useContext(CoalitionContext).coalition;
}

export function useRetryCoalition(): () => void {
  return useContext(CoalitionContext).retry;
}
