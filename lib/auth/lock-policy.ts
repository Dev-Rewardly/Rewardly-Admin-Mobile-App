// lib/auth/lock-policy.ts
// When does a backgrounded app ask for biometrics / device PIN again, and when
// is the access token refreshed? Pure, so the rules are testable off-device.

/** Re-lock after this long in the background. Admin data is sensitive. */
export const LOCK_AFTER_BACKGROUND_MS = 60_000;

export function shouldLock(backgroundedAt: number | null, now: number): boolean {
  if (backgroundedAt === null) return false;
  return now - backgroundedAt >= LOCK_AFTER_BACKGROUND_MS;
}

/** Refresh when this many ms or fewer remain on the access token. */
export const REFRESH_SKEW_MS = 30_000;

export function needsRefresh(expiresAt: number, now: number): boolean {
  return expiresAt - now <= REFRESH_SKEW_MS;
}
