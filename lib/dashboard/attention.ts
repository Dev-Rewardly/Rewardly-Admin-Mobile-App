// lib/dashboard/attention.ts
// The "Needs attention" rules, ported from the portal's
// lib/dashboard/attention.ts so the phone and the web agree on what needs
// attention and when the strip may say "all clear".
//
// A number cannot say "I could not find out", and that is how the portal once
// showed "All clear" over 56 items of work: zero was the loading value AND the
// failure value. `Measured<T>` makes the third case impossible to forget.

export type Measured<T> =
  | { state: 'ok'; value: T }
  | { state: 'loading' }
  | { state: 'unavailable' };

export const measured = <T,>(value: T): Measured<T> => ({ state: 'ok', value });
export const loadingM = <T,>(): Measured<T> => ({ state: 'loading' });
export const unavailable = <T,>(): Measured<T> => ({ state: 'unavailable' });

/** A boolean fact (e.g. coverage below healthy) as a count of 1 or 0, keeping its state. */
export function asCount(m: Measured<boolean>): Measured<number> {
  return m.state === 'ok' ? measured(m.value ? 1 : 0) : m;
}

export type AttentionTone = 'error' | 'warning' | 'neutral';

export interface AttentionSource {
  /** Also the i18n key suffix: dashboard.attention.<id>. */
  id: string;
  count: Measured<number>;
  /** Age of the oldest item, for the approvals queue. */
  oldestDays?: Measured<number | null>;
  tone: AttentionTone;
}

export type StripState =
  | { kind: 'loading' }
  | { kind: 'items'; items: AttentionSource[]; unreachable: AttentionSource[] }
  | { kind: 'all-clear' }
  | { kind: 'unavailable'; unreachable: AttentionSource[] };

/**
 * All-clear requires EVERY source to have reported, and every one to be zero.
 * Known work outranks everything; one unreachable source withholds all-clear.
 */
export function stripState(sources: AttentionSource[]): StripState {
  const unreachable = sources.filter((s) => s.count.state === 'unavailable');
  const stillLoading = sources.filter((s) => s.count.state === 'loading');
  const withWork = sources.filter((s) => s.count.state === 'ok' && s.count.value > 0);
  if (withWork.length > 0) return { kind: 'items', items: withWork, unreachable };
  if (stillLoading.length > 0) return { kind: 'loading' };
  if (unreachable.length > 0) return { kind: 'unavailable', unreachable };
  return { kind: 'all-clear' };
}

/** Same thresholds as the portal: amber from 3 days, red from 7. */
export const APPROVALS_AMBER_DAYS = 3;
export const APPROVALS_RED_DAYS = 7;

export function queueTone(oldest: Measured<number | null> | undefined): AttentionTone {
  if (!oldest || oldest.state !== 'ok' || oldest.value === null) return 'neutral';
  if (oldest.value >= APPROVALS_RED_DAYS) return 'error';
  if (oldest.value >= APPROVALS_AMBER_DAYS) return 'warning';
  return 'neutral';
}

/** Whole days since the oldest timestamp, or null when none parse. */
export function oldestDays(isoStamps: readonly (string | null | undefined)[], now = Date.now()): number | null {
  const times = isoStamps
    .map((s) => (s ? Date.parse(s) : NaN))
    .filter((t) => Number.isFinite(t) && t > 0);
  if (times.length === 0) return null;
  return Math.floor((now - Math.min(...times)) / 86_400_000);
}
