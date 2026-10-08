// lib/dashboard/activity.ts
// Recent activity rows, from /analytics `recentActivity` -- the same rows the
// portal's live ticker reads (lib/dashboard/series.ts toTickerEvents).

export interface ActivityRow {
  kind: 'earn' | 'redeem';
  id: string;
  at: string | null;
  participant: string;
  zone?: string | null;
  points: number;
}

/**
 * The rows worth showing, newest first as the server sent them. Zero-point
 * rows are dropped for the portal's reason: six "+0 pts" rows led its feed and
 * said nothing -- a zero-point event is an Approvals item, not activity.
 */
export function visibleActivity(rows: readonly ActivityRow[] | undefined, limit: number): ActivityRow[] {
  return (rows ?? []).filter((r) => r.participant && r.points > 0).slice(0, limit);
}

/** "3m ago" etc. as an i18n key plus count; null when the timestamp is unusable. */
export function relativeAge(iso: string | null, now = Date.now()): { key: string; count?: number } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.floor((now - t) / 60_000));
  if (mins < 1) return { key: 'dashboard.ago.now' };
  if (mins < 60) return { key: 'dashboard.ago.minutes', count: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { key: 'dashboard.ago.hours', count: hours };
  return { key: 'dashboard.ago.days', count: Math.floor(hours / 24) };
}
