import { API } from '@/constants/api';
import { ApiError, apiFetch } from '@/lib/api/client';
import {
  canDecide,
  decideReceipt,
  heldForReview,
  isOpenStatus,
  listReceipts,
  OPEN_STATUSES,
} from '@/lib/api/approvals';

const token = async () => 'tok-123';
const noToken = async () => null;

function mockFetch(impl: (url: string, init: RequestInit) => Partial<Response> & { json?: () => Promise<unknown> }) {
  global.fetch = jest.fn(async (url: unknown, init: unknown) => {
    const r = impl(String(url), (init ?? {}) as RequestInit);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: r.json ?? (async () => ({})),
      text: async () => '',
      ...r,
    } as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => jest.resetAllMocks());

describe('the only credential sent is the admin’s own token', () => {
  it('sends the bearer token and nothing else', async () => {
    let seen: RequestInit = {};
    mockFetch((_u, init) => {
      seen = init;
      return { json: async () => ({ items: [] }) };
    });

    await listReceipts(token);

    const headers = seen.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-123');
    // A mobile binary cannot keep a secret -- anyone with the APK has it. If
    // one of these ever appears here, the app is leaking it to every device.
    const asText = JSON.stringify(headers).toLowerCase();
    expect(asText).not.toContain('secret');
    expect(asText).not.toContain('x-api-key');
  });

  it('refuses before reaching the network when there is no session', async () => {
    mockFetch(() => ({}));
    await expect(apiFetch('https://x.test', { getAccessToken: noToken })).rejects.toMatchObject({
      code: 'NO_SESSION',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('the queue asks for the right work', () => {
  it('Open asks for ALL five open statuses, oldest first', async () => {
    let seenUrl = '';
    mockFetch((u) => {
      seenUrl = u;
      return { json: async () => ({ items: [] }) };
    });

    await listReceipts(token);

    // oldest-first is the member who has waited longest. Newest-first starves
    // them, which is the opposite of what a work queue is for.
    // under_review ALONE was the bug: it showed a fraction of the queue and
    // made this app's counts disagree with the portal's for one coalition.
    for (const st of OPEN_STATUSES) expect(decodeURIComponent(seenUrl)).toContain(st);
    expect(seenUrl).toContain('order=oldest');
    expect(seenUrl.startsWith(API.receipts)).toBe(true);
  });

  it('never invents a total the server did not send', async () => {
    // This used to expect items.length. That WAS a guess: one page of 20 rows
    // would have reported total 20 and the footer would have read "Showing 20
    // of 20" over a queue of 500. Absent is now null, and the footer hides.
    mockFetch(() => ({ json: async () => ({ items: [{ receipt_id: 'r1' }] }) }));
    const page = await listReceipts(token);
    expect(page.total).toBeNull();
  });
});

describe('a decision is one decision', () => {
  it('posts the action and extends it to the whole submission', async () => {
    let body: unknown = null;
    mockFetch((_u, init) => {
      body = JSON.parse(String(init.body));
      return { json: async () => ({ receipt_id: 'r1' }) };
    });

    await decideReceipt(token, { receiptId: 'r1', decision: 'approve', applyToSubmission: true });

    expect(body).toMatchObject({ action: 'approve', apply_to_submission: true });
  });

  it('surfaces a 409 as CONFLICT, not a generic failure', async () => {
    // 409 means somebody else already decided it. The UI treats that as done
    // and refreshes; treating it as an error would tell an admin their tap
    // failed when the work is complete.
    mockFetch(() => ({ ok: false, status: 409 }));
    await expect(
      // A reason is supplied so this reaches the network: without one the
      // REASON_REQUIRED guard short-circuits first and this would test that
      // instead, which is how this test failed when the guard was added.
      decideReceipt(token, { receiptId: 'r1', decision: 'reject', reason: 'duplicate' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('keeps 401 and 403 apart', async () => {
    // 401: sign in again. 403: signing in again changes nothing. Collapsing
    // them sends someone round a login loop that cannot succeed.
    mockFetch(() => ({ ok: false, status: 401 }));
    await expect(listReceipts(token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    mockFetch(() => ({ ok: false, status: 403 }));
    await expect(listReceipts(token)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('reports a lost connection as OFFLINE, not as an empty queue', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(listReceipts(token)).rejects.toBeInstanceOf(ApiError);
    await expect(listReceipts(token)).rejects.toMatchObject({ code: 'OFFLINE' });
  });
});

describe('canDecide mirrors the server, and only hides buttons', () => {
  // verification-api's DECIDE_ROLES, 2026-10-06. The route refuses regardless;
  // this exists so a cashier is not shown a button that will 403.
  it.each(['COALITION_OWNER', 'COALITION_ADMIN', 'COALITION_SUPPORT', 'COALITION_PARTICIPANT_ANALYST'])(
    'allows %s',
    (role) => expect(canDecide([role])).toBe(true),
  );

  it('refuses a cashier and an unknown role', () => {
    expect(canDecide(['COALITION_PARTICIPANT_CASHIER'])).toBe(false);
    expect(canDecide(['SOMETHING_NEW'])).toBe(false);
  });

  it('refuses when roles are missing rather than assuming', () => {
    expect(canDecide(null)).toBe(false);
    expect(canDecide([])).toBe(false);
  });

  it('is case-insensitive, because realms are not consistent about it', () => {
    expect(canDecide(['coalition_admin'])).toBe(true);
  });
});

describe('a reject without a reason never leaves the app', () => {
  // verification-api's ReviewReceiptRequest has a validator: "reason is
  // required when action is 'reject'". Before this guard the reject button
  // sent no reason, so EVERY rejection was a 422 that surfaced as a generic
  // failure -- a broken button, not a missing field.
  it('refuses before the network, with a named code', async () => {
    mockFetch(() => ({ json: async () => ({}) }));
    await expect(
      decideReceipt(token, { receiptId: 'r1', decision: 'reject' }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('treats whitespace as no reason', async () => {
    mockFetch(() => ({ json: async () => ({}) }));
    await expect(
      decideReceipt(token, { receiptId: 'r1', decision: 'reject', reason: '   ' }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the reason when there is one — the member is shown this text', async () => {
    let body: Record<string, unknown> = {};
    mockFetch((_u, init) => {
      body = JSON.parse(String(init.body));
      return { json: async () => ({ receipt_id: 'r1' }) };
    });
    await decideReceipt(token, {
      receiptId: 'r1',
      decision: 'reject',
      reason: 'Total does not match the receipt',
    });
    expect(body.reason).toBe('Total does not match the receipt');
    expect(body.action).toBe('reject');
  });

  it('approve needs no reason', async () => {
    mockFetch(() => ({ json: async () => ({ receipt_id: 'r1' }) }));
    await expect(decideReceipt(token, { receiptId: 'r1', decision: 'approve' })).resolves.toBeDefined();
  });
});

describe('pagination asks for the page it says it is asking for', () => {
  it('requests the given page', async () => {
    let url = '';
    mockFetch((u) => {
      url = u;
      return { json: async () => ({ items: [], total: 50 }) };
    });
    await listReceipts(token, { page: 3 });
    expect(url).toContain('page=3');
  });

  it('carries the server total through, so the UI can say how much is left', async () => {
    // A partial queue that looks complete is the honesty failure this guards:
    // with 50 pending and 20 shown, an admin must not read it as "done".
    mockFetch(() => ({ json: async () => ({ items: [{ receipt_id: 'r1' }], total: 50 }) }));
    const page = await listReceipts(token);
    expect(page.total).toBe(50);
  });

  it('reads rows from `receipts`, the key the live service sends', async () => {
    // Reading only `items` kept the total but dropped every row, so the screen
    // showed "queue is clear" next to a "Load more" button.
    mockFetch(() => ({
      json: async () => ({ success: true, receipts: [{ receipt_id: 'r1' }], total: 5 }),
    }));
    const page = await listReceipts(token);
    expect(page.items.map((r) => r.receipt_id)).toEqual(['r1']);
    expect(page.total).toBe(5);
  });
});

describe('Open and Decided are different queries, as the portal makes them', () => {
  it('Decided EXCLUDES the open statuses and orders newest first', async () => {
    let url = '';
    mockFetch((u) => {
      url = u;
      return { json: async () => ({ items: [] }) };
    });
    await listReceipts(token, { tab: 'decided' });
    // exclude_statuses, not an allowlist: a status nobody has taught this app
    // about must stay REACHABLE under Decided rather than vanish from both.
    expect(decodeURIComponent(url)).toContain('exclude_statuses=');
    expect(url).toContain('order=newest');
  });

  it('classifies statuses the way the portal does', () => {
    expect(isOpenStatus('under_review')).toBe(true);
    expect(isOpenStatus('info_requested')).toBe(true);
    expect(isOpenStatus('approved')).toBe(false);
    expect(isOpenStatus('settled')).toBe(false);
    // Unrecognised is NOT open, so it stays reachable under Decided.
    expect(isOpenStatus('something_new')).toBe(false);
  });

  it('only under_review is a person’s to decide', () => {
    expect(heldForReview('under_review')).toBe(true);
    expect(heldForReview('UNDER_REVIEW')).toBe(true);
    // Open, but the earn gate's to settle -- buttons here would offer a
    // decision the service refuses.
    for (const s of ['pending', 'processing', 'flagged', 'info_requested']) {
      expect(heldForReview(s)).toBe(false);
    }
    expect(heldForReview(null)).toBe(false);
  });

  it('reports an absent total as null, never as a number it invented', () => {
    // "Showing N of M" must not appear when M is unknown.
    mockFetch(() => ({ json: async () => ({ items: [{ receipt_id: 'r1' }] }) }));
    return expect(listReceipts(token)).resolves.toMatchObject({ total: null });
  });
});
