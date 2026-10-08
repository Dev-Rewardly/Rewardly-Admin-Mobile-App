// lib/api/approvals.ts
// The approvals queue, matching what the web portal's Approvals screen does.
//
// Shapes and statuses are taken from the portal's own source
// (apps/coalition-portal/lib/api/types/receipt.ts and
// components/coalition/ApprovalsInbox.tsx) and verification-api's route, read
// 2026-10-07 — not from a description of them.

import { API } from '../../constants/api';
import { ApiError, apiFetch } from './client';

export type ReceiptStatus =
  | 'pending'
  | 'processing'
  | 'flagged'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'settled';

/**
 * OPEN is five statuses, not one. The web Open queue asks for all of them.
 *
 * An earlier version of this app asked for `under_review` alone, which showed
 * a fraction of the queue and made the app's counts disagree with the portal's
 * for the same coalition. Open means "nothing has ruled on this yet".
 */
export const OPEN_STATUSES: readonly ReceiptStatus[] = [
  'pending',
  'processing',
  'flagged',
  'under_review',
  'info_requested',
];

/**
 * The ONE status a person decides. Everything else in the open queue is
 * waiting on the earn gate, not on a human — showing Approve/Reject against
 * it would offer a decision the service refuses (409).
 */
export const REVIEWABLE_STATUS: ReceiptStatus = 'under_review';

/** Has a person (or the gate) ruled on this receipt yet? */
export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

/** Only a held document is a person's to decide. */
export function heldForReview(status: string | null | undefined): boolean {
  return (status ?? '').toLowerCase() === REVIEWABLE_STATUS;
}

export interface ReceiptSummary {
  receipt_id: string;
  status: ReceiptStatus;
  /** The store. verification-api calls a store a participant. */
  participant_name: string | null;
  /** Not sent by verification-api as of 2026-10-08; kept as a fallback. */
  merchant_name?: string | null;
  amount: number | null;
  currency: string | null;
  submitted_at: string | null;
  consumer_name: string | null;
  /** null = NOT MEASURED, never zero. */
  rwly_earned: number | null;
  submission_id: string | null;
}

export interface ReceiptPage {
  items: ReceiptSummary[];
  /** null when the server did not say. A total it did not send is not a total. */
  total: number | null;
  page: number;
  page_size: number;
}

export type Decision = 'approve' | 'reject';
export type QueueTab = 'open' | 'decided';

/** One page. The server's own default; its maximum is 100. */
export const PAGE_SIZE = 20;

export interface ListParams {
  page?: number;
  tab?: QueueTab;
  q?: string;
}

/**
 * OPEN and DECIDED are different questions, so they are different queries —
 * the same split the portal makes.
 *
 * Open is OLDEST first: the member who has waited longest is the one to serve.
 * Decided is NEWEST first: it is a record, and the recent entry is the one
 * being looked for.
 */
export async function listReceipts(
  getAccessToken: () => Promise<string | null>,
  params: ListParams = {},
): Promise<ReceiptPage> {
  const tab: QueueTab = params.tab ?? 'open';
  const page = params.page ?? 1;

  const qs = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
    order: tab === 'open' ? 'oldest' : 'newest',
    ...(params.q ? { q: params.q } : {}),
  });
  // exclude_statuses, not an allowlist of decided ones: a status nobody has
  // taught this app about must stay REACHABLE under Decided rather than
  // vanish from both tabs.
  if (tab === 'open') qs.set('statuses', OPEN_STATUSES.join(','));
  else qs.set('exclude_statuses', OPEN_STATUSES.join(','));

  const body = await apiFetch<
    Partial<ReceiptPage> & { receipts?: ReceiptSummary[]; items?: ReceiptSummary[] }
  >(`${API.receipts}?${qs.toString()}`, { getAccessToken });

  // verification-api sends the rows as `receipts` (seen on the live gateway,
  // 2026-10-08). Reading only `items` dropped every row while keeping `total`,
  // so the screen said "queue is clear" beside a "Load more" button.
  const items = body.receipts ?? body.items ?? [];
  return {
    items,
    total: typeof body.total === 'number' ? body.total : null,
    page: body.page ?? page,
    page_size: body.page_size ?? PAGE_SIZE,
  };
}

export interface DecideParams {
  receiptId: string;
  decision: Decision;
  reason?: string;
  /**
   * Decide every open document of the same submission. A member's two-proof
   * earn is ONE request; deciding half leaves the rest open with nobody
   * waiting on it.
   */
  applyToSubmission?: boolean;
}

export async function decideReceipt(
  getAccessToken: () => Promise<string | null>,
  { receiptId, decision, reason, applyToSubmission }: DecideParams,
): Promise<ReceiptSummary> {
  // A REJECT WITHOUT A REASON IS A 422, NOT A REJECTION.
  //
  // verification-api's ReviewReceiptRequest carries a model validator --
  // "reason is required when action is 'reject'". Caught here so the caller
  // gets a named error it can act on, instead of a validation failure that
  // surfaces as "something went wrong" and reads like an outage.
  //
  // The reason is also the text the MEMBER is shown, which is the better
  // argument for collecting it than the validator is.
  if (decision === 'reject' && (reason ?? '').trim() === '') {
    throw new ApiError('REASON_REQUIRED', 'A reason is required to reject.');
  }

  return apiFetch<ReceiptSummary>(API.receiptReview(receiptId), {
    method: 'POST',
    getAccessToken,
    body: {
      action: decision,
      ...(reason ? { reason: reason.trim() } : {}),
      ...(applyToSubmission !== undefined ? { apply_to_submission: applyToSubmission } : {}),
    },
  });
}

export async function getReceiptImageUrl(
  getAccessToken: () => Promise<string | null>,
  receiptId: string,
): Promise<string | null> {
  const body = await apiFetch<{ url?: string; image_url?: string }>(
    API.receiptImageUrl(receiptId),
    { getAccessToken },
  );
  return body.url ?? body.image_url ?? null;
}

/**
 * Roles that may decide, from verification-api's DECIDE_ROLES (2026-10-06).
 * The server enforces this and is the authority; this exists only so a cashier
 * is not shown buttons that will 403. Hiding a control is not a security
 * measure.
 */
export const DECIDE_ROLES = [
  'COALITION_OWNER',
  'COALITION_ADMIN',
  'COALITION_SUPPORT',
  'COALITION_PARTICIPANT_ANALYST',
] as const;

export function canDecide(roles: readonly string[] | null | undefined): boolean {
  if (!roles) return false;
  const held = new Set(roles.map((r) => String(r).toUpperCase()));
  return DECIDE_ROLES.some((r) => held.has(r));
}
