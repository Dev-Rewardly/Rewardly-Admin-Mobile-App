import { LOCK_AFTER_BACKGROUND_MS, REFRESH_SKEW_MS, needsRefresh, shouldLock } from '@/lib/auth/lock-policy';

describe('shouldLock', () => {
  it('does not lock when the app was never backgrounded', () => {
    expect(shouldLock(null, 1_000_000)).toBe(false);
  });
  it('does not lock on a brief background', () => {
    expect(shouldLock(1_000, 1_000 + LOCK_AFTER_BACKGROUND_MS - 1)).toBe(false);
  });
  it('locks once the threshold is reached', () => {
    expect(shouldLock(1_000, 1_000 + LOCK_AFTER_BACKGROUND_MS)).toBe(true);
  });
});

describe('needsRefresh', () => {
  it('is false with plenty of time left', () => {
    expect(needsRefresh(1_000_000, 1_000_000 - REFRESH_SKEW_MS - 1)).toBe(false);
  });
  it('is true inside the skew window and after expiry', () => {
    expect(needsRefresh(1_000_000, 1_000_000 - REFRESH_SKEW_MS)).toBe(true);
    expect(needsRefresh(1_000_000, 2_000_000)).toBe(true);
  });
});
