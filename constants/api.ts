// constants/api.ts
// Where this app talks to. Public values only — same rule as keycloak.ts.
//
// WHY THERE IS NO BFF HERE
//
// The Coalition web portal reaches these same endpoints through its own Next.js
// routes, because a server can hold things a phone cannot. This app does NOT
// copy that: it calls the gateway directly with the SIGNED-IN ADMIN'S OWN
// access token, which is the only credential a mobile binary may carry.
//
// That works because the receipt endpoints authorise the caller's own token —
// verified against the live gateway, 2026-10-07. Any endpoint that needs more
// than the user's token does not belong in this app until it accepts one.

export const API_HOST =
  process.env.EXPO_PUBLIC_API_HOST ?? 'https://q9s6c58rh6.execute-api.us-east-1.amazonaws.com';

/**
 * Routes confirmed present on the shared Enterprise Gateway (q9s6c58rh6) on
 * 2026-10-07 by enumerating it, not by reading a document:
 *
 *   GET  /api/v1/receipts
 *   GET  /api/v1/receipts/{receiptId}
 *   POST /api/v1/receipts/{receiptId}/review
 *   GET  /api/v1/receipts/{receiptId}/image-url
 *
 * A path the Lambda serves but the gateway does not know 404s at the edge,
 * identically to one that does not exist — so these are listed from the
 * gateway's own answer rather than from the service's router.
 */
export const API = {
  receipts: `${API_HOST}/api/v1/receipts`,
  receipt: (id: string) => `${API_HOST}/api/v1/receipts/${id}`,
  receiptReview: (id: string) => `${API_HOST}/api/v1/receipts/${id}/review`,
  receiptImageUrl: (id: string) => `${API_HOST}/api/v1/receipts/${id}/image-url`,
  /**
   * The coalition's name, region and currency -- what the portal's own
   * /api/coalition reads (2026-10-08). Answers WITHOUT any credential today;
   * the token is sent anyway so this keeps working if that is locked down.
   */
  coalitionInfo: (coalitionId: string) =>
    `${API_HOST}/api/v1/onboarding/coalition-info/${encodeURIComponent(coalitionId)}`,
  /** Authenticated; holds the registered name before a coalition is verified. */
  settingsCoalition: `${API_HOST}/api/v1/settings/coalition`,

  /*
   * Dashboard. The same upstream routes the portal's dashboard reads through
   * its own server (traced 2026-10-08). Each answers the admin's own token and
   * takes the coalition from it; none needs a key the app could not keep.
   */
  /** today · earnSeries · recentActivity. period = 7d | 30d | 90d | 1y. */
  analytics: `${API_HOST}/api/v1/analytics`,
  newMembers: `${API_HOST}/api/v1/analytics/new-members`,
  /** Reward pool: pool_balance, liability, points_outstanding. */
  coverage: `${API_HOST}/api/v1/settings/coverage`,
  /** base_rate: points per currency unit, for pricing points in the runway. */
  coalitionConfig: `${API_HOST}/api/v1/coalition/config`,
  /** source=overview: the oversight counts (fraud, security, disputes…). */
  auditLogs: `${API_HOST}/api/v1/settings/audit-logs`,
  receiptStats: `${API_HOST}/api/v1/receipts/stats`,
  participantSummary: `${API_HOST}/api/v1/participants/summary`,
  settlements: `${API_HOST}/api/v1/settlements`,
  redemptions: `${API_HOST}/api/v1/redemptions`,
  promotions: `${API_HOST}/api/v1/promotions`,
  billing: `${API_HOST}/api/v1/settings/billing`,
};

/** A request that has not answered in this long has failed, not "still going". */
export const API_TIMEOUT_MS = 15000;
